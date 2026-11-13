# DZOFT — Private task review and explicit client approval

## What changed

Rodney's **private project journal** now contains a small tasks area above the GitHub activity feed:

- **À faire** — initial state for manual tasks.
- **En cours** — actively being worked on.
- **À vérifier** — default for automatically imported GitHub activity; requires owner review (NOT client approval).
- **Terminé** — owner has checked completion, but **still unpublished**.

You may add manual tasks on any accepted project. The existing quote milestones, journal, payment history and client portal remain intact. Task statuses are distinct from client-approved milestones and do not change them automatically.

The public GitHub activity feed for **ProjectRodney/ProRod main** still auto-refreshes when DZOFT is open. Reading a recent dated category now **automatically creates or reuses** one owner-private task with a fixed category label/date, initially **À vérifier**. GitHub commits themselves never mark work complete or publish to the client.

The database stores only `source_date` and `source_group` from GitHub. It never stores commit subjects, bodies, author names or emails, AI co-author/trailer metadata, model/vendor names, code, diffs, SHA values, or session URLs. Repeat synchronization preserves each existing work item (including its owner-edited status) and does not create duplicates. The database rejects any AI/model/source/author metadata keys.

## Publishing requires human approval

Once a task is **Terminé**, the admin can expand **Relire et publier au client**. This requires:

1. Writing a human-reviewed short summary of what was *actually delivered*.
2. Selecting the client-facing category.
3. Optional explicit check **I personally tested this change** (otherwise the status shown is *built*, not *tested*).
4. Confirming the exact text and the client notification in a second step.

Only then does the existing `private.publish_project_updates` create an update for the client portal and a notification event in the email outbox. There is no AI rewriting, automatic client publication or automatic email when Github activity is detected, a private note is saved, or a task is marked completed.

The new `private.publish_project_work_item` RPC verifies owner authentication and the original task's status, and atomically links a single publication batch. A retry with the same batch is idempotent. Published tasks cannot be edited or re-sent with a different publication key. A notification's recorded queue state is not proof of inbox delivery or reading.

## Security and operational limits

- Work items are stored in `public.project_work_items` with **RLS enabled and no direct grants** to `anon` or `authenticated`. Access is only through owner-guarded RPCs.
- Public `save_project_work_item` and `publish_project_work_item` wrappers delegate to an owner-checked, tightly scoped private function.
- Only Rodney's fixed quote ID accepts the GitHub provenance marker. Other client projects can add manual tasks but cannot accidentally import Rodney's GitHub categories.
- No existing `quotes.journal`, `project_receipts`, `project_payment_statuses` or `email_outbox` rows are modified by the migration.
- A new client notification is triggered **only** by explicitly publishing a completed work task. Do not use production records in tests.
- The separate off-site encrypted backup and isolated disaster recovery validation are **not yet verified**. Run the previously documented Free-plan backup kit on a trusted machine before larger production changes.

## Tests and rollout

`tests/work-item-review.sql` runs in a transaction that is always rolled back. It verifies owner access, safe GitHub provenance, per-date deduplication, immutability after publication, client-visible summary, single email record, idempotent retry, and preservation of private legacy notes. It does not actually send an email.

`tests/project-work-item-review.test.cjs` uses fake browser/Supabase objects and confirms that only allowed GitHub date/category values can reach the owner-only automatic sync RPC, and that client publishing requires both task completion and an explicit confirmation. `tests/auto-github-private-sync.sql` verifies the new RPC transactionally.

### Mobile smoke test

Open installed DZOFT Admin → Dossiers → Projets → Rodney → Journal privé.

1. See the **Tâches et validations** card and existing private notes.
2. Expand the journal: GitHub activity is loaded and recent categories are added automatically.
3. Confirm new private items are **À vérifier**, and pressing **Actualiser** doesn't create duplicates.
4. Update a reviewed task through En cours / Terminé.
5. Only after Terminé, expand the publication review and type an approved summary. **Publishing really notifies the client**, so use a synthetic test client to test the final button; never press it on Rodney just for demonstration.
6. Verify client portal still contains no private work item source data.

### Deliberately not in scope

This is not a GitHub webhook or a push-triggered background import. Categories are automatically registered only while the authenticated admin journal is open and refreshed. The app cannot sync while closed; a separate authenticated server integration is required for that. Task completion and client publication remain strictly manual.
