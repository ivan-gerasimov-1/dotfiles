---
name: task
description: Create a tracker task or rewrite the description of an existing one.
---

# Task

Call: `/task [--provider jira] [link, key or text]`.

## Scenario

The input picks the scenario. Read its file before the first call.

| Input | Scenario |
|---|---|
| One or more task links or keys (`PD-123`) | [rewrite](scenarios/rewrite.md) |
| Text of a new task | [create](scenarios/create.md) |
| Nothing | [create](scenarios/create.md), fields collected by questions |
| A link and new text together | ask one question: rewrite that task with the text, or create a new one |

## Provider

`--provider` picks the tracker, `jira` by default. The provider file says how to talk to the tracker: tools, IDs, fields, statuses, description format and the work dir. Read it before the first call.

| Provider | File |
|---|---|
| `jira` | [providers/jira.md](providers/jira.md) |

Any other value → name the supported providers and stop.

## Rules for every scenario

- A description goes through `editorial-guidance task` before any write.
- Every write is read back. Nothing is reported done before the read-back passes.
