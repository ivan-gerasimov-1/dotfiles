---
name: feature-lifecycle
description: End-to-end feature workflow based on OpenSpec. Covers discovery, planning, implementation, verification, and closure with minimal user interruptions and support for incremental spec updates.
compatibility: Requires OpenSpec CLI.
---

Execute the complete feature lifecycle using OpenSpec.

The workflow covers:
• defining the feature
• preparing implementation artifacts
• implementing tasks
• iterative verification and fixes
• syncing specifications
• archiving the change

The agent proceeds step-by-step with minimal interruptions.

Interaction rules:

- If a step produces clarification questions → pause and wait for user input.
- If no clarification is needed → continue automatically.
- Allow minor spec corrections during implementation when necessary.
- Avoid restarting the workflow due to small refinements.

---

## Phase 1 — Discovery & Planning

1. /openspec-explore
   Define scope, requirements, and user stories.

2. /openspec-ff-change
   Prepare all artifacts required for implementation.

---

## Phase 2 — Implementation

Execute all implementation tasks using the prepared OpenSpec plan.

Rules:

- Do not redefine requirements or redo planning unless major inconsistencies are found.
- Minor corrections may update specs incrementally without restarting the phase.

Implementation loop:

1. /openspec-apply-change
   Implement tasks from the task list.

   After each implementation phase:
   - Suggest a commit message.
   - Perform a code review.

2. /openspec-verify-change
   Review implementation quality and spec alignment.

Iteration policy:

- Fix all blocking issues and concrete review findings.
- Repeat review → fix cycle until:
  - no blocking issues remain
  - no actionable review comments remain
- Stop when the feature is ready to ship.
- Do not iterate on subjective or non-essential feedback.
- Record minor suggestions as follow-up improvements.

---

## Phase 3 — Finalization

1. /openspec-sync-specs
   Synchronize specs with the implemented behavior.

2. /openspec-archive-change
   Archive the completed change and finalize artifacts.
