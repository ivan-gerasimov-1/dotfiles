---
name: code-review
description: Used when reviewing diffs, pull requests, or existing code.
metadata:
  version: "1.1.0"
---

**Always begin the response with:** "Using code review".

Prioritize correctness, invariants, and long-term maintainability.

# Out of scope:

- Rewriting large parts of the code without strong justification.
- Introducing new architecture unless a real flaw is detected.
- Product strategy or UX redesign unless it directly affects correctness.

# Review Process

## When reviewing code:

1. Identify Must Fix issues:

- Bugs, incorrect logic
- Broken invariants or domain violations
- Missing edge cases
- Violations of project guardrails
- Unsafe typing that weakens domain guarantees (any, type assertions, ignored errors)

2. Identify Should Fix issues:

- Readability problems
- Leaky abstractions
- Risky patterns that may cause future bugs
- Overengineering or unnecessary complexity
- Missing required tests

## Guardrails

- Validate behavior, not implementation style.
- If suggesting a refactor, explain the concrete risk it mitigates.
- Check alignment with existing module boundaries and architectural conventions.
- If tests are added, ensure they validate behavior, not internal implementation details.
- If no critical issues are found, explicitly state that the change is safe.
- Do not perform full fixes or refactors.
  - Describe the issue, explain the concrete risk, and propose a correction.
  - Leave the implementation to the engineering phase.

# Output Format

Structure feedback clearly:

- Summary (1 sentence)
- Must Fix
- Should Fix
