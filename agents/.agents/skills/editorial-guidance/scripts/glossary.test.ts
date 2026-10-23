/**
 * Unit tests for glossary.ts.
 *
 * Usage: node --test scripts/glossary.test.ts
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { entryTerms, excerpt, keptTerms, projectGlossary, replacements } from "./glossary.ts";

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

test("replacements read the «Заменять» table, terms split and notes in brackets dropped", () => {
  const text = [
    "# Глоссарий",
    "## Не переводить",
    "| Термин | Почему |",
    "|---|---|",
    "| owner | нет |",
    "## Заменять",
    "",
    "| Термин | Замена |",
    "|---|---|",
    "| бэк, backend | «бэкенд» |",
    "| compile-time / runtime (в тексте) | «на этапе компиляции» |",
    "## Допустимые кальки",
    "| деплой | да |",
  ].join("\n");
  assert.deepEqual(replacements(text), [
    { terms: ["бэк", "backend"], replacement: "«бэкенд»" },
    { terms: ["compile-time", "runtime"], replacement: "«на этапе компиляции»" },
  ]);
});

test("an entry names its head terms, the bracketed ones and the forbidden translations", () => {
  assert.deepEqual(entryTerms("- скилл / скиллы (SKILL.md) — пакет. Не переводить как «навык»."), [
    "скилл",
    "скиллы",
    "SKILL.md",
    "навык",
  ]);
  assert.deepEqual(entryTerms("- **Аббревиатуры:** DTO, API. Не переводятся."), ["DTO", "API"]);
  assert.deepEqual(entryTerms("| бэк, backend (слой) | «бэкенд» |"), ["бэк", "backend"]);
  assert.deepEqual(entryTerms("- **Типы:** `Record<K, V>`, `src/a.ts`."), ["Record<K, V>", "src/a.ts"]);
});

test("the excerpt keeps mentioned entries and drops sections left empty", () => {
  const text = [
    "# Глоссарий",
    "",
    "Не правится.",
    "",
    "## Не переводить",
    "",
    "### Разработка",
    "",
    "- деплой — термин.",
    "- пайплайн — термин.",
    "",
    "### Роли",
    "",
    "- SDET — роль.",
    "",
    "## Заменять",
    "",
    "| Термин | Замена |",
    "|---|---|",
    "| owner | «владелец» |",
    "| бэк | «бэкенд» |",
    "",
    "## Допустимые кальки",
    "",
    "Находкой не считаются.",
    "",
    "- «источник истины» (source of truth).",
  ].join("\n");
  const mentioned = (term: string) => ["деплой", "owner"].includes(term);
  assert.equal(
    excerpt(text, mentioned),
    [
      "# Глоссарий",
      "",
      "Не правится.",
      "",
      "## Не переводить",
      "",
      "### Разработка",
      "",
      "- деплой — термин.",
      "",
      "## Заменять",
      "",
      "| Термин | Замена |",
      "|---|---|",
      "| owner | «владелец» |",
    ].join("\n"),
  );
});

test("kept terms come from the lists, not from the «Заменять» table", () => {
  const text = "## Не переводить\n- namespace — термин.\n## Заменять\n| owner | «владелец» |\n- runtime — нет.\n";
  assert.deepEqual(keptTerms(text), ["namespace"]);
});
