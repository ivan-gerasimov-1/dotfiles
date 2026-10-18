---
name: session-feedback
description: Review the current session for what went well, what went wrong and what to change next time. Three one-line items per section, each grounded in something that happened in the session; the «next time» items point at the skill or file to patch and are numbered so Ivan can answer `<n>. fix`. Use at «analyze the session», «фидбек по сессии», «разбор сессии», «что было плохо», «ретро сессии», «/session-feedback».
allowed-tools: Read, Bash, Grep, Glob, Edit, Write, ArtifactData, ToolSearch
---

A short retro of this session, for Ivan to act on, not to read. The value is in the «next time» items: each one is a concrete change to a skill, the project's `AGENTS.md`/`CLAUDE.md` or a script, so the same mistake doesn't come back.

## Steps

1. **Collect candidates** from the whole session, not just the last turns. Skip anything an earlier retro or fix in this session already addressed. If nothing new is left, reply «nothing new since the last retro» and stop.
   - Ivan's corrections and answers that changed the result («Gift Cart is the team…»).
   - Records Ivan edited after I wrote them (planner comments, files): his edit is a signal of what was wrong.
   - Errors, retries, version conflicts, failed checks, fallbacks.
   - Questions I asked that nobody answered and I didn't raise again.
   - Guesses I wrote into durable places (dictionaries, logs, the planner) without a confirmation.
   - Rules from skills or `AGENTS.md`/`CLAUDE.md` I bent or skipped, and rules that forced a useless step.
   - Things that went right *because of* a rule or a check (they show which rules to keep).
2. **Verify each one.** Ground it in a tool result, a diff or a message from Ivan. Re-check the cheap ones now (`git log`, read back a planner record, grep a file). A candidate with no evidence is dropped, not softened.
3. **Rank** by cost: wrong data in a durable place > Ivan's time (extra turns, extra questions) > wasted tool calls > style. Keep the top 3 per section; the rest stays unsaid unless asked.
4. **Map each «next time» item** to the place that would change: a skill file and section, the project's `AGENTS.md`/`CLAUDE.md`, a script, or a new skill. An item with no place to change is advice, not an item; rewrite it or drop it.

## Reply

```
**Good**
1. <one line>
2. …
3. …

**Bad**
1. <one line: what happened → consequence>
…

**Next time**
1. <one line: the change> (`<file or skill>`)
…

Reply `<n>. fix` to patch, `<n>. skill` to turn it into a skill, `<n>. skip`.
```

- Each item is almost a title: one line, about 15 words at most, no sub-bullets, no explanations. Ivan asks for detail when he wants it.
- «Bad» names the consequence, not the feeling («wrote ISO `ts` → page re-sorted comments»). No apologies, no self-criticism padding, no praise padding in «Good».
- Numbers in «Next time» are what Ivan answers to. Fewer than 3 real items → list fewer.
- If something is still open from the session (an unanswered question, an uncommitted change), one line after the list.

## On the answer

- `fix` → patch the named file, keep its style, and show one line per change. `skill` → draft the new skill in the current repo's `.claude/skills/<name>/`, or in `~/.agents/skills/<name>/` when it applies across projects, in the repo's skill format (frontmatter `name`, `description` with trigger phrases, `allowed-tools`). `skip` → nothing.
- Don't commit unless asked (the project's commit rules). Report what changed and what is uncommitted.
