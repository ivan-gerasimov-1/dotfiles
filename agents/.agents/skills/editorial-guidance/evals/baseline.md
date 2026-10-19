# Eval baseline

Quick mode, 3 runs per fixture, default model of Claude Code 2.1.303, 2026-10-19.
Command: `node evals/eval.ts --runs 3 --jobs 6`.

| Rule | Recall | Silent on pass | Flaky fixtures |
|---|---|---|---|
| B001 | 9/9 | 6/6 | 0 |
| P005 | 9/9 | 6/6 | 0 |
| P006 | 9/9 | 6/6 | 0 |
| P012 | 12/12 | 6/6 | 0 |

A full run of 21 fixtures costs about $14, about $0.22 per call.

## After the `--fix` interface

Same fixtures, called as `/editorial-guidance slop prose <fragment>`
without `--fix`. Every rule scores the same as above, with no flaky fixtures.
The run cost $16.54, about $0.26 per call. The extra cost likely comes from
reading quick-check.md and report.md.

## After the fragment scripts

Called as `/editorial-guidance full <fragment>`. The agent now makes two script
calls instead of reading files one by one: `context.sh` prints the procedure,
the report template and the glossary, and `rules.sh --fragment` prints only the
rules a fragment check applies, without frontmatter. Every rule scores the same
as above, with no flaky fixtures. The run cost $14.13, about $0.22 per call,
at 3.1 turns per call instead of about 18.

Cost follows the amount of rule text in context, not the number of turns.
One script call that printed all 26 rules came to about $0.38 per call: its
output crossed Claude Code's inline limit, was saved to a file and read back
in an extra turn.

## History

The first full run gave B001 3/6 silent and P006 6/9 recall with 2 flaky fixtures.
Fixes before the numbers above:

- `B001/pass-essential` was replaced by `B001/pass-concession`. Its contrast was
  redundant, and the model was right to cut it.
- A001 got a closed marker list. Similar filler not on it goes to P006, so
  `P006/flag-attention` stopped being labelled A001.
- P006 got announcements of what follows («Далее рассмотрим…»), so
  `P006/flag-intro` stopped passing as navigation.
