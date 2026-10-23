# Create

A new task from text. Fields, IDs, calls and statuses come from the provider file.

0. **Collect fields.** Without input, ask for the fields the provider lists in one AskUserQuestion round, defaults marked as Recommended. Then ask for the description in the next message and wait for it. Skip any question the input already answers; with everything present, go straight to step 1.
1. **Draft and edit.** Write the description, save it to a file in the provider's work dir and run `editorial-guidance task` on the file. Always, even when the draft was written to the template by hand. Generate the summary from the description by the provider's naming rule.
2. **Dedup** with the provider's search. A hit → show it and stop; don't create a second task.
3. **Create** in one call with every field set.
4. **Status.** Move the new task to the provider's initial status and check the status it landed in. A different target status only if the user asked for it.
5. **Read back** and print a field-by-field diff against the request: summary, type, assignee, team, labels, estimate, parent, status, description headings.
6. Print the task link. Delete the draft file.

## After create

The description was edited in step 1. Run [rewrite](rewrite.md) on the task only if the description changed after creation. A wrongly created task is not deleted: the provider file says what to do with it.
