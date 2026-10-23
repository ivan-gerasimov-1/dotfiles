/**
 * Unit tests for rules.ts on a small made-up model, so they do not depend on
 * the real presets and rules.
 *
 * Usage: node --test scripts/rules.test.ts
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  check,
  checkRules,
  fixNotes,
  groupLines,
  loadModel,
  type Model,
  notes,
  plan,
  type Preset,
  type Rule,
  ruleText,
} from "./rules.ts";

function rule(id: string, fields: Partial<Rule> = {}): Rule {
  const body = fields.body ?? `# ${id}`;
  return {
    name: id,
    id,
    category: "grammar",
    languages: ["ru", "en"],
    checks: [],
    glossary: false,
    body,
    text: `---\nid: ${id}\n---\n\n${body}\n`,
    ...fields,
  };
}

function preset(name: string, fields: Partial<Preset> = {}): Preset {
  return { name, id: name, rules: [], groups: [], extends: [], body: `# ${name}`, ...fields };
}

function model(presets: Preset[], rules: Rule[], fixes: [string, string][] = []): Model {
  return {
    presets: new Map(presets.map((p) => [p.name, p])),
    fixes: new Map(fixes),
    rules: new Map(rules.map((r) => [r.name, r])),
    categories: ["grammar", "terms"],
    checks: (lang) => (lang === "ru" ? ["latin", "connectors"] : ["connectors"]),
  };
}

const base = model(
  [
    preset("base", { groups: [{ title: "Base", rules: ["GR001", "GR002"] }] }),
    preset("child", {
      extends: ["base"],
      groups: [{ title: "Own", rules: ["GR003"] }],
    }),
    preset("flat", { rules: ["GR004", "GR002", "GR005"] }),
    preset("article", { extends: ["base", "flat"], groups: [{ title: "Rest", rules: ["GR003"] }] }),
  ],
  [
    rule("GR001", { checks: ["connectors"] }),
    rule("GR002", { languages: ["ru"], checks: ["latin"] }),
    rule("GR003", { checks: ["connectors", "latin"] }),
    rule("GR004"),
    rule("GR005", { languages: ["ru"] }),
  ],
);

test("own groups run before inherited ones", () => {
  assert.deepEqual(groupLines(plan(base, "ru", ["child"])), [
    "child 1 Own: GR003",
    "base 1 Base: GR001 GR002",
  ]);
});

test("plain rules run first, named rule IDs before the presets' rules", () => {
  const planned = plan(base, "ru", ["flat", "GR001"]);
  assert.deepEqual(planned.plain, ["GR001", "GR004", "GR002", "GR005"]);
  assert.deepEqual(planned.kept, ["GR001", "GR004", "GR002", "GR005"]);
});

test("a group runs once and a plain rule drops out when a group holds it", () => {
  const planned = plan(base, "ru", ["child", "base", "flat", "GR003"]);
  assert.deepEqual(groupLines(planned), [
    "- - Отдельные правила: GR004 GR005",
    "child 1 Own: GR003",
    "base 1 Base: GR001 GR002",
  ]);
});

test("the language cuts groups and plain rules, and a named rule gets a note", () => {
  const planned = plan(base, "en", ["base", "flat", "GR005"]);
  assert.deepEqual(planned.plain, ["GR004"]);
  assert.deepEqual(groupLines(planned), ["- - Отдельные правила: GR004", "base 1 Base: GR001"]);
  assert.deepEqual(planned.skipped, ["GR005"]);
});

test("checks follow the run order and only those of the language", () => {
  const ids = (lang: "ru" | "en") => plan(base, lang, ["child"]).kept;
  assert.deepEqual(
    [...checkRules(base, "ru", ids("ru"))],
    [
      ["connectors", ["GR003", "GR001"]],
      ["latin", ["GR003", "GR002"]],
    ],
  );
  assert.deepEqual([...checkRules(base, "en", ids("en"))], [["connectors", ["GR003", "GR001"]]]);
});

test("notes print each preset once, parents first, with its groups", () => {
  const withHeading = model(
    [
      preset("base", {
        body: "# base\n\n## Группы\n\n## Оценка",
        groups: [{ title: "Base", rules: ["GR001", "GR002"] }],
      }),
      preset("child", { extends: ["base"] }),
    ],
    [],
  );
  assert.equal(
    notes(withHeading, ["child", "base"]),
    "# base\n\n## Группы\n\n1. Base: GR001, GR002\n\n## Оценка\n\n# child",
  );
  assert.equal(notes(base, ["base"]), "# base\n\n## Группы\n\n1. Base: GR001, GR002");
});

test("fix notes follow the order of notes and skip presets without a fix file", () => {
  const withFixes = model(
    [preset("base"), preset("plain"), preset("child", { extends: ["base", "plain"] })],
    [],
    [
      ["child", "# Правка пресета child"],
      ["base", "# Правка пресета base"],
    ],
  );
  assert.equal(fixNotes(withFixes, ["child", "base"]), "# Правка пресета base\n\n# Правка пресета child");
  assert.equal(fixNotes(withFixes, ["plain"]), "");
});

test("a fix file is loaded next to its preset, not as a preset", () => {
  const root = mkdtempSync(join(tmpdir(), "editorial-test-"));
  mkdirSync(join(root, "references/presets"), { recursive: true });
  mkdirSync(join(root, "references/rules"));
  writeFileSync(join(root, "references/categories.md"), "---\ncategories: [grammar]\n---\n");
  writeFileSync(join(root, "references/presets/base.md"), "---\nid: base\n---\n\n# base\n");
  writeFileSync(join(root, "references/presets/base.fix.md"), "# Правка пресета base\n");

  const loaded = loadModel(root);
  assert.deepEqual([...loaded.presets.keys()], ["base"]);
  assert.deepEqual([...loaded.fixes], [["base", "# Правка пресета base"]]);
});

test("rule text keeps the description and the section of the language", () => {
  const text = rule("GR001", { body: "# GR001\n\nDescription.\n\n## ru\n\nПример.\n\n## en\n\nExample." });
  assert.equal(ruleText(text, "ru"), "# GR001\n\nDescription.\n\n## ru\n\nПример.");
  assert.equal(ruleText(text, "en"), "# GR001\n\nDescription.\n\n## en\n\nExample.");
});

test("check passes on an agreeing model", () => {
  const agreeing = model(
    [preset("article", { rules: ["GR001", "TE001"] })],
    [rule("GR001", { checks: ["connectors"] }), rule("TE001", { category: "terms", checks: ["latin"] })],
  );
  assert.deepEqual(check(agreeing), []);
});

test("check reports where presets, rules and checks disagree", () => {
  const broken = model(
    [
      preset("article", { rules: ["GR001", "GR001", "XX001"], groups: [{ title: "G", rules: ["GR002"] }] }),
      preset("odd", { id: "other", extends: ["article", "nope"], body: "# odd\n\n## Правка\n" }),
    ],
    [
      rule("GR001", { body: "# GR001\n\nНе путать с TE001. Гибриды из глоссария." }),
      rule("GR002", { languages: [], category: "terms" }),
      rule("GR003", { text: "---\nid: GR003\n---\n\n## de\n\n## ru\n\n## ru\n", checks: ["nope"] }),
    ],
    [["gone", "# Правка пресета gone"]],
  );
  assert.deepEqual(check(broken), [
    "article: has both rules and groups",
    "article: no rule file for XX001",
    "article: lists GR001 more than once",
    "odd: id does not match the file name",
    "odd: extends unknown preset nope",
    "odd: no rule file for XX001",
    "odd: has editing text, move it to odd.fix.md",
    "gone.fix.md: no preset gone",
    "GR001: mentions other rules TE001",
    "GR001: mentions the glossary but has no glossary: true",
    "GR002: no languages",
    "GR002: prefix does not match category terms",
    "GR003: has a ## de section but does not list de",
    "GR003: more than one ## section for ru",
    "GR003: unknown check nope",
    "checks.ts: no rule names connectors latin",
  ]);
});
