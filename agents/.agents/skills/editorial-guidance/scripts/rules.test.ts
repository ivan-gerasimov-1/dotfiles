/**
 * Unit tests for rules.ts on a small made-up model, so they do not depend on
 * the real presets and rules.
 *
 * Usage: node --test scripts/
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  check,
  checkLines,
  groupLines,
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
    body,
    text: `---\nid: ${id}\n---\n\n${body}\n`,
    ...fields,
  };
}

function preset(name: string, fields: Partial<Preset> = {}): Preset {
  return { name, id: name, rules: [], groups: [], extends: [], body: `# ${name}`, ...fields };
}

function model(presets: Preset[], rules: Rule[]): Model {
  return {
    presets: new Map(presets.map((p) => [p.name, p])),
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
    preset("full", { extends: ["base", "flat"], groups: [{ title: "Rest", rules: ["GR003"] }] }),
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
  assert.deepEqual(checkLines(base, "ru", plan(base, "ru", ["child"])), [
    "connectors: GR003 GR001",
    "latin: GR003 GR002",
  ]);
  assert.deepEqual(checkLines(base, "en", plan(base, "en", ["child"])), [
    "connectors: GR003 GR001",
  ]);
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
    "# base\n\n## Группы\n\n1. Base: GR001, GR002\n\n## Оценка\n\n# child\n\n",
  );
  assert.equal(
    notes(base, ["base"]),
    "# base\n\n## Группы\n\n1. Base: GR001, GR002\n\n",
  );
});

test("rule text keeps the description and the section of the language", () => {
  const text = rule("GR001", { body: "# GR001\n\nDescription.\n\n## ru\n\nПример.\n\n## en\n\nExample." });
  assert.equal(ruleText(text, "ru"), "# GR001\n\nDescription.\n\n## ru\n\nПример.");
  assert.equal(ruleText(text, "en"), "# GR001\n\nDescription.\n\n## en\n\nExample.");
});

test("check passes on an agreeing model", () => {
  const agreeing = model(
    [preset("full", { rules: ["GR001", "TE001"] })],
    [rule("GR001", { checks: ["connectors"] }), rule("TE001", { category: "terms", checks: ["latin"] })],
  );
  assert.deepEqual(check(agreeing), []);
});

test("check reports where presets, rules and checks disagree", () => {
  const broken = model(
    [
      preset("full", { rules: ["GR001", "GR001", "XX001"], groups: [{ title: "G", rules: ["GR002"] }] }),
      preset("odd", { id: "other", extends: ["full", "nope"] }),
    ],
    [
      rule("GR001", { body: "# GR001\n\nНе путать с TE001." }),
      rule("GR002", { languages: [], category: "terms" }),
      rule("GR003", { text: "---\nid: GR003\n---\n\n## de\n\n## ru\n\n## ru\n", checks: ["nope"] }),
    ],
  );
  assert.deepEqual(check(broken), [
    "full: has both rules and groups",
    "full: no rule file for XX001",
    "full: lists GR001 more than once",
    "odd: id does not match the file name",
    "odd: extends unknown preset nope",
    "odd: no rule file for XX001",
    "GR001: mentions other rules TE001",
    "GR002: no languages",
    "GR002: prefix does not match category terms",
    "GR003: has a ## de section but does not list de",
    "GR003: more than one ## section for ru",
    "GR003: unknown check nope",
    "checks.sh: no rule names connectors latin",
    "full: missing GR003",
  ]);
});
