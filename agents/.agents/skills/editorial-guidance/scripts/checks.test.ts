/**
 * Unit tests for checks.ts on short made-up texts.
 *
 * Usage: node --test scripts/checks.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checksFor,
  connectors,
  contrast,
  ellipsis,
  fileLines,
  hybrids,
  latin,
  links,
  longSentences,
  prose,
  variants,
  words,
} from "./checks.ts";

test("prose skips frontmatter and code blocks, indented fences too, and drops inline code", () => {
  const text = "---\nid: x\n---\nТекст `код` здесь.\n  ```js\nconst a = 1;\n  ```\nПосле.\n";
  assert.deepEqual(prose(text), [
    { n: 4, text: "Текст  здесь." },
    { n: 8, text: "После." },
  ]);
});

test("English text gets only the checks that read any language", () => {
  assert.deepEqual(checksFor("en"), [
    "connectors",
    "ellipsis",
    "long-sentences",
    "file-lines",
    "links",
  ]);
});

test("hybrids start at a word boundary, Cyrillic letters count as word characters", () => {
  // «Яsync» has no boundary before «s», though an ASCII \b would see one there.
  assert.deepEqual(hybrids("sync-пайплайн, cartСессия, пайплайнsync, Яsync-пайплайн.\n"), [
    "1: sync-пайплайн",
    "1: пайплайнsync",
  ]);
});

test("latin counts words longer than two letters, most frequent first", () => {
  assert.deepEqual(latin("Order и order, Order.\nКлюч PD-123 в Jira, ок.\n"), [
    "   2 Order (1)",
    "   1 Jira (2)",
    "   1 PD-123 (2)",
    "   1 order (1)",
  ]);
});

test("variants lists a concept written in two or more forms", () => {
  assert.deepEqual(variants("Бэкенд и бэку.\nbackend, бэкап и фронтенд.\n"), [
    "бэкенд: backend (2); бэк (1); бэкенд (1)",
  ]);
});

test("connectors skip the bold label dash, the list-item semicolon and short table cells", () => {
  const text = [
    "- **Метка** — пояснение; ещё;",
    "| коротко — да | раз два три четыре пять шесть — семь |",
    "# Заголовок — нет",
    "A vs B — выбрать.",
  ].join("\n");
  assert.deepEqual(connectors(text), [
    "1: …пояснение; ещё…",
    "2: …четыре пять шесть — семь …",
  ]);
});

test("ellipsis skips tables", () => {
  assert.deepEqual(ellipsis("| a… |\nИ так...\n"), ["2: И так..."]);
});

test("long sentences span lines and report the line they start on", () => {
  const long = Array.from({ length: 26 }, (_, i) => `слово${i}`);
  const text = `Короткое. ${long.slice(0, 10).join(" ")}\n${long.slice(10).join(" ")}.\n`;
  assert.deepEqual(longSentences(text), [`1: 26 words: ${long.join(" ")}.`]);
});

test("file-lines reads inline code", () => {
  assert.deepEqual(fileLines("См. `OrderService.ts:123`, но не v1.2:3.\n"), [
    "1: См. `OrderService.ts:123`, но не v1.2:3.",
  ]);
});

test("links report missing relative targets only", () => {
  const exists = (path: string) => path === "/doc/here.md";
  assert.deepEqual(
    links("[a](here.md#x) [b](gone.md) [c](#top) [d](https://x.y) [e](MAILTO:a@b.c)\n", "/doc", exists),
    ["1: gone.md"],
  );
});

test("contrast finds constructions across line breaks and skips «а также», «а значит»", () => {
  const text = "---\nt: не A, а B\n---\nЭто кэш,\nа не база. Не сразу, а потом.\nНе только X, а также Y.\n";
  assert.deepEqual(contrast(text), [
    "4: …Это кэш, а не база. Не сразу,…",
    "5: …база. Не сразу, а потом.…",
  ]);
});

test("words count prose words only", () => {
  assert.equal(words("---\nid: x\n---\n# Заголовок\n|---|---|\n- **Два** слова `код`\n"), 4);
});
