#!/usr/bin/env node
/**
 * The one call an agent makes to start a check: prints everything the check needs,
 * with the mechanical checks already run on the text.
 *
 * Usage: prompt.ts [<selector>...] [-c|--copydesk] [-n|--dry-run] [--lang ru|en] <file | ->
 *        prompt.ts --subagent [--lang ru|en] <rule ID>... <file>
 *
 * A selector is a preset name or a rule ID; no selectors means the recommended preset.
 * --copydesk runs the parallel flow, subagents by group; without it one agent checks.
 * The check edits the text unless --dry-run leaves out everything about editing.
 * `-` reads the text from stdin and saves it to a temp file. The language is guessed
 * from the letters of the prose unless --lang sets it. Output longer than a command's
 * output limit goes to a temp file, and the output names it.
 * Exit code 2 means bad usage or an unknown selector.
 *
 * Needs Node 22.18+ to run TypeScript without a build step.
 */

import { mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { describe, type Lang, mentions, prose, requiresFile, run, words } from "./checks.ts";
import { commonGlossary, excerpt, projectGlossary } from "./glossary.ts";
import {
  body,
  checkRules,
  fixNotes,
  groupLines,
  isPreset,
  isRule,
  loadModel,
  type Model,
  notes,
  plan,
  type Rule,
  ruleText,
} from "./rules.ts";

const usage = `Usage: prompt.ts [<selector>...] [-c|--copydesk] [-n|--dry-run] [--lang ru|en] <file | ->
       prompt.ts --subagent [--lang ru|en] <rule ID>... <file>
`;

const scripts = dirname(fileURLToPath(import.meta.url));
const skill = dirname(scripts);
const refs = join(skill, "references");

/** Claude Code cuts a command's output at 30 000 characters. */
const outputLimit = 28_000;

/** Lines of one check's output shown before the rest is cut. */
const checkLimit = 40;

type Flow = "single" | "parallel";

type Options = {
  selectors: string[];
  target: string;
  flow: Flow;
  dryRun: boolean;
  lang: Lang | undefined;
  subagent: boolean;
};

/** The text under check. */
export type Doc = {
  file: string;
  text: string;
  lang: Lang;
  /** Pasted in chat and saved to a temp file, so it has no place of its own. */
  fromChat: boolean;
  /** Files of the project glossary. */
  glossary: string[];
};

/** Russian when the prose has at least as many Cyrillic letters as Latin ones. */
export function guessLang(text: string): Lang {
  const letters = prose(text)
    .map((line) => line.text)
    .join("\n");
  const cyrillic = letters.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  const latin = letters.match(/[A-Za-z]/g)?.length ?? 0;
  return cyrillic >= latin && cyrillic > 0 ? "ru" : "en";
}

/**
 * Reference files a flow prints before the glossaries, presets and rules. What is not
 * checked goes only to the single flow: in the parallel flow subagents get it with
 * their rules.
 */
export function contextFiles(flow: Flow, fix: boolean): string[] {
  return [
    join(refs, "flows", `${flow}.md`),
    join(refs, "report.md"),
    ...(fix ? [join(refs, "fix", "common.md"), join(refs, "fix", `${flow}.md`)] : []),
    ...(flow === "parallel" ? [join(refs, "subagent-prompt.md")] : [join(refs, "scope.md")]),
  ];
}

/**
 * The glossaries for the rules that read them, cut to the terms the text mentions.
 * The common glossary covers only Russian text. No such rules means no glossary.
 */
export function glossaries(rules: Rule[], doc: Doc): string[] {
  if (!rules.some((rule) => rule.glossary)) return [];

  const files = [...(doc.lang === "ru" ? commonGlossary() : []), ...doc.glossary];
  const mentioned = mentions(doc.text);
  const parts = files.map((file) => excerpt(readBody(file), mentioned)).filter((part) => part !== "");
  if (parts.length === 0) return [];

  return [
    "Из глоссариев выведены только записи, термины которых есть в тексте, сами или в запрещённом переводе.",
    ...parts,
  ];
}

/** File text as the agent sees it, without frontmatter and editor notes. */
function readBody(file: string): string {
  return body(readFileSync(file, "utf8"));
}

/**
 * Results of the checks the rules name, as a markdown section. Each check names the
 * rules it serves. Chat text skips the checks that need a real file.
 */
export function checkResults(model: Model, ids: string[], doc: Doc): string {
  const byCheck = checkRules(model, doc.lang, ids);
  if (doc.fromChat) {
    for (const check of byCheck.keys()) {
      if (requiresFile(check)) byCheck.delete(check);
    }
  }
  if (byCheck.size === 0) return "";

  const sections: string[] = [];
  const clean: string[] = [];
  for (const [check, rules] of byCheck) {
    const label = `${check} (${rules.join(", ")})`;
    const lines = run(check, doc.text, doc.file, [...commonGlossary(), ...doc.glossary]) ?? [];
    if (lines.length === 0) {
      clean.push(label);
      continue;
    }

    const shown = lines.slice(0, checkLimit);
    if (lines.length > checkLimit) {
      const command = `${join(scripts, "checks.ts")} ${check} ${doc.file}`;
      shown.push(`…ещё ${lines.length - checkLimit} строк. Весь вывод: \`${command}\``);
    }
    sections.push(`## ${label}\n\n${describe(check)}\n\n${shown.join("\n")}`);
  }
  if (clean.length > 0) sections.push(`Без находок: ${clean.join(", ")}.`);

  return [
    "# Механические проверки",
    "Скрипт уже прогнал проверки выбранных правил по тексту. Вывод даёт кандидатов, решение принимает правило в скобках. Число в начале строки вывода — номер строки файла.",
    ...sections,
  ].join("\n\n");
}

/** The first line: language, size, where the text is and the project glossary. */
function header(doc: Doc): string {
  return [
    `Язык текста: ${doc.lang}. Слов прозы без блоков кода: ${words(doc.text)}.`,
    doc.fromChat ? `Текст из чата сохранён в файл ${doc.file}.` : `Документ: ${doc.file}.`,
    doc.glossary.length > 0 ? `Проектный глоссарий: ${doc.glossary.join(", ")}.` : "Проектного глоссария нет.",
    ...(doc.lang === "en" && doc.glossary.length > 0
      ? ["Для английского текста проектный глоссарий нужен только ради имён продукта и кода."]
      : []),
  ].join(" ");
}

/**
 * The whole check for the main agent: the flow, presets and rules, or the groups for
 * subagents. Fix files go in unless it is a dry run.
 */
function checkPrompt(model: Model, doc: Doc, options: Options): string[] {
  const { flow } = options;
  const fix = !options.dryRun;
  const selectors = options.selectors.length > 0 ? options.selectors : ["recommended"];
  const planned = plan(model, doc.lang, selectors);

  const parts = [header(doc), ...contextFiles(flow, fix).map(readBody)];
  const presetNotes = [notes(model, selectors), ...(fix ? [fixNotes(model, selectors)] : [])];

  if (flow === "single") {
    const rules = planned.kept.flatMap((id) => model.rules.get(id) ?? []);
    parts.push(
      ...glossaries(rules, doc),
      ...presetNotes,
      ...rules.map((rule) => ruleText(rule, doc.lang)),
      checkResults(model, planned.kept, doc),
    );
  } else {
    parts.push(
      ...presetNotes,
      `# Группы для сабагентов\n\n${groupLines(planned).join("\n")}`,
    );
  }

  if (planned.skipped.length > 0) {
    parts.push(`Правила без прочтения для ${doc.lang} не проверяются: ${planned.skipped.join(" ")}.`);
  }

  return parts;
}

/**
 * One group for a subagent: what is not checked, its rules, the glossaries when the
 * rules use them, and their check results.
 */
function subagentPrompt(model: Model, doc: Doc, ids: string[]): string[] {
  const planned = plan(model, doc.lang, ids);
  const rules = planned.kept.flatMap((id) => model.rules.get(id) ?? []);

  return [
    header(doc),
    readBody(join(refs, "scope.md")),
    ...rules.map((rule) => ruleText(rule, doc.lang)),
    ...glossaries(rules, doc),
    checkResults(model, planned.kept, doc),
  ];
}

function fail(message: string): never {
  process.stderr.write(message);
  process.exit(2);
}

function parse(args: string[]): Options {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        copydesk: { type: "boolean", short: "c", default: false },
        "dry-run": { type: "boolean", short: "n", default: false },
        lang: { type: "string" },
        subagent: { type: "boolean", default: false },
      },
    });
  } catch {
    fail(usage);
  }

  const { copydesk, lang, subagent } = parsed.values;
  const flow: Flow = copydesk ? "parallel" : "single";
  const dryRun = parsed.values["dry-run"];
  const target = parsed.positionals.at(-1);
  const selectors = parsed.positionals.slice(0, -1);
  if (target === undefined) fail(usage);
  if (lang !== undefined && lang !== "ru" && lang !== "en") fail(usage);
  if (subagent && selectors.length === 0) fail(usage);
  if (subagent && (copydesk || dryRun)) fail(usage);

  return { selectors, target, flow, dryRun, lang, subagent };
}

/**
 * Reads the text and finds its project glossary. Chat text goes to a temp file,
 * so subagents can read it by path.
 */
function readDoc(target: string, lang: Lang | undefined): Doc {
  const fromChat = target === "-";
  let file = target;

  if (fromChat) {
    file = join(mkdtempSync(join(tmpdir(), "editorial-")), "text.md");
    writeFileSync(file, readFileSync(0, "utf8"));
  } else if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
    fail(`No such file: ${file}\n`);
  }

  const text = readFileSync(file, "utf8");
  // Chat text has no place of its own, so its project is the working directory.
  const starts = fromChat ? [process.cwd()] : [dirname(realpathSync(file)), process.cwd()];
  return { file, text, fromChat, lang: lang ?? guessLang(text), glossary: projectGlossary(starts) };
}

/** Writes the output, or a pointer to a temp file when the output is too long. */
function write(parts: string[]): void {
  const out = `${parts.filter((part) => part !== "").join("\n\n")}\n`;
  if (out.length <= outputLimit) {
    process.stdout.write(out);
    return;
  }

  const file = join(mkdtempSync(join(tmpdir(), "editorial-")), "prompt.md");
  writeFileSync(file, out);
  process.stdout.write(
    `Вывод длиннее предела вывода команды и сохранён в файл. Прочитай его целиком: ${file}\n`,
  );
}

function main(args: string[]): void {
  const options = parse(args);
  const model = loadModel(skill);

  const known = (selector: string) =>
    isRule(model, selector) || (!options.subagent && isPreset(model, selector));
  for (const selector of options.selectors) {
    if (!known(selector)) fail(`Unknown selector: ${selector}\n`);
  }

  const doc = readDoc(options.target, options.lang);
  write(options.subagent ? subagentPrompt(model, doc, options.selectors) : checkPrompt(model, doc, options));
}

// Runs only as a script, so tests can import the functions. The skill directory is
// often a symlink, hence realpath.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
