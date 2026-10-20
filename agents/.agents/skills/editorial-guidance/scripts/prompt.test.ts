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
import { checksFor } from "./checks.ts";
import { checkResults, contextFiles, type Doc, guessLang, projectGlossary } from "./prompt.ts";
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
  checks: checksFor,
};

const doc = (text: string, fromChat = false): Doc => ({ file: "/t/a.md", text, lang: "ru", fromChat });

test("the language follows the letters of the prose, code aside", () => {
  assert.equal(guessLang("Текст про `SomeLongClassName` и API.\n"), "ru");
  assert.equal(guessLang("Text about the сервис.\n```\nкод на русском\n```\n"), "en");
});

test("check results name their rules and list clean checks in one line", () => {
  const out = checkResults(model, ["GR003", "GR001"], doc("Раз — два.\n"));
  assert.match(out, /## connectors \(GR003\)\n\n.+\n\n1: …Раз — два\.…/);
  assert.match(out, /Без находок: ellipsis \(GR001\)\.$/);
});

test("chat text skips the checks that need a real file", () => {
  assert.equal(checkResults(model, ["ST003"], doc("[a](gone.md)\n", true)), "");
});

test("a long check output is cut with a pointer to the full one", () => {
  const text = Array.from({ length: 45 }, (_, i) => `Строка ${i} — тире.`).join("\n");
  const out = checkResults(model, ["GR003"], doc(text));
  assert.match(out, /…ещё 5 строк\. Весь вывод: `\/.+\/scripts\/checks\.ts connectors \/t\/a\.md`/);
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

test("the glossary goes only to the single flow on Russian text", () => {
  const names = (lang: "ru" | "en", flow: "single" | "parallel", fix: boolean) =>
    contextFiles(lang, flow, fix, ["/g/a.md"]).map((file) => file.replace(/^.*\/references\//, ""));
  assert.deepEqual(names("ru", "single", true), ["flows/single.md", "report.md", "fix.md", "/g/a.md"]);
  assert.deepEqual(names("en", "single", false), ["flows/single.md", "report.md"]);
  assert.deepEqual(names("ru", "parallel", false), ["flows/parallel.md", "report.md", "subagent-prompt.md"]);
});
