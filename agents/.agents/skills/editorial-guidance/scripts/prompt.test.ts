/**
 * Unit tests for prompt.ts on a small made-up model.
 *
 * Usage: node --test scripts/prompt.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { checksFor } from "./checks.ts";
import { checkResults, contextFiles, type Doc, glossaries, guessLang } from "./prompt.ts";
import type { Model, Rule } from "./rules.ts";

function rule(id: string, checks: string[]): Rule {
  return { name: id, id, category: "grammar", languages: ["ru", "en"], checks, glossary: false, body: `# ${id}`, text: "" };
}

const model: Model = {
  presets: new Map(),
  fixes: new Map(),
  rules: new Map([
    ["GR001", rule("GR001", ["ellipsis"])],
    ["GR003", rule("GR003", ["connectors"])],
    ["ST003", rule("ST003", ["links"])],
  ]),
  categories: ["grammar"],
  checks: checksFor,
};

const doc = (text: string, fromChat = false): Doc => ({
  file: "/t/a.md",
  text,
  lang: "ru",
  fromChat,
  glossary: [],
});

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

test("what is not checked goes only to the single flow", () => {
  const names = (flow: "single" | "parallel", fix: boolean) =>
    contextFiles(flow, fix).map((file) => file.replace(/^.*\/references\//, ""));
  assert.deepEqual(names("single", true), [
    "flows/single.md",
    "report.md",
    "fix/common.md",
    "fix/single.md",
    "scope.md",
  ]);
  assert.deepEqual(names("single", false), ["flows/single.md", "report.md", "scope.md"]);
  assert.deepEqual(names("parallel", true), [
    "flows/parallel.md",
    "report.md",
    "fix/common.md",
    "fix/parallel.md",
    "subagent-prompt.md",
  ]);
});

test("the glossary goes only with the rules that read it, cut to the text", () => {
  const reader = { ...rule("TE001", []), glossary: true };
  assert.deepEqual(glossaries([rule("GR003", [])], doc("Деплой в пятницу.\n")), []);

  const out = glossaries([reader], doc("Деплой в пятницу, PR открыт.\n")).join("\n\n");
  assert.match(out, /деплой/);
  assert.match(out, /PR/);
  assert.doesNotMatch(out, /пайплайн —/);
  assert.doesNotMatch(out, /## Заменять/);
});
