/**
 * Unit tests for prompt.ts on a small made-up model.
 *
 * Usage: node --test scripts/prompt.test.ts
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkResults, guessLang, projectGlossary } from "./prompt.ts";
import type { Model, Rule } from "./rules.ts";

function rule(id: string, checks: string[]): Rule {
  return { name: id, id, category: "grammar", languages: ["ru", "en"], checks, body: `# ${id}`, text: "" };
}

const model: Model = {
  presets: new Map(),
  rules: new Map([
    ["GR001", rule("GR001", ["ellipsis"])],
    ["GR003", rule("GR003", ["connectors"])],
    ["ST003", rule("ST003", ["links"])],
  ]),
  categories: ["grammar"],
  checks: () => [],
};

test("the language follows the letters of the prose, code aside", () => {
  assert.equal(guessLang("Текст про `SomeLongClassName` и API.\n"), "ru");
  assert.equal(guessLang("Text about the сервис.\n```\nкод на русском\n```\n"), "en");
});

test("check results name their rules and list clean checks in one line", () => {
  const out = checkResults(model, "ru", ["GR003", "GR001"], "Раз — два.\n", "/t/a.md", false, "/s");
  assert.match(out, /## connectors \(GR003\)\n\n.+\n\n1: …Раз — два\.…/);
  assert.match(out, /Без находок: ellipsis \(GR001\)\.$/);
});

test("chat text skips the checks that need a real file", () => {
  assert.equal(checkResults(model, "ru", ["ST003"], "[a](gone.md)\n", "/t/a.md", true, "/s"), "");
});

test("a long check output is cut with a pointer to the full one", () => {
  const text = Array.from({ length: 45 }, (_, i) => `Строка ${i} — тире.`).join("\n");
  const out = checkResults(model, "ru", ["GR003"], text, "/t/a.md", false, "/s");
  assert.match(out, /…ещё 5 строк\. Весь вывод: `\/s\/scripts\/checks\.ts connectors \/t\/a\.md`/);
});

test("the project glossary comes from the nearest instructions file that names one", () => {
  const root = mkdtempSync(join(tmpdir(), "editorial-test-"));
  try {
    mkdirSync(join(root, "glossary"));
    mkdirSync(join(root, "docs/deep"), { recursive: true });
    writeFileSync(join(root, "AGENTS.md"), "# Repo\n\neditorial-guidance glossary: glossary/\n");
    writeFileSync(join(root, "docs/CLAUDE.md"), "# Docs, no glossary line\n");
    writeFileSync(join(root, "glossary/b.md"), "");
    writeFileSync(join(root, "glossary/a.md"), "");
    writeFileSync(join(root, "glossary/notes.txt"), "");
    assert.deepEqual(projectGlossary([join(root, "docs/deep")]), [
      join(root, "glossary/a.md"),
      join(root, "glossary/b.md"),
    ]);
    assert.deepEqual(projectGlossary([tmpdir()]), []);
  } finally {
    rmSync(root, { recursive: true });
  }
});
