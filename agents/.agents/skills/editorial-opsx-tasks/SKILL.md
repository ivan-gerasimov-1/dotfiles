---
name: editorial-opsx-tasks
description: Rewrite the tasks.md of an OpenSpec change so each task reads at a glance and an implementing agent can check it is done: named tasks, no code in prose, a "Done when" check per task, code pointers in a block, spec and design links. Keeps the checkboxes OpenSpec tracks. Use when asked to clean up, restructure or improve readability of an OpenSpec tasks.md, or says "editorial for tasks.md" or "opsx tasks editorial".
allowed-tools: Bash(openspec list:*), Bash(openspec validate:*), Bash(openspec instructions:*), Bash(git diff:*), Bash(git status:*)
---

Rewrite `openspec/changes/<name>/tasks.md` in place. The content stays the same: you change its form, not its facts. The file stays in its own language.

This skill adapts the rules of `editorial-task` (written for Jira tickets) to OpenSpec. The differences: task checkboxes stay, there are no Jira sections, and nothing is written outside the file.

## Steps

1. **Pick the change.** Use the name the user gave. Otherwise run `openspec list --json`; with one active change use it, with several ask.

2. **Read before rewriting.** Read `tasks.md`, `design.md`, `proposal.md` and the requirement headings of `specs/*/spec.md`. When a task names a symbol whose location is not obvious, grep the code to find the file. Never invent facts, file locations, dependencies between tasks or criteria.

3. **Sort every inline name** into one of two kinds:
   - **Contract**, stays inline in the prose: package names, paths and file layouts on disk, data fields and event kinds, CLI verbs and flags, commands to run, user-facing copy, product and tool names.
   - **Implementation detail**, replaced in the prose by its role and listed under **Where to look**: function and type names, app source files, test files, browser or Node API names, flags and state variables.

   Files a task must delete stay listed under **Where to look**, and its **Done when** says they are gone.

4. **Write the file header.** Keep the existing preamble (sizing notes, rules that apply to every task). Add one line stating the rule from step 3: names in the prose are contracts, names under "Where to look" are starting points.

5. **Write a context line per group.** One or two sentences under each `##` heading: why the group exists, taken from the design or proposal. Don't repeat it in the tasks.

6. **Rewrite each task** in the layout below:
   - a short name of a few words in bold, on the checkbox line;
   - the description: what to do, in prose, using roles instead of implementation names;
   - **Done when:** an observable check. Turn "verify with…" into it. A task with no check gets one built only from its own text;
   - **Where to look:** a fenced block, one `name — role` per line, aligned;
   - **Refs:** links to the spec requirements and design decisions the task mentions.

7. **Remove duplication.** A check the preamble already requires of every task (for example, "typecheck passes") is dropped from the individual tasks.

8. **Space it out.** A blank line between a task's blocks and between tasks. A `---` line before each group heading. Lists of three or more criteria or links become bullets.

9. **Check.**
   - `openspec validate <name> --strict` passes.
   - The `- [ ]` / `- [x]` count equals the count before the rewrite; done marks are kept.
   - Every `#anchor` in a link matches a heading in its target file (GitHub slug: lowercase, punctuation dropped, spaces to hyphens).
   - No implementation name is left in the prose.

10. **Report** in a few lines: the task count, where you deviated from the original wording (new checks, new names), facts you found in the code, and that `openspec instructions apply --json` now carries only each task's name. If an agent is handed the change through that JSON list (for example, via `opsx-task-prompt`), it has to read `tasks.md` for the details.

## Layout

````markdown
---

## 2. Workspace access layer in the app (~300 lines)

The app moves from a single opened file to an opened folder. This group adds folder access and the document walk; the UI in group 3 builds on them.

- [ ] 2.1 **Workspace access module**

  Add the workspace access module. It opens a folder with read-write access through the directory picker, detects browsers without the picker, and on the first write creates `.review/` with a `.review/.gitignore` holding `*`.

  **Done when:** unit tests cover these operations against an in-memory fake directory handle.

  **Where to look:**

  ```
  // starting points, implementation may differ
  lib/workspace.ts                            — new module
  showDirectoryPicker({ mode: 'readwrite' })  — folder picker; its absence marks an unsupported browser
  ```

  **Refs:** [design D4](design.md#d4-workspace-model), specs/review-workspace [Document list](specs/review-workspace/spec.md#requirement-document-list).

- [ ] 2.2 **Document walk**

  …
````

With several criteria, **Done when** takes a lead-in and bullets:

```markdown
  **Done when** unit tests show that:

  - two quick appends produce both lines, in order;
  - the Claude log is never written.
```

## Rules

- **The checkbox stays on the task line.** OpenSpec counts `- [ ]` lines for progress. Criteria, refs and other bullets are plain `-` bullets, never checkboxes.
- **Links never go in a code block,** where they can't be clicked.
- **Don't renumber tasks** or move them between groups.
- **Keep sensitive logic word for word:** money, auth, migrations, data upgrades.
- **Don't touch the other artifacts.** If a task contradicts the design or a spec, report it; don't fix it here. Fixing it is `openspec-update-change`'s job.
