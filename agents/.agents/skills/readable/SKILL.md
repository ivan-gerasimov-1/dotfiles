---
name: readable
description: Refactor code for a human reader without changing what it does. Captures the behaviour before editing and diffs it after.
argument-hint: "[file | function | empty = code written in this session]"
metadata:
  author: ivan.gerasimov
  version: "1.0.0"
---

Refactor the target so a person reads it top to bottom without decoding it. Behaviour stays exactly the same: same output, same files written, same exit codes, same error messages.

## Target

- A path or a function name → that.
- Empty → the code this session wrote or edited. If that is unclear, ask which file.

## Steps

1. **Read** the whole target and a neighbouring file. The surrounding idiom stays: module system, quotes, comment style, naming case.
2. **Baseline.** Before editing, capture what the code does.
   - Tests exist → run them.
   - No tests → run the code on inputs that cover every branch, and save the output to the scratchpad. List which branch each input covers.
   - Nothing can be run (network, prod data) → say so, and review the diff branch by branch instead.
3. **Refactor** by the rules below.
4. **Check.** Rerun the same inputs and diff against the baseline. Any difference is a bug in the refactor: fix it, never accept it as a change.
5. **Report**, grouped by rule (structure, names, breathing, comments): what changed, the check that proves behaviour stayed, and the name exceptions kept.

## Rules

### Readable

- One function, one job. A function that searches, formats and prints becomes three. The name says what it returns or does (`buildNameIndex`, `managementChain`).
- A file with several concerns gets sections in reading order — data, logic, output, entry point — each under a one-line divider comment.
- Magic numbers become named constants: `MS_PER_DAY`, not `864e5`; `FUZZY_THRESHOLD`, not `0.8`.
- An edge case exits early (`return`) instead of nesting the main path in `if/else`.
- Equivalent, simpler control flow wins: a `for` with three conditions in its header becomes a `while` over a named variable.
- Public interfaces stay: CLI arguments, exported names, file formats, log lines other tools parse.

### Names

- Meaningful and at least 3 characters: `employee`, not `r`; `needle`, not `q`; `previousRow`, not `prev`.
- Booleans read as a question: `isGuess`, not `fuzzy`.
- One thing keeps one name across the file.
- Exceptions: conventional module aliases (`fs`, `os`, `_` for lodash), `_` for an unused parameter, `id`, and names fixed by an external API or data format. Index loops prefer positional names (`leftPos`) over `i`/`j`, unless the code mirrors a formula.

### Breathing

- One statement per line. No `if (x) return y;` or `for (…) doThing();` on one line: use a braced block.
- A blank line between logical steps inside a function: load, compute, output.
- Long expressions break one item per line: arrays, call arguments and chained calls that don't fit about 100 columns.
- Don't overdo it: a three-line function needs no blank lines.

### Comments

- Keep a comment that says why, or what the code can't show. Move it to the doc comment of the function it describes (JSDoc, docstring), not inside the body.
- Drop a comment that restates the code or refers to something no longer there.

## Don't

- Change behaviour, add features or fix bugs on the way. Name a bug you notice in the report instead.
- Add dependencies or touch formatter and linter config.
- Reformat files outside the target.
