#!/usr/bin/env node
/**
 * The one call an agent makes to start a check: prints everything the check needs,
 * with the mechanical checks already run on the text.
 *
 * Usage: prompt.ts [<selector>...] [--flow single|parallel] [--fix] [--lang ru|en] <file | ->
 *        prompt.ts --subagent [--lang ru|en] <rule ID>... <file>
 *
 * The single flow gets the flow, the report template, the edit rules with --fix, the
 * common glossary for Russian text, the preset notes, the rules and the check results.
 * The parallel flow gets the flow, the report template, the subagent prompt, the preset
 * notes and the groups. A subagent gets the rules of its group, the glossaries when those
 * rules use them, and the check results for those rules.
 *
 * The project glossary is the path on an `editorial-guidance glossary: <path>` line in the
 * nearest AGENTS.md or CLAUDE.md above the document, or above the working directory
 * for chat text. A directory means every .md file in it.
 *
 * `-` reads the text from stdin and saves it to a temp file, whose path the output names.
 * The language is guessed from the letters of the prose unless --lang sets it.
 * Output longer than a command's output limit goes to a temp file, and the output names it.
 * Exit code 2 means bad usage or an unknown selector.
 *
 * Needs Node 22.18+ to run TypeScript without a build step.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { checksFor, descriptions, type Lang, prose, run, words } from "./checks.ts";
import { context } from "./context.ts";
import { body, groupLines, isPreset, isRule, loadModel, type Model, notes, plan, ruleText } from "./rules.ts";

const usage = `Usage: prompt.ts [<selector>...] [--flow single|parallel] [--fix] [--lang ru|en] <file | ->
       prompt.ts --subagent [--lang ru|en] <rule ID>... <file>
`;

/** Claude Code cuts a command's output at 30 000 characters. */
const outputLimit = 28_000;

/** Lines of one check's output shown before the rest is cut. */
const checkLimit = 40;

/** Russian when the prose has at least as many Cyrillic letters as Latin ones. */
export function guessLang(text: string): Lang {
  const letters = prose(text)
    .map((line) => line.text)
    .join("\n");
  const cyrillic = letters.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  const latin = letters.match(/[A-Za-z]/g)?.length ?? 0;
  return cyrillic >= latin && cyrillic > 0 ? "ru" : "en";
}

/** Files of the project glossary, found from the first start directory that has one. */
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
        if (stat?.isDirectory()) {
          return readdirSync(path)
            .filter((entry) => entry.endsWith(".md"))
            .sort()
            .map((entry) => join(path, entry));
        }
        return [];
      }
      if (dirname(dir) === dir) break;
    }
  }
  return [];
}

/**
 * Results of the checks the rules name, as a markdown section. A check gets the rules
 * it serves in brackets. Checks that need a real file are left out for chat text.
 */
export function checkResults(
  model: Model,
  lang: Lang,
  ids: string[],
  text: string,
  file: string,
  fromChat: boolean,
  skill: string,
): string {
  const known = checksFor(lang).filter(
    (check) => !(fromChat && (check === "file-lines" || check === "links")),
  );
  const byCheck = new Map<string, string[]>();
  for (const id of ids) {
    for (const check of model.rules.get(id)?.checks ?? []) {
      if (known.includes(check)) byCheck.set(check, [...(byCheck.get(check) ?? []), id]);
    }
  }
  if (byCheck.size === 0) return "";

  const sections: string[] = [];
  const clean: string[] = [];
  for (const [check, rules] of byCheck) {
    const label = `${check} (${rules.join(", ")})`;
    const lines = run(check, text, file) ?? [];
    if (lines.length === 0) {
      clean.push(label);
      continue;
    }
    const shown = lines.slice(0, checkLimit);
    if (lines.length > checkLimit) {
      shown.push(
        `…ещё ${lines.length - checkLimit} строк. Весь вывод: \`${skill}/scripts/checks.ts ${check} ${file}\``,
      );
    }
    sections.push(`## ${label}\n\n${descriptions[check] ?? ""}\n\n${shown.join("\n")}`);
  }
  if (clean.length > 0) sections.push(`Без находок: ${clean.join(", ")}.`);

  return [
    "# Механические проверки",
    "Скрипт уже прогнал проверки выбранных правил по тексту. Вывод даёт кандидатов, решение принимает правило в скобках. Число в начале строки вывода — номер строки файла.",
    ...sections,
  ].join("\n\n");
}

function fail(message: string): never {
  process.stderr.write(message);
  process.exit(2);
}

/** Writes the output, or a pointer to a temp file when the output is too long. */
function write(out: string): void {
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
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        flow: { type: "string", default: "single" },
        fix: { type: "boolean", default: false },
        lang: { type: "string" },
        subagent: { type: "boolean", default: false },
      },
    });
  } catch {
    fail(usage);
  }
  const { values, positionals } = parsed;
  const { flow, fix, subagent } = values;
  const target = positionals.at(-1);
  const selectors = positionals.slice(0, -1);
  if (target === undefined || (flow !== "single" && flow !== "parallel")) fail(usage);
  if (values.lang !== undefined && values.lang !== "ru" && values.lang !== "en") fail(usage);

  const skill = join(dirname(self), "..");
  const model = loadModel(skill);
  for (const selector of selectors) {
    if (subagent ? !isRule(model, selector) : !isRule(model, selector) && !isPreset(model, selector)) {
      fail(`Unknown selector: ${selector}\n`);
    }
  }
  if (subagent && selectors.length === 0) fail(usage);

  // Chat text goes to a temp file, so later calls and subagents can read it by path.
  const fromChat = target === "-";
  let file = target;
  if (fromChat) {
    file = join(mkdtempSync(join(tmpdir(), "editorial-")), "text.md");
    writeFileSync(file, readFileSync(0, "utf8"));
  } else if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
    fail(`No such file: ${file}\n`);
  }
  const text = readFileSync(file, "utf8");
  const lang = (values.lang as Lang | undefined) ?? guessLang(text);

  // Chat text has no place of its own, so its project is the working directory.
  const starts = fromChat ? [process.cwd()] : [dirname(realpathSync(file)), process.cwd()];
  const glossaryFiles = projectGlossary(starts);
  const projectText = glossaryFiles
    .map((path) => body(readFileSync(path, "utf8")))
    .join("\n\n");

  const header = [
    `Язык текста: ${lang}. Слов прозы без блоков кода: ${words(text)}.`,
    ...(fromChat ? [`Текст из чата сохранён в файл ${file}.`] : [`Документ: ${file}.`]),
    glossaryFiles.length > 0
      ? `Проектный глоссарий: ${glossaryFiles.join(", ")}.`
      : "Проектного глоссария нет.",
    ...(lang === "en" && glossaryFiles.length > 0
      ? ["Для английского текста проектный глоссарий нужен только ради имён продукта и кода."]
      : []),
  ].join(" ");

  if (subagent) {
    const planned = plan(model, lang, selectors);
    const rules = planned.kept.flatMap((id) => model.rules.get(id) ?? []);
    // Only rules that name the glossary need it. The common one covers Russian text.
    const needsGlossary = rules.some((rule) => rule.body.includes("глоссари"));
    const common =
      needsGlossary && lang === "ru"
        ? body(readFileSync(join(skill, "references/glossary/common.md"), "utf8"))
        : "";
    write(
      [
        header,
        ...rules.map((rule) => ruleText(rule, lang)),
        common,
        needsGlossary ? projectText : "",
        checkResults(model, lang, planned.kept, text, file, fromChat, skill),
      ]
        .filter((part) => part !== "")
        .join("\n\n") + "\n",
    );
    return;
  }

  const chosen = selectors.length > 0 ? selectors : ["recommended"];
  const planned = plan(model, lang, chosen);
  const refs = join(skill, "references");
  const parts = [header, context(refs, lang, flow, fix).trimEnd()];
  // Subagents get the project glossary with their rules.
  if (flow === "single") parts.push(projectText);
  parts.push(notes(model, chosen).trimEnd());
  if (flow === "parallel") {
    parts.push(`# Группы для сабагентов\n\n${groupLines(planned).join("\n")}`);
  } else {
    parts.push(
      ...planned.kept.flatMap((id) => model.rules.get(id) ?? []).map((rule) => ruleText(rule, lang)),
      checkResults(model, lang, planned.kept, text, file, fromChat, skill),
    );
  }
  if (planned.skipped.length > 0) parts.push(`Not checked for ${lang}: ${planned.skipped.join(" ")}`);
  write(parts.filter((part) => part !== "").join("\n\n") + "\n");
}

// Runs only as a script, so tests can import the functions. The skill directory is
// often a symlink, hence realpath.
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(process.argv[1]) === self) main(process.argv.slice(2));
