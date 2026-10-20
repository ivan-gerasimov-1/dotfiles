#!/usr/bin/env node
/**
 * Prints presets and rules in one go, so an agent reads them in one call.
 *
 * Usage: rules.ts <ru|en> [<selector>...]   preset notes, then the selected rules for the language
 *        rules.ts <ru|en> --notes [<selector>...]   only the preset notes
 *        rules.ts <ru|en> --groups [<selector>...]   the plain rules and groups to run, one per line
 *        rules.ts <ru|en> --ids [<selector>...]   only the rule IDs, in run order
 *        rules.ts <ru|en> --checks [<selector>...]   the mechanical checks of the selected rules
 *        rules.ts --check   check that presets and rule files agree
 *
 * A selector is a preset name (references/presets/<name>.md) or a rule ID such as GR003.
 * No selectors means the recommended preset.
 *
 * Preset frontmatter holds either `rules: [..]`, plain rules, or `groups`, rules split
 * into titled groups, and may add `extends: [..]`, other presets one level deep. Rules
 * run in this order: plain rules, then groups. In each part the preset's own come
 * first, then those of the presets it extends, in order. The selectors work as a
 * preset that extends the named presets and has the named rule IDs as plain rules.
 * A group runs whole and once. A plain rule runs once and drops out when a group to
 * run holds it. A rule lists its languages in `languages: [ru, en]`, names its
 * category, one of references/categories.md, and may name its scripts/checks.ts
 * checks in `checks: [..]`. The description is Russian and holds for every language.
 * Examples and lists for one language go in its section at the end, `## ru` or `## en`.
 * A section is optional, but its language must be in `languages`.
 * Exit code 2 means bad usage or an unknown selector.
 *
 * Needs Node 22.18+ to run TypeScript without a build step.
 */

import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checksFor, type Lang } from "./checks.ts";

export const langs: Lang[] = ["ru", "en"];

export type Preset = {
  /** File name without `.md`. */
  name: string;
  /** The `id` field, empty when missing. */
  id: string;
  rules: string[];
  groups: { title: string; rules: string[] }[];
  extends: string[];
  body: string;
};

export type Rule = {
  /** File name without `.md`. */
  name: string;
  /** The `id` field, empty when missing. */
  id: string;
  category: string;
  languages: string[];
  checks: string[];
  body: string;
  /** The whole file, frontmatter included. */
  text: string;
};

export type Model = {
  presets: Map<string, Preset>;
  /** Sorted by ID. */
  rules: Map<string, Rule>;
  categories: string[];
  /** Checks of scripts/checks.ts that work for the language. */
  checks: (lang: Lang) => string[];
};

/** A group to run, cut to the rules of the language. */
export type PlannedGroup = {
  preset: string;
  /** 1-based position of the group in its preset. */
  number: number;
  title: string;
  rules: string[];
};

export type Plan = {
  plain: string[];
  groups: PlannedGroup[];
  /** Rule IDs in run order: plain rules, then the rules of each group, each once. */
  kept: string[];
  /** Rule IDs asked for by name that have no reading for the language, sorted. */
  skipped: string[];
};

const ruleId = /^[A-Z]{2}[0-9]{3}$/;
const presetName = /^[a-z][a-z0-9-]*$/;

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Lines of the frontmatter, or none when the file has no frontmatter. */
function frontmatter(text: string): string[] {
  const lines = text.split("\n");
  if (lines[0] !== "---") return [];
  const end = lines.indexOf("---", 1);
  return lines.slice(1, end === -1 ? undefined : end);
}

/** Items of a top-level `key: [a, b]` line. */
function fmList(fm: string[], key: string): string[] {
  return fm
    .filter((line) => line.startsWith(`${key}: [`))
    .flatMap((line) =>
      line
        .replace(/^[^[]*\[/, "")
        .replace(/\].*$/, "")
        .replaceAll(" ", "")
        .split(","),
    )
    .filter((item) => item !== "");
}

/** Value of a top-level `key: value` line. */
function fmValue(fm: string[], key: string): string {
  const line = fm.find((line) => line.startsWith(`${key}: `));
  return line === undefined ? "" : line.slice(key.length + 2);
}

/** Groups under a top-level `groups:` key, as `  - title:` and `    rules: [..]` lines. */
function fmGroups(fm: string[]): Preset["groups"] {
  const groups: Preset["groups"] = [];
  let inside = false;
  for (const line of fm) {
    if (line.startsWith("groups:")) {
      inside = true;
      continue;
    }
    if (/^[^ ]/.test(line)) inside = false;
    if (!inside) continue;
    if (line.startsWith("  - title:")) {
      const title = line.replace(/^ {2}- title: *"?/, "").replace(/"$/, "");
      groups.push({ title, rules: [] });
    }
    const group = groups.at(-1);
    if (group && /^ {4}rules: *\[/.test(line)) {
      group.rules = line
        .replace(/^[^[]*\[/, "")
        .replace(/\].*$/, "")
        .split(/, */)
        .filter((id) => id !== "");
    }
  }
  return groups;
}

/** File body without frontmatter, HTML comments and blank lines at either end. */
export function body(text: string): string {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const out: string[] = [];
  let inFrontmatter = false;
  let inComment = false;
  let blanks = 0;
  lines.forEach((line, i) => {
    if (i === 0 && line === "---") {
      inFrontmatter = true;
      return;
    }
    if (inFrontmatter) {
      if (line === "---") inFrontmatter = false;
      return;
    }
    if (line.startsWith("<!--")) inComment = true;
    if (inComment) {
      if (line.endsWith("-->")) inComment = false;
      return;
    }
    if (line === "") {
      if (out.length > 0) blanks++;
      return;
    }
    for (; blanks > 0; blanks--) out.push("");
    out.push(line);
  });
  return out.join("\n");
}

export function loadModel(root: string): Model {
  const read = (dir: string, match: RegExp) =>
    readdirSync(join(root, dir))
      .filter((file) => match.test(file))
      .sort()
      .map((file) => ({
        name: file.slice(0, -".md".length),
        text: readFileSync(join(root, dir, file), "utf8"),
      }));

  const presets = new Map<string, Preset>();
  for (const { name, text } of read("references/presets", /\.md$/)) {
    const fm = frontmatter(text);
    presets.set(name, {
      name,
      id: fmValue(fm, "id"),
      rules: fmList(fm, "rules"),
      groups: fmGroups(fm),
      extends: fmList(fm, "extends"),
      body: body(text),
    });
  }

  const rules = new Map<string, Rule>();
  for (const { name, text } of read("references/rules", /^[A-Z]{2}[0-9]{3}\.md$/)) {
    const fm = frontmatter(text);
    rules.set(name, {
      name,
      id: fmValue(fm, "id"),
      category: fmValue(fm, "category"),
      languages: fmList(fm, "languages"),
      checks: fmList(fm, "checks"),
      body: body(text),
      text,
    });
  }

  const categories = fmList(
    frontmatter(readFileSync(join(root, "references/categories.md"), "utf8")),
    "categories",
  );

  return { presets, rules, categories, checks: checksFor };
}

export function isRule(model: Model, selector: string): boolean {
  return ruleId.test(selector) && model.rules.has(selector);
}

export function isPreset(model: Model, selector: string): boolean {
  return presetName.test(selector) && model.presets.has(selector);
}

/** The preset and the presets it extends, in run order: its own first. */
function withParents(model: Model, name: string): Preset[] {
  const preset = model.presets.get(name);
  if (!preset) return [];
  const parents = preset.extends.flatMap((parent) => model.presets.get(parent) ?? []);
  return [preset, ...parents];
}

/** Plain rules of a preset: its own `rules`, then those of the presets it extends. */
function plainRules(model: Model, name: string): string[] {
  return withParents(model, name).flatMap((preset) => preset.rules);
}

/** Groups of a preset: its own, then those of the presets it extends. */
function allGroups(model: Model, name: string): PlannedGroup[] {
  return withParents(model, name).flatMap((preset) =>
    preset.groups.map((group, i) => ({
      preset: preset.name,
      number: i + 1,
      title: group.title,
      rules: group.rules,
    })),
  );
}

/** Every rule ID of a preset, duplicates kept. */
function presetRules(model: Model, name: string): string[] {
  return [
    ...plainRules(model, name),
    ...allGroups(model, name).flatMap((group) => group.rules),
  ];
}

export function plan(model: Model, lang: Lang, selectors: string[]): Plan {
  const inLanguage = (id: string) =>
    model.rules.get(id)?.languages.includes(lang) ?? false;
  const presets = selectors.filter((selector) => isPreset(model, selector));

  // Each group runs once, cut to the rules of the language. A group left empty drops out.
  const seen = new Set<string>();
  const groups = presets
    .flatMap((name) => allGroups(model, name))
    .filter((group) => {
      const key = `${group.preset}\t${group.number}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((group) => ({ ...group, rules: group.rules.filter(inLanguage) }))
    .filter((group) => group.rules.length > 0);

  // Rule IDs named in the selectors, then the presets' plain rules. Each runs once,
  // only in the language and only when no group to run holds it.
  const grouped = new Set(groups.flatMap((group) => group.rules));
  const plain = unique([
    ...selectors.filter((selector) => isRule(model, selector)),
    ...presets.flatMap((name) => plainRules(model, name)),
  ]).filter((id) => !grouped.has(id) && inLanguage(id));

  const kept = unique([...plain, ...groups.flatMap((group) => group.rules)]);

  // Only IDs asked for by name are worth a note. A preset always has rules the language filter drops.
  const skipped = unique(selectors.filter((selector) => ruleId.test(selector)))
    .filter((id) => !kept.includes(id))
    .sort();

  return { plain, groups, kept, skipped };
}

/**
 * Bodies of the selected presets and the presets they extend, each once. A preset with
 * groups gets the list of its groups from the frontmatter, under its "## Группы"
 * heading or at the end, so the text never repeats the frontmatter by hand.
 */
export function notes(model: Model, selectors: string[]): string {
  const names = unique(
    selectors
      .filter((selector) => isPreset(model, selector))
      .flatMap((name) => [...(model.presets.get(name)?.extends ?? []), name]),
  );
  return names
    .flatMap((name) => model.presets.get(name) ?? [])
    .map((preset) => {
      const list = preset.groups.map(
        (group, i) => `${i + 1}. ${group.title}: ${group.rules.join(", ")}`,
      );
      const lines = preset.body.split("\n");
      if (list.length > 0) {
        const heading = lines.indexOf("## Группы");
        if (heading === -1) lines.push("", "## Группы", "", ...list);
        else lines.splice(heading + 1, 0, "", ...list);
      }
      return `${lines.join("\n")}\n\n`;
    })
    .join("");
}

/** Rule text for the language: the description, plus the `## <lang>` section. */
export function ruleText(rule: Rule, lang: Lang): string {
  const kept: string[] = [];
  let skip = false;
  for (const line of rule.body.split("\n")) {
    const section = /^## ([a-z]{2})$/.exec(line);
    if (section) skip = section[1] !== lang;
    else if (line.startsWith("## ")) skip = false;
    if (!skip) kept.push(line);
  }
  // A left-out section leaves blank lines behind at the end.
  while (kept.length > 0 && kept.at(-1)?.trim() === "") kept.pop();
  return kept.map((line) => (line.trim() === "" ? "" : line)).join("\n");
}

/** Plain rules and groups to run, one per line, as "<preset> <number> <title>: <IDs>". */
export function groupLines(planned: Plan): string[] {
  return [
    // Plain rules come first, on one line with "-" for the preset and the number.
    ...(planned.plain.length > 0 ? [`- - Отдельные правила: ${planned.plain.join(" ")}`] : []),
    ...planned.groups.map(
      (group) => `${group.preset} ${group.number} ${group.title}: ${group.rules.join(" ")}`,
    ),
  ];
}

/**
 * Mechanical checks of the kept rules that work for the language, one per line as
 * "<check>: <rule IDs>", in the order the rules run.
 */
export function checkLines(model: Model, lang: Lang, planned: Plan): string[] {
  const known = new Set(model.checks(lang));
  const byCheck = new Map<string, string[]>();
  for (const id of planned.kept) {
    for (const check of model.rules.get(id)?.checks ?? []) {
      if (!known.has(check)) continue;
      byCheck.set(check, [...(byCheck.get(check) ?? []), id]);
    }
  }
  return [...byCheck].map(([check, ids]) => `${check}: ${ids.join(" ")}`);
}

/** Problems where presets, rules and checks disagree. No problems means they agree. */
export function check(model: Model): string[] {
  const problems: string[] = [];
  const known = unique(langs.flatMap((lang) => model.checks(lang))).sort();
  const repeated = (items: string[]) =>
    unique(items.filter((item, i) => items.indexOf(item) !== i)).sort();

  for (const preset of model.presets.values()) {
    const { name } = preset;
    if (preset.id !== name) problems.push(`${name}: id does not match the file name`);
    if (preset.rules.length > 0 && preset.groups.length > 0) {
      problems.push(`${name}: has both rules and groups`);
    }
    for (const parent of preset.extends) {
      if (!isPreset(model, parent)) {
        problems.push(`${name}: extends unknown preset ${parent}`);
      } else if ((model.presets.get(parent)?.extends.length ?? 0) > 0) {
        problems.push(`${name}: extends ${parent}, which extends another preset`);
      }
    }
    const ids = presetRules(model, name);
    if (ids.length === 0) problems.push(`${name}: no rules`);
    for (const id of ids) {
      if (!model.rules.has(id)) problems.push(`${name}: no rule file for ${id}`);
    }
    const own = repeated([...preset.rules, ...preset.groups.flatMap((group) => group.rules)]);
    if (own.length > 0) problems.push(`${name}: lists ${own.join(" ")} more than once`);
  }

  for (const rule of model.rules.values()) {
    const { name } = rule;
    if (rule.languages.length === 0) problems.push(`${name}: no languages`);
    for (const lang of rule.languages) {
      if (!(langs as string[]).includes(lang)) problems.push(`${name}: unknown language ${lang}`);
    }
    const sections = rule.text
      .split("\n")
      .flatMap((line) => /^## ([a-z]{2})$/.exec(line)?.[1] ?? []);
    for (const lang of unique(sections).sort()) {
      if (!rule.languages.includes(lang)) {
        problems.push(`${name}: has a ## ${lang} section but does not list ${lang}`);
      }
    }
    const twice = repeated(sections);
    if (twice.length > 0) problems.push(`${name}: more than one ## section for ${twice.join(" ")}`);

    if (rule.id !== name) problems.push(`${name}: id does not match the file name`);

    // Rules stay independent: each one states its own boundaries by content.
    const others = unique(rule.body.match(/[A-Z]{2}[0-9]{3}/g) ?? [])
      .filter((id) => id !== name)
      .sort();
    if (others.length > 0) problems.push(`${name}: mentions other rules ${others.join(" ")}`);

    const { category } = rule;
    if (!model.categories.includes(category)) {
      problems.push(`${name}: category ${category || "is missing"} is not in categories.md`);
    }
    if (name.slice(0, 2) !== category.slice(0, 2).toUpperCase()) {
      problems.push(`${name}: prefix does not match category ${category}`);
    }

    for (const check of rule.checks) {
      if (!known.includes(check)) problems.push(`${name}: unknown check ${check}`);
    }
  }

  const used = new Set([...model.rules.values()].flatMap((rule) => rule.checks));
  const unused = known.filter((check) => !used.has(check));
  if (unused.length > 0) problems.push(`checks.ts: no rule names ${unused.join(" ")}`);

  const inFull = new Set(presetRules(model, "full"));
  const missing = [...model.rules.keys()].filter((id) => !inFull.has(id));
  if (missing.length > 0) problems.push(`full: missing ${missing.join(" ")}`);

  return problems;
}

const usage = `Usage: rules.ts <ru|en> [<selector>...]
       rules.ts <ru|en> --notes [<selector>...]
       rules.ts <ru|en> --groups [<selector>...]
       rules.ts <ru|en> --ids [<selector>...]
       rules.ts <ru|en> --checks [<selector>...]
       rules.ts --check

A selector is a preset name (recommended, light, prose, slop, full) or a rule ID such as GR003.
`;

function fail(message: string): never {
  process.stderr.write(message);
  process.exit(2);
}

function main(args: string[]): void {
  const model = loadModel(join(dirname(fileURLToPath(import.meta.url)), ".."));

  if (args[0] === "--check") {
    if (args.length !== 1) fail(usage);
    const problems = check(model);
    for (const problem of problems) console.log(problem);
    process.exitCode = problems.length > 0 ? 1 : 0;
    return;
  }

  const [lang, ...rest] = args;
  if (lang !== "ru" && lang !== "en") fail(usage);

  const modes = ["--notes", "--groups", "--ids", "--checks"];
  let mode = "rules";
  if (rest[0]?.startsWith("-")) {
    if (!modes.includes(rest[0])) fail(usage);
    mode = rest.shift() ?? mode;
  }

  const selectors = rest.length > 0 ? rest : ["recommended"];
  for (const selector of selectors) {
    if (!isRule(model, selector) && !isPreset(model, selector)) {
      fail(`Unknown selector: ${selector}\n`);
    }
  }

  const planned = plan(model, lang, selectors);
  const asLines = (lines: string[]) => lines.map((line) => `${line}\n`).join("");
  let out: string;
  switch (mode) {
    case "--notes":
      out = notes(model, selectors);
      break;
    case "--groups":
      out = asLines(groupLines(planned));
      break;
    case "--ids":
      out = asLines(planned.kept);
      break;
    case "--checks":
      out = asLines(checkLines(model, lang, planned));
      break;
    default:
      out =
        notes(model, selectors) +
        planned.kept
          .flatMap((id) => model.rules.get(id) ?? [])
          .map((rule) => `${ruleText(rule, lang)}\n\n`)
          .join("");
  }
  if (planned.skipped.length > 0) {
    out += `Not checked for ${lang}: ${planned.skipped.join(" ")}\n`;
  }
  process.stdout.write(out);
}

// Runs only as a script, so tests can import the functions. The skill directory is
// often a symlink, hence realpath.
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(process.argv[1]) === self) main(process.argv.slice(2));
