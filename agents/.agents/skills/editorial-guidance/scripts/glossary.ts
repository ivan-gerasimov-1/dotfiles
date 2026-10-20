/**
 * Glossaries: the common one of the skill and the project one a repository names.
 *
 * Needs Node 22.18+ to run TypeScript without a build step.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** A row of a «Заменять» table: the terms of the left column and what replaces them. */
export type Replacement = { terms: string[]; replacement: string };

const refs = join(dirname(dirname(fileURLToPath(import.meta.url))), "references");

/** The .md files of a directory, sorted. */
export function markdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => join(dir, file));
}

/** Files of the common glossary, which covers Russian text. */
export function commonGlossary(): string[] {
  return markdownFiles(join(refs, "glossary"));
}

/**
 * Files of the project glossary: the path on an `editorial-guidance glossary: <path>`
 * line in the nearest AGENTS.md or CLAUDE.md above a start directory. The first start
 * directory that finds one wins. A directory means every .md file in it.
 */
export function projectGlossary(starts: string[]): string[] {
  for (const start of starts) {
    for (let dir = start; ; dir = dirname(dir)) {
      for (const name of ["AGENTS.md", "CLAUDE.md"]) {
        const file = join(dir, name);
        if (!existsSync(file)) continue;

        const line = /^`?editorial-guidance glossary: *([^`\s]+)`?\s*$/m.exec(readFileSync(file, "utf8"));
        if (!line?.[1]) continue;

        const path = resolve(dir, line[1]);
        const stat = statSync(path, { throwIfNoEntry: false });
        if (stat?.isFile()) return [path];
        if (stat?.isDirectory()) return markdownFiles(path);
        return [];
      }

      if (dirname(dir) === dir) break;
    }
  }

  return [];
}

/**
 * Rows of the «Заменять» table of a glossary. The left column lists terms split by
 * commas and slashes; a note in brackets after a term is dropped.
 */
export function replacements(text: string): Replacement[] {
  const out: Replacement[] = [];
  let inside = false;
  let row = 0;

  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      inside = line.trim() === "## Заменять";
      row = 0;
      continue;
    }
    if (!inside || !line.startsWith("|") || /^\|[\s:|-]+\|$/.test(line.trim())) continue;

    // The first row is the table header.
    if (row++ === 0) continue;

    const [left = "", replacement = ""] = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const terms = left
      .replace(/\([^)]*\)/g, "")
      .split(/[,/]/)
      .map((term) => term.trim())
      .filter((term) => term !== "");
    if (terms.length > 0) out.push({ terms, replacement });
  }

  return out;
}
