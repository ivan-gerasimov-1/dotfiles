# Rewrite

The description of an existing task, edited and written back. Calls and the description format come from the provider file.

Several tasks (a batch) → run the steps for each one separately, so one failure doesn't stop the rest, and end with a check table.

1. **Read** the description. Save it to `<KEY>.md` in the provider's work dir and a copy to `<KEY>.orig.md` next to it.
2. **Owner.** A task reported by or assigned to someone else → name the owner and confirm before writing.
3. **Edit.** Run `editorial-guidance task <KEY>.md`. It edits the file in place. A description that came in the provider's markup (for Jira, HTML) keeps the markup: media, panels and mentions stay, only the text changes.
4. **Money check.** Compare the money and billing logic in `<KEY>.md` with `<KEY>.orig.md`. Put any change back to the original wording.
5. **Title.** Edit the summary only when asked to.
6. **Idempotency.** Adding a link or a block → check first that it is not there yet (`description.includes("figma.com")` and the like).
7. **Write** only the description, plus the summary if asked. The provider file says how not to drop other fields.
8. **Read back** and check:
   - the `### Контекст и цель` heading is there;
   - no `- [ ]`;
   - no `Dev Tips`;
   - the links (TD, SPEC, Figma) of `<KEY>.orig.md` are there;
   - the money logic matches `<KEY>.orig.md`;
   - the length did not collapse to zero.
9. After a passing check, delete `<KEY>.md` and `<KEY>.orig.md`.
