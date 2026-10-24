/**
 * Runs an editorial-guidance report on each fixture and scores it.
 * The report runs in the default single flow with `--dry-run`, so one agent
 * checks each fixture and nothing is edited.
 *
 * Usage: node evals/eval.ts [FOLDER | FOLDER/NAME ...] [--runs N] [--jobs N] [--model NAME]
 *
 * A rule fixture lives in fixtures/<RULE>/<name>.md and runs with that rule
 * alone. Its frontmatter says whether the rule must fire (`expect: flag`) or
 * stay silent (`expect: pass`).
 *
 * A preset fixture lives in fixtures/<preset>/<name>.md and runs with the whole
 * preset, so its rules compete for a finding as they do in a real call.
 * `fire: GR001` lists rules that must fire, `silent: GR004` rules that must stay
 * silent, which checks that an overlapping finding goes to its owner.
 * Only these rules are scored. Other rules a fixture fires are listed as extra,
 * and a fired silent rule is marked with `!`.
 * Raw replies go to results/<timestamp>/.
 */

import { execFile } from "node:child_process";
import {
  existsSync,
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
  /** A rule ID for a rule fixture, a preset ID for a preset fixture. */
  folder: string;
  name: string;
  /** Set for a rule fixture only. */
  expect: Expect | null;
  /** Rules that must fire on this fixture. */
  fire: string[];
  /** Rules that must not fire on this fixture. */
  silent: string[];
  /** The preset or the rule ID passed to the skill. */
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

type PresetStats = {
  runs: Tally;
  flaky: number;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const PRESETS = join(HERE, "..", "references", "presets");
const RESULTS = join(HERE, "results");

const RULE_ID = /^[A-Z]{2}\d{3}$/;
const PRESET_ID = /^[a-z]+$/;

const SYSTEM_PROMPT =
  "Eval run. End the reply with one line: " +
  "FOUND: <comma-separated rule IDs of your findings, or none>";

function parseFixture(folder: string, file: string): Fixture {
  const path = join(FIXTURES, folder, file);
  const text = readFileSync(path, "utf8");

  const match = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${path}: no frontmatter`);
  }

  const [, frontmatter = "", body = ""] = match;
  const meta = parseFrontmatter(frontmatter);
  const fixture = {
    folder,
    name: file.replace(/\.md$/, ""),
    note: meta.get("note") ?? "",
    body: body.trim(),
  };

  if (RULE_ID.test(folder)) {
    const stray = ["not", "selectors", "fire", "silent"].find((key) => meta.has(key));
    if (stray !== undefined) {
      throw new Error(
        `${path}: a rule fixture runs its rule alone and takes no ${stray}, ` +
          "an overlap of rules goes to a preset fixture in fixtures/<preset>/",
      );
    }

    const expect = meta.get("expect");
    if (expect !== "flag" && expect !== "pass") {
      throw new Error(`${path}: expect must be flag or pass`);
    }

    return {
      ...fixture,
      expect,
      fire: expect === "flag" ? [folder] : [],
      silent: expect === "pass" ? [folder] : [],
      selectors: [folder],
    };
  }

  if (PRESET_ID.test(folder)) {
    const stray = ["expect", "not", "selectors"].find((key) => meta.has(key));
    if (stray !== undefined) {
      throw new Error(`${path}: a preset fixture lists its rules in fire and silent, not in ${stray}`);
    }

    if (!existsSync(join(PRESETS, `${folder}.md`))) {
      throw new Error(`${path}: no preset ${folder}`);
    }

    const fire = parseRuleIds(path, "fire", meta.get("fire"));
    const silent = parseRuleIds(path, "silent", meta.get("silent"));

    if (fire.length + silent.length === 0) {
      throw new Error(`${path}: a preset fixture needs fire or silent`);
    }

    const both = fire.find((id) => silent.includes(id));
    if (both !== undefined) {
      throw new Error(`${path}: ${both} is both in fire and in silent`);
    }

    return { ...fixture, expect: null, fire, silent, selectors: [folder] };
  }

  throw new Error(`${path}: a fixture folder is named by a rule ID or a preset ID`);
}

/** Reads a comma-separated list of rule IDs from one frontmatter key. */
function parseRuleIds(path: string, key: string, value: string | undefined): string[] {
  const ids = (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");

  const badId = ids.find((id) => !RULE_ID.test(id));
  if (badId !== undefined) {
    throw new Error(`${path}: ${key} has a bad rule ID ${badId}`);
  }

  return ids;
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

/**
 * Selects by folder (`GR003`, `recommended`) or by one fixture (`GR003/flag-dash`).
 * No selectors means all.
 */
function loadFixtures(selectors: string[]): Fixture[] {
  const fixtures = readdirSync(FIXTURES)
    .sort()
    .flatMap((folder) =>
      readdirSync(join(FIXTURES, folder))
        .filter((file) => file.endsWith(".md"))
        .sort()
        .map((file) => parseFixture(folder, file)),
    );

  if (selectors.length === 0) {
    return fixtures;
  }

  return fixtures.filter(
    ({ folder, name }) => selectors.includes(folder) || selectors.includes(`${folder}/${name}`),
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

/** A run without a FOUND line fails, so a broken reply never counts as silence. */
function scoreFixture(fixture: Fixture, runs: Run[]): Row {
  const ok = runs.filter(({ found }) => {
    if (found === null) {
      return false;
    }

    const fired = fixture.fire.every((id) => found.has(id));
    const misfiled = fixture.silent.some((id) => found.has(id));

    return fired && !misfiled;
  }).length;

  const broken = runs.filter((run) => run.found === null).length;
  const denied = runs.reduce((sum, run) => sum + run.denied.length, 0);

  const allFound = new Set(runs.flatMap((run) => [...(run.found ?? [])]));
  const extra = [...allFound]
    .filter((id) => !fixture.fire.includes(id))
    .sort()
    .map((id) => (fixture.silent.includes(id) ? `${id}!` : id));

  return { fixture, ok, total: runs.length, broken, denied, extra };
}

/** Rule fixtures only: a preset fixture scores how rules share findings, not one rule. */
function statsByRule(rows: Row[]): Map<string, RuleStats> {
  const stats = new Map<string, RuleStats>();

  for (const row of rows) {
    const { folder, expect } = row.fixture;
    if (expect === null) {
      continue;
    }

    const entry = stats.get(folder) ?? {
      flag: { ok: 0, total: 0 },
      pass: { ok: 0, total: 0 },
      flaky: 0,
    };

    entry[expect].ok += row.ok;
    entry[expect].total += row.total;

    if (row.ok > 0 && row.ok < row.total) {
      entry.flaky++;
    }

    stats.set(folder, entry);
  }

  return stats;
}

function statsByPreset(rows: Row[]): Map<string, PresetStats> {
  const stats = new Map<string, PresetStats>();

  for (const row of rows) {
    const { folder, expect } = row.fixture;
    if (expect !== null) {
      continue;
    }

    const entry = stats.get(folder) ?? { runs: { ok: 0, total: 0 }, flaky: 0 };

    entry.runs.ok += row.ok;
    entry.runs.total += row.total;

    if (row.ok > 0 && row.ok < row.total) {
      entry.flaky++;
    }

    stats.set(folder, entry);
  }

  return stats;
}

/** `flag` or `pass` for a rule fixture, `+GR001 -GR004` for a preset fixture. */
function expectation(fixture: Fixture): string {
  if (fixture.expect !== null) {
    return fixture.expect;
  }

  return [...fixture.fire.map((id) => `+${id}`), ...fixture.silent.map((id) => `-${id}`)].join(" ");
}

function printFixtures(rows: Row[]) {
  const key = (fixture: Fixture) => `${fixture.folder}/${fixture.name}`;
  const keyWidth = Math.max(32, ...rows.map((row) => key(row.fixture).length));
  const width = Math.max(6, ...rows.map((row) => expectation(row.fixture).length));

  console.log(`${"fixture".padEnd(keyWidth)} ${"expect".padEnd(width)} ${"ok".padStart(5)}  extra`);

  for (const row of rows) {
    const score = `${String(row.ok).padStart(2)}/${String(row.total).padEnd(2)}`;

    let tail = row.extra.join(", ");
    if (row.broken > 0) {
      tail += `  [${row.broken} without FOUND]`;
    }
    if (row.denied > 0) {
      tail += `  [${row.denied} denied]`;
    }

    console.log(`${key(row.fixture).padEnd(keyWidth)} ${expectation(row.fixture).padEnd(width)} ${score}  ${tail}`);
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

function printPresets(stats: Map<string, PresetStats>) {
  if (stats.size === 0) {
    return;
  }

  console.log();
  console.log(`${"preset".padEnd(12)} ${"ok".padStart(8)} ${"flaky".padStart(6)}`);

  const sorted = [...stats].sort(([a], [b]) => a.localeCompare(b));

  for (const [preset, entry] of sorted) {
    const ok = `${entry.runs.ok}/${entry.runs.total}`.padStart(8);
    const flaky = String(entry.flaky).padStart(6);

    console.log(`${preset.padEnd(12)} ${ok} ${flaky}`);
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

    const file = `${fixture.folder}-${fixture.name}-${attempt + 1}.md`;
    const denials = run.denied.map((line) => `- ${line}`).join("\n");
    const text = denials ? `${run.reply}\n\n---\nDenied:\n${denials}\n` : run.reply;
    writeFileSync(join(outDir, file), text);

    runsByFixture.set(fixture, [...(runsByFixture.get(fixture) ?? []), run]);
  });

  const rows = fixtures.map((fixture) => scoreFixture(fixture, runsByFixture.get(fixture) ?? []));

  printFixtures(rows);
  printRules(statsByRule(rows));
  printPresets(statsByPreset(rows));

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
