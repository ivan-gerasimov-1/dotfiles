# Eval baseline

Quick mode, 3 runs per fixture, default model of Claude Code 2.1.303, 2026-10-19.
Command: `node evals/eval.ts --runs 3 --jobs 6`.

| Rule | Recall | Silent on pass | Flaky fixtures |
|---|---|---|---|
| B1 | 9/9 | 6/6 | 0 |
| P5 | 9/9 | 6/6 | 0 |
| P6 | 9/9 | 6/6 | 0 |
| P12 | 12/12 | 6/6 | 0 |

A full run of 21 fixtures costs about $14, about $0.22 per call.

## History

The first full run gave B1 3/6 silent and P6 6/9 recall with 2 flaky fixtures.
Fixes before the numbers above:

- `B1/pass-essential` was replaced by `B1/pass-concession`. Its contrast was
  redundant, and the model was right to cut it.
- A1 got a closed marker list. Similar filler not on it goes to P6, so
  `P6/flag-attention` stopped being labelled A1.
- P6 got announcements of what follows («Далее рассмотрим…»), so
  `P6/flag-intro` stopped passing as navigation.
