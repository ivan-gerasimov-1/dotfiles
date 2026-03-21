# v1.0.1

## Added

- **CRITICAL: Hard stop on section boundaries**: Tasks are grouped in sections (`## X. ...` in tasks.md).
  - **MANDATORY CHECK after EVERY task**: Count completed tasks in current section. If you just completed the LAST task in a section, you MUST STOP immediately.
  - **DO NOT proceed to X.1** (first task of next section) without explicit user confirmation.
  - **Required output when section completes**:

    ```
    ## Section X Complete

    **Completed:** X.1, X.2, X.3

    Ready to continue with Section Y? (Y/N)
    ```
