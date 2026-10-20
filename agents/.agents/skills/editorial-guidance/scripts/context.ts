#!/usr/bin/env node
/**
 * Prints what a check needs besides presets and rules, so an agent reads it in one call:
 * the flow, the report template, the edit rules with --fix and then,
 * for the single flow on Russian text, the common glossary,
 * for the parallel flow, the subagent prompt.
 *
 * Usage: context.ts <ru|en> <single|parallel> [--fix]
 * Exit code 2 means bad usage.
 *
 * Needs Node 22.18+ to run TypeScript without a build step.
 */

import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { body } from "./rules.ts";

const usage = "Usage: context.ts <ru|en> <single|parallel> [--fix]\n";

/** Files to print, as paths under references/, in order. */
export function contextFiles(
  lang: "ru" | "en",
  flow: "single" | "parallel",
  fix: boolean,
  glossary: string[],
): string[] {
  return [
    `flows/${flow}.md`,
    "report.md",
    ...(fix ? ["fix.md"] : []),
    // Subagents read the glossary and the English reading themselves.
    ...(flow === "parallel" ? ["subagent-prompt.md"] : []),
    // The common glossary covers Russian text, so English skips it.
    ...(flow === "single" && lang === "ru" ? glossary.map((file) => `glossary/${file}`) : []),
  ];
}

/** The context texts, each followed by a blank line. */
export function context(
  refs: string,
  lang: "ru" | "en",
  flow: "single" | "parallel",
  fix: boolean,
): string {
  const glossary = readdirSync(join(refs, "glossary"))
    .filter((file) => file.endsWith(".md"))
    .sort();
  return contextFiles(lang, flow, fix, glossary)
    .map((file) => `${body(readFileSync(join(refs, file), "utf8"))}\n\n`)
    .join("");
}

function main(args: string[]): void {
  const [lang, flow, fix] = args;
  if (
    (args.length !== 2 && args.length !== 3) ||
    (lang !== "ru" && lang !== "en") ||
    (flow !== "single" && flow !== "parallel") ||
    (fix !== undefined && fix !== "--fix")
  ) {
    process.stderr.write(usage);
    process.exit(2);
  }

  process.stdout.write(context(join(dirname(self), "../references"), lang, flow, fix === "--fix"));
}

// Runs only as a script, so tests can import the functions. The skill directory is
// often a symlink, hence realpath.
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(process.argv[1]) === self) main(process.argv.slice(2));
