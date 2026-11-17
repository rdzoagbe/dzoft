# DZOFT — Automatically prepared GitHub progress drafts

## Daily workflow

DZOFT's existing vetted integration reads **ProjectRodney/ProRod** on `main`. It does not copy raw commit titles, authors, AI session text, secrets, diffs, or code into the project database. GitHub categories and dates are owner-private.

- The existing background sync, scheduled at **:17 and :47 UTC**, saves new permitted date/category groups. A database trigger prepares a **private auto progress draft** whenever new GitHub groups are imported.
- Opening or refreshing the DZOFT admin project page performs a metadata-free, client-side GitHub synchronisation (using the existing reviewed category filter) and recomputes the private draft. **Refresh from GitHub** lets the owner run the sync on demand.
- A second manually prepared draft (`quotes.progress_draft`) is preserved untouched. The automation uses `quotes.progress_auto_draft` to avoid overwriting human-authored text.
- Where no manual draft exists, the new automatic suggestions prefill the existing **Publish progress** editor. Where a manual draft exists, the owner can choose **Use this draft** to replace only the form fields, after confirmation if they have been edited.
- **No automatic publication or client email.** The owner still verifies the generated text and clicks **Publish and notify**. The special publishing RPC records the source fingerprint in the same transaction as the existing batch publication; duplicate clicks or repeated refreshes cannot publish the same source digest twice.
- GitHub signals are **always marked In progress**, never *Built* or *Tested*. They indicate development activity, not verified deliverables or client acceptance.
- The draft uses fixed bilingual UI messages and server-generated generic category descriptions. The existing live private draft remains stored and never becomes client-visible without explicit approval.
- Previously suggested milestones are imported **not completed**, and the milestones must be saved successfully *before* removing their proposal from the draft. No inferred GitHub completion flags are honored.

## Scope and limitations

Only the currently approved pilot GitHub project has this automatic source. The importer checks a fixed project UUID and a fixed GitHub repository. Other client projects keep the manual workflow until separately authorized and configured.

GitHub category evidence is coarse: it does not confirm what exact feature was implemented, deployed, tested, or accepted. New development categories may take up to about 30 minutes to reach the backend if the owner does not open or manually refresh the project.

Background automation does not constitute a tested independent backup. The encrypted off-site backup and restoration drill remain outstanding.

## Tests

- `tests/automatic-github-progress-draft.test.cjs` checks separation of drafts, privacy, publication gating, approved status, and milestone safety.
- `tests/automatic-github-progress-draft.sql` runs only inside a transaction that **always rolls back**. It confirms a refresh is idempotent, the original accepted price and manual draft remain unchanged, and no client update is published.
- Standard desktop/mobile and UI regression GitHub Actions verify no changes to existing clients, invoices and payments.
