/**
 * Runs an editorial-guidance report on each fixture and scores each rule.
 * The report runs in the default single flow with `--dry-run`, so one agent
 * checks each fixture and nothing is edited.
 *
 * Usage: node evals/eval.ts [RULE | RULE/NAME ...] [--runs N] [--jobs N] [--model NAME]
 *
 * A fixture lives in fixtures/<RULE>/<name>.md. Its frontmatter says whether
 * the rule must fire (`expect: flag`) or stay silent (`expect: pass`).
 * An optional `not: PA001, SU001` lists rules that must stay silent too, which
 * checks that an overlapping finding goes to its owner.
 * An optional `selectors: slop CA002` replaces the default `recommended` preset,
 * for a fixture whose competing rule is not in that preset.
 * Only these rules are scored. Other rules a fixture fires are listed as extra,
 * and a fired `not` rule is marked with `!`.
 * Raw replies go to results/<timestamp>/.
 */

import { execFile } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

type Expect = "flag" | "pass";

type Fixture = {
  rule: string;
  name: string;
  expect: Expect;
  /** Rules that must not fire on this fixture. */
  not: string[];
  /** Presets and rule IDs passed to the skill. */
  selectors: string[];
  note: string;
  body: string;
};

type Job = {
  fixture: Fixture;
  attempt: number;
};

type Run = {
  /** Rule IDs from the FOUND line, or null when the reply has no FOUND line. */
  found: Set<string> | null;
  cost: number;
  turns: number;
  /** Tool calls the permission rules turned down, as "<tool>: <command or path>". */
  denied: string[];
  reply: string;
};

type Row = {
  fixture: Fixture;
  ok: number;
  total: number;
  broken: number;
  denied: number;
  extra: string[];
};

type Tally = {
  ok: number;
  total: number;
};

type RuleStats = {
  flag: Tally;
  pass: Tally;
  flaky: number;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const RESULTS = join(HERE, "results");

const DEFAULT_SELECTORS = ["recommended"];

const SYSTEM_PROMPT =
  "Eval run. End the reply with one line: " +
  "FOUND: <comma-separated rule IDs of your findings, or none>";

function parseFixture(rule: string, file: string): Fixture {
  const path = join(FIXTURES, rule, file);
  const text = readFileSync(path, "utf8");

  const match = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${path}: no frontmatter`);
  }

  const [, frontmatter = "", body = ""] = match;
  const meta = parseFrontmatter(frontmatter);

  const expect = meta.get("expect");
  if (expect !== "flag" && expect !== "pass") {
    throw new Error(`${path}: expect must be flag or pass`);
  }

  const not = (meta.get("not") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");

  const badId = not.find((id) => !/^[A-Z]{2}\d{3}$/.test(id));
  if (badId !== undefined) {
    throw new Error(`${path}: not has a bad rule ID ${badId}`);
  }

  const listed = (meta.get("selectors") ?? "").split(/\s+/).filter((word) => word !== "");
  const selectors = listed.length > 0 ? listed : DEFAULT_SELECTORS;

  const badSelector = selectors.find((word) => !/^([A-Z]{2}\d{3}|[a-z]+)$/.test(word));
  if (badSelector !== undefined) {
    throw new Error(`${path}: selectors has a bad preset or rule ID ${badSelector}`);
  }

  return {
    rule,
    name: file.replace(/\.md$/, ""),
    expect,
    not,
    selectors,
    note: meta.get("note") ?? "",
    body: body.trim(),
  };
}

/** Reads flat `key: value` lines, which is all a fixture needs. */
function parseFrontmatter(text: string): Map<string, string> {
  const meta = new Map<string, string>();

  for (const line of text.split("\n")) {
    const colon = line.indexOf(": ");
    if (colon > 0) {
      meta.set(line.slice(0, colon), line.slice(colon + 2));
    }
  }

  return meta;
}

/** Selects by rule folder (`GR003`) or by one fixture (`GR003/flag-dash`). No selectors means all. */
function loadFixtures(selectors: string[]): Fixture[] {
  const fixtures = readdirSync(FIXTURES)
    .sort()
    .flatMap((rule) =>
      readdirSync(join(FIXTURES, rule))
        .filter((file) => file.endsWith(".md"))
        .sort()
        .map((file) => parseFixture(rule, file)),
    );

  if (selectors.length === 0) {
    return fixtures;
  }

  return fixtures.filter(
    ({ rule, name }) => selectors.includes(rule) || selectors.includes(`${rule}/${name}`),
  );
}

/**
 * Runs the skill once on a fixture with `--dry-run`. Edit and Write are off as well,
 * so the run cannot change files.
 * The skill passes chat text to prompt.ts on stdin, and prompt.ts saves it to a temp file.
 * TMPDIR points at the run directory, so those temp files go away with it.
 * Stdin is closed right away, otherwise claude waits for it before it starts.
 */
function runClaude(fixture: Fixture, model: string | undefined, cwd: string): Promise<Run> {
  const args = [
    "-p", `/editorial-guidance ${fixture.selectors.join(" ")} --dry-run ${fixture.body}`,
    "--allowedTools",
    "Read Glob Grep Skill Bash(*/scripts/prompt.ts *) Bash(*/scripts/checks.ts *)",
    "--disallowedTools", "Edit Write",
    "--append-system-prompt", SYSTEM_PROMPT,
    "--output-format", "json",
  ];

  if (model) {
    args.push("--model", model);
  }

  return new Promise((resolve) => {
    const options = { cwd, env: { ...process.env, TMPDIR: cwd }, maxBuffer: 16 * 1024 * 1024 };

    const child = execFile("claude", args, options, (_error, stdout, stderr) => {
      resolve(parseReply(stdout, stderr));
    });

    child.stdin?.end();
  });
}

function parseReply(stdout: string, stderr: string): Run {
  const data = parseJson(stdout);
  if (!isRecord(data)) {
    return { found: null, cost: 0, turns: 0, denied: [], reply: stdout + stderr };
  }

  const reply = typeof data.result === "string" ? data.result : "";
  const cost = typeof data.total_cost_usd === "number" ? data.total_cost_usd : 0;
  const turns = typeof data.num_turns === "number" ? data.num_turns : 0;
  const denials = Array.isArray(data.permission_denials) ? data.permission_denials : [];
  const denied = denials.map(describeDenial);

  const foundLines = [...reply.matchAll(/^FOUND:\s*(.*)$/gm)];
  const lastLine = foundLines.at(-1)?.[1];

  if (lastLine === undefined) {
    return { found: null, cost, turns, denied, reply };
  }

  const ids = lastLine.match(/\b[A-Z]{2}\d{3}\b/g) ?? [];

  return { found: new Set(ids), cost, turns, denied, reply };
}

/** One entry of `permission_denials` as "<tool>: <command or path>". */
function describeDenial(entry: unknown): string {
  if (!isRecord(entry)) {
    return String(entry);
  }

  const tool = typeof entry.tool_name === "string" ? entry.tool_name : "?";
  const input = isRecord(entry.tool_input) ? entry.tool_input : {};
  const target = input.command ?? input.file_path ?? JSON.stringify(input);

  return `${tool}: ${String(target)}`;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Runs `fn` over `items`, at most `size` at a time, keeping the input order. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Map<number, R>();
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];

      if (item !== undefined) {
        results.set(index, await fn(item));
      }
    }
  };

  const workers = Array.from({ length: Math.min(size, items.length) }, worker);
  await Promise.all(workers);

  return [...results.entries()].sort(([a], [b]) => a - b).map(([, result]) => result);
}

/** Runs every job in an empty working directory, so no project instructions leak into the run. */
async function runAll(jobs: Job[], parallel: number, model: string | undefined): Promise<Run[]> {
  const cwd = mkdtempSync(join(tmpdir(), "editorial-eval-"));

  try {
    return await pool(jobs, parallel, ({ fixture }) => runClaude(fixture, model, cwd));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function scoreFixture(fixture: Fixture, runs: Run[]): Row {
  const shouldFire = fixture.expect === "flag";

  const ok = runs.filter((run) => {
    const fired = run.found?.has(fixture.rule) ?? false;
    const misfiled = fixture.not.some((id) => run.found?.has(id) ?? false);

    return fired === shouldFire && !misfiled;
  }).length;

  const broken = runs.filter((run) => run.found === null).length;
  const denied = runs.reduce((sum, run) => sum + run.denied.length, 0);

  const allFound = new Set(runs.flatMap((run) => [...(run.found ?? [])]));
  const extra = [...allFound]
    .filter((id) => id !== fixture.rule)
    .sort()
    .map((id) => (fixture.not.includes(id) ? `${id}!` : id));

  return { fixture, ok, total: runs.length, broken, denied, extra };
}

function statsByRule(rows: Row[]): Map<string, RuleStats> {
  const stats = new Map<string, RuleStats>();

  for (const row of rows) {
    const { rule, expect } = row.fixture;

    const entry = stats.get(rule) ?? {
      flag: { ok: 0, total: 0 },
      pass: { ok: 0, total: 0 },
      flaky: 0,
    };

    entry[expect].ok += row.ok;
    entry[expect].total += row.total;

    if (row.ok > 0 && row.ok < row.total) {
      entry.flaky++;
    }

    stats.set(rule, entry);
  }

  return stats;
}

function printFixtures(rows: Row[]) {
  console.log(`${"fixture".padEnd(32)} ${"expect".padEnd(6)} ${"ok".padStart(5)}  extra`);

  for (const row of rows) {
    const key = `${row.fixture.rule}/${row.fixture.name}`;
    const score = `${String(row.ok).padStart(2)}/${String(row.total).padEnd(2)}`;

    let tail = row.extra.join(", ");
    if (row.broken > 0) {
      tail += `  [${row.broken} without FOUND]`;
    }
    if (row.denied > 0) {
      tail += `  [${row.denied} denied]`;
    }

    console.log(`${key.padEnd(32)} ${row.fixture.expect.padEnd(6)} ${score}  ${tail}`);
  }
}

function printRules(stats: Map<string, RuleStats>) {
  const rate = ({ ok, total }: Tally) => (total > 0 ? `${ok}/${total}` : "-");

  console.log();
  console.log(`${"rule".padEnd(6)} ${"recall".padStart(8)} ${"silent".padStart(8)} ${"flaky".padStart(6)}`);

  const sorted = [...stats].sort(([a], [b]) => a.localeCompare(b));

  for (const [rule, entry] of sorted) {
    const recall = rate(entry.flag).padStart(8);
    const silent = rate(entry.pass).padStart(8);
    const flaky = String(entry.flaky).padStart(6);

    console.log(`${rule.padEnd(6)} ${recall} ${silent} ${flaky}`);
  }
}

/** UTC time as YYYYMMDD-HHMMSS, so result folders sort by when they ran. */
function timestamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");

  const day = `${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}`;
  const time = `${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}`;

  return `${day}-${time}`;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      runs: { type: "string", default: "3" },
      jobs: { type: "string", default: "4" },
      model: { type: "string" },
    },
  });

  const runsPerFixture = Number(values.runs);
  const parallel = Number(values.jobs);

  const fixtures = loadFixtures(positionals);
  if (fixtures.length === 0) {
    throw new Error("no fixtures");
  }

  const outDir = join(RESULTS, timestamp(new Date()));
  mkdirSync(outDir, { recursive: true });

  const jobs: Job[] = fixtures.flatMap((fixture) =>
    Array.from({ length: runsPerFixture }, (_, attempt) => ({ fixture, attempt })),
  );

  const runs = await runAll(jobs, parallel, values.model);
  const runsByFixture = new Map<Fixture, Run[]>();

  jobs.forEach(({ fixture, attempt }, index) => {
    const run = runs[index];
    if (run === undefined) {
      return;
    }

    const file = `${fixture.rule}-${fixture.name}-${attempt + 1}.md`;
    const denials = run.denied.map((line) => `- ${line}`).join("\n");
    const text = denials ? `${run.reply}\n\n---\nDenied:\n${denials}\n` : run.reply;
    writeFileSync(join(outDir, file), text);

    runsByFixture.set(fixture, [...(runsByFixture.get(fixture) ?? []), run]);
  });

  const rows = fixtures.map((fixture) => scoreFixture(fixture, runsByFixture.get(fixture) ?? []));

  printFixtures(rows);
  printRules(statsByRule(rows));

  const cost = runs.reduce((sum, run) => sum + run.cost, 0);
  const turns = runs.reduce((sum, run) => sum + run.turns, 0);
  const denied = runs.reduce((sum, run) => sum + run.denied.length, 0);

  const perCall = (total: number) => (total / runs.length).toFixed(2);

  console.log();
  console.log(`cost $${cost.toFixed(2)} ($${perCall(cost)} per call), ${perCall(turns)} turns per call`);
  console.log(`${denied} tool calls denied${denied > 0 ? ", listed at the end of each reply" : ""}`);
  console.log(`replies in ${outDir}`);
}

await main();
