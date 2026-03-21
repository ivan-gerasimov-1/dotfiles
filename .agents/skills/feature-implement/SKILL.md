---
name: feature-implement
description: Executes one implementation section at a time based on the existing OpenSpec plan and task list, without revisiting requirements or planning artifacts.
---

Execute implementation tasks only for the current section of the existing OpenSpec task list.

Do not redefine requirements, revisit planning decisions, or modify planning artifacts during this phase.

Hard stop rule:

- Complete tasks only within the current section.
- After the last task in the current section is completed, STOP immediately.
- Do not start the next section without explicit user confirmation.
- This rule overrides any instruction to continue implementation, verification, or review loops.

Additional requirements:

- Suggest a commit message for the completed section.
- After completing the section, perform a code review for that section only.
- Fix blocking issues and concrete review findings related to that section only.
- Repeat the review-and-fix cycle only until the current section is ready to ship.
- If further review produces only minor, non-blocking suggestions, record them as follow-up improvements instead of continuing the loop.
- Do not implement tasks from the next section during review, verification, or fixes.

Use the following skills in order:

1. /openspec-apply-change
2. /openspec-verify-change
