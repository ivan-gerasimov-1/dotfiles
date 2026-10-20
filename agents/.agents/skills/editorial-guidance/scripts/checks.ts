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

export type Lang = "ru" | "en";

/** A prose line: its 1-based number in the file and its text. */
export type Line = { n: number; text: string };

type Check = {
  run: (text: string, file: string) => string[];
  /** Languages of the text the check reads. */
  langs: Lang[];
  /** What the check prints, in Russian, for the agent that reads its output. */
  description: string;
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
  variants: {
    run: variants,
    langs: ["ru"],
    description:
      "Понятия, записанные больше чем одним вариантом. Скрипт знает только частые пары, остальные варианты ищи чтением.",
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
  },
  links: {
    run: (text, file) => links(text, dirname(file)),
    langs: ["ru", "en"],
    description: "Относительные ссылки на файлы и каталоги, которых нет. Якоря скрипт не проверяет.",
  },
  contrast: {
    run: contrast,
    langs: ["ru"],
    description: "Конструкции «X, а не Y» и «не X, а Y», в том числе разорванные переносом строки.",
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
export function run(check: string, text: string, file: string): string[] | null {
  return find(check)?.run(text, file) ?? null;
}

/** What a check prints, for the agent that reads its output. */
export function describe(check: string): string {
  return find(check)?.description ?? "";
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

/** The concept a lowercase form belongs to, and the name the form prints under. */
function variantOf(form: string): [concept: string, name: string] {
  if (form.startsWith("бэкенд")) return ["бэкенд", "бэкенд"];
  if (form.startsWith("бэк")) return ["бэкенд", "бэк"];
  if (form === "backend") return ["бэкенд", "backend"];
  if (form.startsWith("фронтенд")) return ["фронтенд", "фронтенд"];
  if (form.startsWith("фронт")) return ["фронтенд", "фронт"];
  if (form === "frontend") return ["фронтенд", "frontend"];
  // The stem drops case endings.
  return ["downstream", `downstream-${[...form].slice(11, 16).join("")}…`];
}

/** Prints a concept only when it appears in two or more forms. */
export function variants(text: string): string[] {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{M}\\p{Nd}\\p{Pc}-])(бэкенд${word}*|бэк(?:а|у|ом|е)?${end}|backend|фронтенд${word}*|фронт(?:а|у|ом|е)?${end}|frontend|downstream-[а-яё]+)`,
    "gu",
  );

  // concept → form → lines
  const found = new Map<string, Map<string, Set<number>>>();
  for (const { n, text: line } of prose(text)) {
    for (const [, form = ""] of line.toLowerCase().matchAll(pattern)) {
      const [concept, name] = variantOf(form);
      const forms = found.get(concept) ?? new Map<string, Set<number>>();
      forms.set(name, (forms.get(name) ?? new Set()).add(n));
      found.set(concept, forms);
    }
  }

  const list = (forms: Map<string, Set<number>>) =>
    [...forms]
      .sort(([a], [b]) => compare(a, b))
      .map(([name, at]) => `${name} (${[...at].sort((a, b) => a - b).join(", ")})`)
      .join("; ");

  return [...found]
    .filter(([, forms]) => forms.size >= 2)
    .sort(([a], [b]) => compare(a, b))
    .map(([concept, forms]) => `${concept}: ${list(forms)}`);
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

  const out = check.run(readFileSync(file, "utf8"), file);
  process.stdout.write(out.map((line) => `${line}\n`).join(""));
}

// Runs only as a script, so tests can import the functions. The skill directory is
// often a symlink, hence realpath.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
