/**
 * Unit tests for context.ts.
 *
 * Usage: node --test scripts/context.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { contextFiles } from "./context.ts";

test("single flow on Russian text adds the glossary", () => {
  assert.deepEqual(contextFiles("ru", "single", true, ["a.md", "b.md"]), [
    "flows/single.md",
    "report.md",
    "fix.md",
    "glossary/a.md",
    "glossary/b.md",
  ]);
});

test("English text and the parallel flow skip the glossary", () => {
  assert.deepEqual(contextFiles("en", "single", false, ["a.md"]), ["flows/single.md", "report.md"]);
  assert.deepEqual(contextFiles("ru", "parallel", false, ["a.md"]), [
    "flows/parallel.md",
    "report.md",
    "subagent-prompt.md",
  ]);
});
