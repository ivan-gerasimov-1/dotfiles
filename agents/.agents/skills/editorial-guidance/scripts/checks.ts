#!/usr/bin/env node
/**
 * Mechanical checks for the editorial-guidance rules. A check prints candidates, one per
 * line, and the rule that names it decides. Rules name their checks in the `checks`
 * field of their frontmatter.
 *
 * Usage: checks.ts <check> file.md
 *
 * Empty output means no findings. Exit code is 0 either way; 2 means bad usage.
 *
 * Needs Node 22.18+ to run TypeScript without a build step.
 */

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { commonGlossary, projectGlossary, type Replacement, replacements } from "./glossary.ts";

export type Lang = "ru" | "en";

/** A prose line: its 1-based number in the file and its text. */
export type Line = { n: number; text: string };

type Check = {
  /** Reads the text, the path of its file and the paths of its glossaries. */
  run: (text: string, file: string, glossaries: string[]) => string[];
  /** Languages of the text the check reads. */
  langs: Lang[];
  /** What the check prints, in Russian, for the agent that reads its output. */
  description: string;
  /** Reads the file on disk, so text pasted in chat skips the check. */
  requiresFile?: boolean;
};

const checks: Record<string, Check> = {
  hybrids: {
    run: hybrids,
    langs: ["ru"],
    description: "Слова, где латиница склеена с кириллицей.",
  },
  latin: {
    run: latin,
    langs: ["ru"],
    description:
      "Латинские слова в прозе: число вхождений, слово, строки. По числу видно и имя кода, записанное по-разному.",
  },
  glossary: {
    run: (text, _file, glossaries) =>
      glossary(text, glossaries.flatMap((path) => replacements(readFileSync(path, "utf8")))),
    langs: ["ru"],
    description:
      "Термины из таблиц «Заменять» общего и проектного глоссариев, с заменой из таблицы. Пояснение в скобках у термина скрипт не учитывает, его проверяй чтением.",
  },
  connectors: {
    run: connectors,
    langs: ["ru", "en"],
    description:
      "Тире и точки с запятой в прозе и в прозаических ячейках таблиц. Заголовки, пункты «A vs B», заголовок в подбор с тире после него, точку с запятой в конце пункта списка и ячейки короче шести слов скрипт пропускает. Двоеточия он не ищет, их находят чтением.",
  },
  ellipsis: {
    run: ellipsis,
    langs: ["ru", "en"],
    description: "Многоточия вне таблиц.",
  },
  "long-sentences": {
    run: longSentences,
    langs: ["ru", "en"],
    description: "Предложения длиннее 25 слов.",
  },
  "file-lines": {
    run: fileLines,
    langs: ["ru", "en"],
    description: "Ссылки `file:line` в прозе и во встроенном коде.",
    requiresFile: true,
  },
  links: {
    run: (text, file) => links(text, dirname(file)),
    langs: ["ru", "en"],
    description: "Относительные ссылки на файлы и каталоги, которых нет. Якоря скрипт не проверяет.",
    requiresFile: true,
  },
  contrast: {
    run: contrast,
    langs: ["ru"],
    description: "Конструкции «X, а не Y» и «не X, а Y», в том числе разорванные переносом строки.",
  },
  "repeated-connectors": {
    run: repeatedConnectors,
    langs: ["ru"],
    description:
      "Связки, которые повторяются в одном абзаце или списке: первая строка абзаца, связка, число вхождений и их строки. «А», «тогда как» и «в то время как» считаются одной связкой «а». Обороты «а не», «а также», «а значит», «а именно» и союз «и» скрипт не считает.",
  },
};

function find(check: string): Check | undefined {
  return Object.hasOwn(checks, check) ? checks[check] : undefined;
}

/** The checks that work for text in the language. */
export function checksFor(lang: Lang): string[] {
  return Object.entries(checks)
    .filter(([, check]) => check.langs.includes(lang))
    .map(([name]) => name);
}

/** Output lines of a check, or null when there is no such check. */
export function run(check: string, text: string, file: string, glossaries: string[]): string[] | null {
  return find(check)?.run(text, file, glossaries) ?? null;
}

/** What a check prints, for the agent that reads its output. */
export function describe(check: string): string {
  return find(check)?.description ?? "";
}

/** Whether a check reads the file on disk, which text pasted in chat does not have. */
export function requiresFile(check: string): boolean {
  return find(check)?.requiresFile ?? false;
}

// JavaScript's \w and \b know only ASCII, so a Cyrillic word needs its own boundaries.
const word = String.raw`[\p{L}\p{M}\p{Nd}\p{Pc}]`;
/** Starts a word: no word character before. */
const start = `(?<!${word})`;
/** Ends a word: no word character after. */
const end = `(?!${word})`;

/** Lines of the file without the line break at the end. */
function lines(text: string): string[] {
  const all = text.split("\n");
  if (all.at(-1) === "") all.pop();
  return all;
}

/** Prose lines: no frontmatter, no fenced code blocks (indented fences too). Inline code stays. */
export function proseRaw(text: string): Line[] {
  const out: Line[] = [];
  let inFrontmatter = false;
  let inCode = false;

  for (const [i, line] of lines(text).entries()) {
    if (i === 0 && /^---\s*$/.test(line)) {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (/^---\s*$/.test(line)) inFrontmatter = false;
      continue;
    }

    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (!inCode) out.push({ n: i + 1, text: line });
  }

  return out;
}

/** The same without inline code. */
export function prose(text: string): Line[] {
  return proseRaw(text).map(({ n, text }) => ({ n, text: text.replace(/`[^`]*`/g, "") }));
}

const format = ({ n, text }: Line) => `${n}: ${text}`;

const tableSeparator = /^\s*\|?[\s:|-]+\|?\s*$/;
const listItem = /^\s*(?:[-*]|\d+\.)\s/;

/** Code point order, like a byte-wise sort of UTF-8. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

export function hybrids(text: string): string[] {
  const pattern = new RegExp(
    `${start}([A-Za-z][A-Za-z0-9]*-?[а-яё]+|[а-яё]+-?[A-Za-z][A-Za-z0-9]*)`,
    "gu",
  );

  return prose(text).flatMap(({ n, text }) =>
    [...text.matchAll(pattern)].map((match) => `${n}: ${match[1]}`),
  );
}

/** "count word (lines)", most frequent first. */
export function latin(text: string): string[] {
  const pattern = new RegExp(`${start}([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)`, "gu");

  const found = new Map<string, number[]>();
  for (const { n, text: line } of prose(text)) {
    for (const [, name = ""] of line.matchAll(pattern)) {
      if (name.length > 2) found.set(name, [...(found.get(name) ?? []), n]);
    }
  }

  return [...found]
    .sort(([a, linesA], [b, linesB]) => linesB.length - linesA.length || compare(a, b))
    .map(([name, at]) => `${String(at.length).padStart(4)} ${name} (${[...new Set(at)].join(", ")})`);
}

/** Russian noun and adjective endings, longest first, so a term matches its other cases. */
const endings = [
  "ами", "ями", "ого", "его", "ому", "ему",
  "ом", "ем", "ём", "ой", "ей", "ою", "ею", "ам", "ям", "ах", "ях", "ов", "ев",
  "ый", "ий", "ая", "яя", "ое", "ее", "ые", "ие", "ым", "им", "ых", "их", "ую", "юю",
  "а", "я", "о", "е", "ё", "у", "ю", "ы", "и", "ь", "й",
];

/** One word of a glossary term: a Russian word in any case, a Latin one with a plural ending. */
function termWord(word: string): string {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!/[а-яё]$/i.test(word)) return `${escape(word)}(?:s|es)?`;

  const ending = endings.find((ending) => word.endsWith(ending) && word.length - ending.length >= 3) ?? "";
  const stem = word.slice(0, word.length - ending.length);
  return `${escape(stem)}(?:${endings.join("|")})?`;
}

/** Terms of the glossary tables found in prose, each with its replacement. */
export function glossary(text: string, rows: Replacement[]): string[] {
  const terms = rows.flatMap(({ terms, replacement }) =>
    terms.map((term) => ({
      pattern: new RegExp(`${start}(${term.split(/\s+/).map(termWord).join("\\s+")})${end}`, "giu"),
      replacement,
    })),
  );

  return prose(text).flatMap(({ n, text: line }) =>
    terms.flatMap(({ pattern, replacement }) =>
      [...line.matchAll(pattern)].map((match) => `${n}: ${match[1]} → ${replacement}`),
    ),
  );
}

/**
 * Parts of a prose line that connectors reads, as [start, length]: table cells of six
 * words or more, or the line without a bold list-item label, the dash after it and
 * a semicolon that ends the item.
 */
function connectorSpans(line: string): [number, number][] {
  if (/^\s*\|/.test(line)) {
    return [...line.matchAll(/[^|]+/g)]
      .filter((cell) => countWords(cell[0]) >= 6)
      .map((cell) => [cell.index, cell[0].length]);
  }

  const label = /^\s*(?:[-*]|\d+\.)\s+\*\*[^*]+\*\*(?:[.:]?\s*—)?/.exec(line);
  const from = label ? label[0].length : 0;
  const to = listItem.test(line) && /;\s*$/.test(line) ? line.length - 1 : line.length;
  return [[from, to - from]];
}

/**
 * Every dash and semicolon in prose, with a few words of context. Headings,
 * «A vs B — …» items and table separators are skipped by design.
 */
export function connectors(text: string): string[] {
  const out: string[] = [];

  for (const { n, text: line } of prose(text)) {
    if (/^\s*#/.test(line) || /\svs\s/.test(line) || tableSeparator.test(line)) continue;

    for (const [from, length] of connectorSpans(line)) {
      const segment = line.slice(from, from + length);
      for (const match of segment.matchAll(/—|;/g)) {
        const left = /((?:\S+\s*){0,3})$/.exec(segment.slice(0, match.index))?.[1] ?? "";
        const right = /^(\s*(?:\S+\s*){0,3})/.exec(segment.slice(match.index + 1))?.[1] ?? "";
        out.push(`${n}: …${(left + match[0] + right).replace(/\s+/g, " ")}…`);
      }
    }
  }

  return out;
}

export function ellipsis(text: string): string[] {
  return prose(text)
    .map(format)
    .filter((line) => !/^[0-9]+: *\|/.test(line) && /\.\.\.|…/.test(line));
}

/**
 * Paragraphs and list items are split into sentences; tables and headings are skipped.
 * Inline code counts as one word. Prints the line where the sentence starts.
 */
export function longSentences(text: string): string[] {
  const out: string[] = [];
  let paragraph: Line[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;

    let joined = "";
    // Where each line starts in the joined text.
    const starts: [number, number][] = [];
    for (const { n, text } of paragraph) {
      starts.push([joined.length, n]);
      joined += `${text} `;
    }
    paragraph = [];

    let pos = 0;
    for (const sentence of joined.split(/(?<=[.!?…])\s+/)) {
      pos = joined.indexOf(sentence, pos);
      const count = countWords(sentence);
      if (count > 25) {
        let at = starts[0]?.[1] ?? 0;
        for (const [offset, n] of starts) if (offset <= pos) at = n;
        out.push(`${at}: ${count} words: ${sentence.replace(/\s+/g, " ").replace(/ $/, "")}`);
      }
      pos += sentence.length;
    }
  };

  for (const { n, text: raw } of proseRaw(text)) {
    let line = raw.replace(/`[^`]*`/g, "X");
    if (/^\s*$/.test(line) || /^\s*(?:#|\|)/.test(line)) {
      flush();
      continue;
    }

    const item = /^\s*(?:[-*]|\d+\.)\s+/.exec(line);
    if (item) {
      line = line.slice(item[0].length);
      flush();
    }
    paragraph.push({ n, text: line });
  }
  flush();

  return out;
}

/** Reads inline code too: references usually sit in backticks. */
export function fileLines(text: string): string[] {
  return proseRaw(text)
    .map(format)
    .filter((line) => /[A-Za-z0-9_]\.[a-z]{2,4}:[0-9]+/.test(line));
}

/** Anchors are not checked: only the file or directory part of the target. */
export function links(
  text: string,
  dir: string,
  exists: (path: string) => boolean = existsSync,
): string[] {
  const out: string[] = [];

  for (const { n, text: line } of prose(text)) {
    for (const [, target = ""] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;

      const path = target.replace(/#.*/, "");
      if (!exists(isAbsolute(path) ? path : `${dir}/${path}`)) out.push(`${n}: ${target}`);
    }
  }

  return out;
}

/** Text with every character but the line breaks dropped, so line numbers stay right. */
const blank = (text: string) => text.replace(/[^\n]/g, "");

/**
 * Reads the whole file so a construction broken by a line break is still found.
 * Frontmatter and code blocks are blanked but keep their newlines.
 */
export function contrast(text: string): string[] {
  const prepared = text
    .replace(/^---[ \t]*\n[\s\S]*?\n---[ \t]*\n/, blank)
    .replace(/^[ \t]*```[\s\S]*?^[ \t]*```[^\n]*/gm, blank)
    .replace(/`[^`\n]*`/g, "");

  // Context words stay on the same line; only the construction itself may span lines.
  // The trailing context is a lookahead, so it never swallows the next match.
  const pattern = new RegExp(
    String.raw`((?:\S+[ \t]+){0,3})(\S*,\s*а\s+не${end}|${start}[Нн]е\s+[^,.]{1,40},\s*а${end}(?!\s+(?:также|значит)${end}))(?=((?:[ \t]*\S+){0,3}))`,
    "gud",
  );

  return [...prepared.matchAll(pattern)].map((match) => {
    const at = match.indices?.[2]?.[0] ?? match.index;
    const n = 1 + (prepared.slice(0, at).match(/\n/g)?.length ?? 0);
    const found = `${match[1] ?? ""}${match[2] ?? ""}${match[3] ?? ""}`.replace(/\s+/g, " ");
    return `${n}: …${found}…`;
  });
}

/**
 * Connectors repeated-connectors counts. «А» after a comma or at the start of a sentence,
 * «тогда как» and «в то время как» join the same way, so they count as one.
 */
const repeatable: { name: string; pattern: RegExp }[] = [
  {
    name: "а",
    pattern: new RegExp(
      String.raw`(?:(?<=,\s*)а|(?<=(?:^|[.!?…]\s+))А)${end}(?!\s+(?:не|также|значит|именно)${end})|${start}(?:[Тт]огда|[Вв]\s+то\s+время)\s+как${end}`,
      "gu",
    ),
  },
  ...["но", "однако", "зато", "поэтому", "так что", "при этом", "причём"].map((name) => ({
    name,
    pattern: new RegExp(`${start}${name.replace(" ", String.raw`\s+`)}${end}`, "giu"),
  })),
];

/**
 * A paragraph or a list without blank lines between items is one block; headings and
 * tables end it. Prints the first line of the block for each connector found twice or more.
 */
export function repeatedConnectors(text: string): string[] {
  const out: string[] = [];
  let block: Line[] = [];

  const flush = () => {
    if (block.length === 0) return;

    let joined = "";
    // Where each line starts in the joined text.
    const starts: [number, number][] = [];
    for (const { n, text } of block) {
      starts.push([joined.length, n]);
      joined += `${text} `;
    }
    const first = block[0]?.n ?? 0;
    block = [];

    for (const { name, pattern } of repeatable) {
      const at = [...joined.matchAll(pattern)].map((match) => {
        let line = first;
        for (const [offset, n] of starts) if (offset <= match.index) line = n;
        return line;
      });
      if (at.length >= 2) out.push(`${first}: «${name}» ×${at.length} (${[...new Set(at)].join(", ")})`);
    }
  };

  for (const { n, text: line } of prose(text)) {
    if (/^\s*$/.test(line) || /^\s*(?:#|\|)/.test(line)) {
      flush();
      continue;
    }
    block.push({ n, text: line.replace(/^\s*(?:[-*>]|\d+\.)\s+/, "") });
  }
  flush();

  return out;
}

/** Prose words only: markup tokens, table separators, frontmatter and code blocks are not counted. */
export function words(text: string): number {
  let count = 0;

  for (const { text: raw } of proseRaw(text)) {
    if (tableSeparator.test(raw)) continue;

    const line = raw
      .replace(/`[^`]*`/g, "X")
      .replace(/\*\*|__|[#>|]/g, "")
      .replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
    count += line.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  }

  return count;
}

function fail(message: string): never {
  process.stderr.write(message);
  process.exit(2);
}

function main(args: string[]): void {
  const [name = "", file = ""] = args;
  const check = find(name);
  if (args.length !== 2 || !check) {
    fail(`Usage: checks.ts <check> file.md\n\nChecks: ${Object.keys(checks).join(", ")}\n`);
  }
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) fail(`No such file: ${file}\n`);

  const glossaries = [...commonGlossary(), ...projectGlossary([dirname(realpathSync(file)), process.cwd()])];
  const out = check.run(readFileSync(file, "utf8"), file, glossaries);
  process.stdout.write(out.map((line) => `${line}\n`).join(""));
}

// Runs only as a script, so tests can import the functions. The skill directory is
// often a symlink, hence realpath.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
