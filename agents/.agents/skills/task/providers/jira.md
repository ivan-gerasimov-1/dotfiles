# Jira

Fundraise Up Jira, project PD. Full Jira facts (tools, IDs, statuses, quirks): `/Users/ivan/Developer/sandox/memory/.claude/skills/week-plan/references/jira-rules.md`. Read it before the first write.

## Connection

Atlassian MCP (v2) tools `mcp__claude_ai_Atlassian_MCP__*` with `cloudId: "fru-it-team.atlassian.net"`. The Rovo server answers 403, don't use it.

## Work dir

`/Users/ivan/Developer/sandox/memory/.editorial/`. It sits in the memory repo, so `editorial-guidance` finds the Fundraise Up glossary from the repo's `AGENTS.md` wherever the session runs. Git ignores it.

## Known IDs (skip lookups)

- Me (Ivan Gerasimov): accountId **712020:bd1769c5-ad3f-4878-b844-2854c3400251**.
- Project: Product Development, key **PD**. Default type **Task: Development** (`10068`).
- Team field `customfield_10001`: Staff team **25dbcbd7-0314-469f-ae50-a0add79bff66**.
- Category labels: `staff:-domain`, `staff:-architect`, `staff:-hands-on`.
- Staff has no board or sprint yet (2026-10-12): don't assign a sprint.

## Fields to collect on create

- Assignee — default: me.
- Category — Domain / Architect / Hands-On / none (sets the summary prefix and the label).
- Estimate — only 1h / 2h / 4h / 8h (house rule); default: 1h. A requested value in between is rounded up to the next allowed one.
- Parent workstream — default: none; offer one only if the user named it.

Summary: English, prefixed by category (`[Domain] …`), as in jira-rules «Naming».

## Calls

- **Dedup:** `searchJiraIssuesUsingJql` with `project = PD AND reporter = currentUser() AND created >= -2d AND summary ~ "\"<summary>\""`.
- **Create:** `createJiraIssue` with `projectKey: "PD"`, `issueType: "Task: Development"` (or the type the user named), `summary`, `description` (markdown), `assignee`, `labels`, `additional_fields: { "customfield_10001": "<Staff team id>", "timetracking": { "originalEstimate": "<N>h" } }`, and `parent` if given. Team, assignee and estimate stick on create; no follow-up updates are needed.
- **Initial status:** `Backlog`, through the workflow in two `transitionJiraIssue` calls: `Move to triage` (id `7`), then `Move to backlog` (id `8`). If an id is rejected, list transitions (`listJiraIssueTransitions` via `executeRead`) and pick by name.
- **Read:** `getJiraIssue`, `view: "evidence"` for a read-back.
- **Write:** `editJiraIssue` sets the fields it gets in full: pass only `description` (and `summary` if asked), never `labels` or other fields.
- **Link:** `https://fru-it-team.atlassian.net/browse/<KEY>`.

## Description format

Markdown (`contentFormat: "markdown"`, the default), real newlines, `###` headings. No `<!--markdown-->` prefix. A description with media, panels or mentions comes back as HTML: edit and write it as HTML (`contentFormat: "html"`), or the media is dropped.

## Wrong task

Never delete a task: move it to `Canceled` with a comment.
