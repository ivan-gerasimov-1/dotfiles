/**
 * Glossaries: the common one of the skill and the project one a repository names.
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
 * Splits a list of terms on commas and slashes outside inline code, without quotes,
 * backticks and end dots.
 */
function splitTerms(list: string): string[] {
  return (list.match(/(?:`[^`]*`|[^,/`])+/g) ?? [])
    .map((term) => term.replace(/[«»`*]/g, "").replace(/\.$/, "").trim())
    .filter((term) => term !== "");
}

/**
 * Terms a glossary list item stands for: the terms before its ` — `, or the list after
 * a bold label, with the terms in brackets there.
 */
function headTerms(item: string): string[] {
  const label = /^\*\*[^*]+\*\*\s*/.exec(item);
  const head = label
    ? (item.slice(label[0].length).split(/\.(?:\s|$)/)[0] ?? "")
    : (item.split(" — ")[0] ?? "");
  const brackets = [...head.matchAll(/\(([^)]*)\)/g)].flatMap((match) => splitTerms(match[1] ?? ""));
  return [...splitTerms(head.replace(/\([^)]*\)/g, "")), ...brackets];
}

/** A list item without its marker, on one line. */
function itemText(entry: string): string {
  return entry.replace(/^\s*-\s+/, "").replace(/\s+/g, " ");
}

/**
 * Terms a glossary entry names. A table row names the terms of its first cell. A list
 * item names its head terms and every «quoted» word: those are the translations the
 * entry forbids.
 */
export function entryTerms(entry: string): string[] {
  if (entry.startsWith("|")) {
    const first = entry.split("|")[1] ?? "";
    return splitTerms(first.replace(/\([^)]*\)/g, ""));
  }

  const item = itemText(entry);
  const quoted = [...item.matchAll(/«([^»]+)»/g)].map((match) => match[1] ?? "");
  return [...headTerms(item), ...quoted];
}

/**
 * Terms the list items of a glossary keep as they are: what not to translate and the
 * accepted calques. The «Заменять» table names terms to replace, so it is left out.
 */
export function keptTerms(text: string): string[] {
  let replace = false;
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) replace = line.trim() === "## Заменять";
    if (!replace && /^\s*-\s/.test(line)) out.push(...headTerms(itemText(line)));
  }
  return out;
}

/** A glossary section: its heading, or none for the text above the first one, and its lines. */
type Section = {
  level: number;
  lines: string[];
  /** The section has list items or table rows of its own. */
  entries: boolean;
  /** One of them stays. */
  hits: boolean;
  kept: boolean;
};

/**
 * The glossary cut to the text: a list item or a table row stays when the text mentions
 * one of its terms, and a table keeps its header while a row stays. A section whose
 * entries all go is left out with its heading, and so is a heading with nothing left
 * under it. Text outside lists and tables stays.
 */
export function excerpt(glossary: string, mentioned: (term: string) => boolean): string {
  const newSection = (level: number, lines: string[]): Section =>
    ({ level, lines, entries: false, hits: false, kept: false });
  const sections = [newSection(0, [])];
  for (const line of glossary.split("\n")) {
    const heading = /^(#+) /.exec(line);
    if (heading) sections.push(newSection(heading[1]?.length ?? 0, [line]));
    else sections.at(-1)?.lines.push(line);
  }

  for (const section of sections) {
    const out: string[] = [];
    let table: string[] = [];
    let item: string[] = [];

    const flushItem = () => {
      if (item.length === 0) return;
      section.entries = true;
      if (entryTerms(item.join("\n")).some(mentioned)) {
        section.hits = true;
        out.push(...item);
      }
      item = [];
    };
    const flushTable = () => {
      if (table.length === 0) return;
      const [head = "", separator = "", ...rows] = table;
      const keptRows = rows.filter((row) => entryTerms(row).some(mentioned));
      section.entries ||= rows.length > 0;
      if (keptRows.length > 0) {
        section.hits = true;
        out.push(head, separator, ...keptRows);
      }
      table = [];
    };

    for (const line of section.lines) {
      if (line.startsWith("|")) {
        flushItem();
        table.push(line);
        continue;
      }
      flushTable();
      if (/^\s*-\s/.test(line)) {
        flushItem();
        item.push(line);
      } else if (/^\s+\S/.test(line) && item.length > 0) {
        item.push(line);
      } else {
        flushItem();
        out.push(line);
      }
    }
    flushItem();
    flushTable();

    section.lines = out;
  }

  // From the end, so a heading knows whether anything under it stays.
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i];
    if (!section) continue;
    const ownText = section.lines.slice(section.level > 0 ? 1 : 0).some((line) => line.trim() !== "");
    let child = false;
    for (const next of sections.slice(i + 1)) {
      if (next.level <= section.level) break;
      child ||= next.kept;
    }
    section.kept = section.level === 0 || (section.entries ? section.hits : ownText) || child;
  }

  const lines = sections.filter((section) => section.kept).flatMap((section) => section.lines);
  return lines
    .filter((line, i) => line.trim() !== "" || (i > 0 && lines[i - 1]?.trim() !== ""))
    .join("\n")
    .trim();
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
