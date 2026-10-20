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
 * notes and the groups. A subagent gets the rules of its group, the common glossary
 * when those rules use it, and the check results for those rules.
 *
 * `-` reads the text from stdin and saves it to a temp file, whose path the output names.
 * The language is guessed from the letters of the prose unless --lang sets it.
 * Output longer than a command's output limit goes to a temp file, and the output names it.
 * Exit code 2 means bad usage or an unknown selector.
 *
 * Needs Node 22.18+ to run TypeScript without a build step.
 */

import { mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

  const header = [
    `Язык текста: ${lang}. Слов прозы без блоков кода: ${words(text)}.`,
    ...(fromChat ? [`Текст из чата сохранён в файл ${file}.`] : [`Документ: ${file}.`]),
  ].join(" ");

  if (subagent) {
    const planned = plan(model, lang, selectors);
    const rules = planned.kept.flatMap((id) => model.rules.get(id) ?? []);
    // The common glossary covers Russian text, and only rules that name it need it.
    const glossary =
      lang === "ru" && rules.some((rule) => rule.body.includes("глоссари"))
        ? body(readFileSync(join(skill, "references/glossary/common.md"), "utf8"))
        : "";
    write(
      [
        header,
        ...rules.map((rule) => ruleText(rule, lang)),
        glossary,
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
  const parts = [header, context(refs, lang, flow, fix).trimEnd(), notes(model, chosen).trimEnd()];
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
