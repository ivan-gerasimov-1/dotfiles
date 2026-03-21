---
name: bugfix-lifecycle
description: End-to-end bugfix workflow based on OpenSpec. Focused on diagnosis, minimal corrective changes, regression safety, and spec alignment.
license: MIT
compatibility: Requires OpenSpec CLI.
---

Execute the complete bugfix lifecycle using OpenSpec.

The workflow covers:
• bug understanding and reproduction
• root cause analysis
• minimal corrective implementation
• verification and regression safety
• spec synchronization
• change archival

Interaction rules:

- If clarification is required → pause.
- Otherwise proceed automatically.
- Prefer minimal, surgical changes over refactors.
- Avoid scope expansion into feature work.

---

## Phase 1 — Diagnosis

1. /openspec-explore
   Define:
   - expected behavior
   - actual behavior
   - reproduction steps
   - impact scope

2. Root cause analysis
   Identify the technical source of the defect.

---

## Phase 2 — Correction

Implementation principles:

- Smallest possible fix
- Preserve architecture
- No opportunistic refactors
- No feature creep

1. /openspec-apply-change
   Implement the fix.

   After implementation:
   - Suggest commit message.
   - Perform code review focused on safety.

2. /openspec-verify-change
   Verify:
   - bug is resolved
   - no regressions
   - spec alignment

Iteration policy:

- Fix all blocking issues.
- Repeat review → fix cycle if needed.
- Stop when stable.

---

## Phase 3 — Stabilization

1. /openspec-sync-specs
   Update specs to reflect corrected behavior.

2. /openspec-archive-change
   Archive change.
