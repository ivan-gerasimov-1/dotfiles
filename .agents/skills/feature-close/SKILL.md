---
name: feature-close
description: Runs the full feature finalizing workflow step by step.
---

Run the following skills in sequence.

If the current skill produces clarification questions, pause and let the user respond before continuing. Otherwise, continue automatically to the next skill without asking for confirmation.

1. /openspec-sync-specs
   Define what to build, including requirements and user stories.

2. /openspec-archive-change
   Prepare all artifacts required for implementation phase
