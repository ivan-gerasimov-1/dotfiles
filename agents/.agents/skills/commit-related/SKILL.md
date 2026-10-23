---
name: cr
description: commit-related. Commit the changes that belong to the work done in this session, nothing else, split into one commit per layer when they span several.
argument-hint: "[staged | hint about scope or message]"
metadata:
  author: ivan.gerasimov
  version: "0.1.0"
---

Commit the related changes of this session. The person typed `/cr`, which is the go-ahead, so commit without asking.

## Arguments

- empty: commit the related changes, as below.
- `staged`: commit exactly what is in the index now and skip the selection in step 2.
- any other text: a hint about scope or message («only the skill», «message: …»). It wins over your own reading.

## Steps

1. Look at the state of the repo, in one call:

   ```bash
   git status --porcelain; git diff --cached --name-status; git log --format=%s -15
   ```

   Nothing to commit → say `нечего коммитить` and stop.

2. **Pick the related files.** A file is related when this session created or edited it. That covers your own edits, a skill run here and a script you ran. It also covers files a skill staged and left for a commit (end-of-day leaves its recap staged).
   - Leave out everything else even if it is modified, such as other sessions' work, the person's own edits or generated junk.
   - A file whose relation is unclear stays out. Name it in the report and don't ask.
   - If something is already staged and unrelated, keep it out of your commit by committing explicit paths (`git commit -- <paths>`), never the whole index.

3. **Split by layer** when the related files serve distinct purposes. One layer → one commit. Commit the layer others depend on first. Typical layers:
   - here: a skill or tooling change (`.claude/skills/…`), a track (`tracks/<slug>/`), a meeting dir, a daily file (`start-of-day/`, `end-of-day/`), people and terms dictionaries;
   - in a code repo: schema/migration, core logic, API, UI, tests together with the code they test.

4. **Message** — follow the repo's own style from `git log`:
   - this repo: `<area>/<slug>: what changed` (`tracks/ticketing: …`, `skills/meeting-fetch: …`). Daily files use their skill's fixed subject (`end-of-day YYYY-MM-DD`, `start-of-day/YYYY-MM-DD: morning brief and snapshot`);
   - a skill that ran in this session and defines its own commit subject wins;
   - write only a subject, and add one short body paragraph when the why isn't obvious from the diff;
   - leave out co-author lines.

5. Commit each layer:

   ```bash
   git add -- <explicit paths>
   git commit -m "<subject>" -- <same paths>
   ```

   Write the paths out literally in both commands, never through a shell variable. The shell is zsh, which doesn't word-split `$P`, so several paths become one bad pathspec.
   Never run `git add -A` or `git add .`, never pass `--amend` or `--no-verify`, and never push.
   - A pre-commit hook fails → fix the cause and make a new commit.
   - Signing or the agent fails → report the error and stop without bypassing signing.

6. Report in one block and write nothing else:

   ```
   <short hash> <subject> (N files)
   …
   Left out: <path>, <path> — not from this session
   ```

   Drop the «Left out» line when nothing was left out.
