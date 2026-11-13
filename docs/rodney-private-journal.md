# Rodney · UPZONE — private automatic GitHub journal

## Owner experience

Open **DZOFT Admin → Dossiers → Projets → Rodney → Journal privé du projet**.

- Opening the private journal reads recent public activity from `ProjectRodney/ProRod`, branch `main`, through the GitHub REST API.
- DZOFT groups commits by **calendar date + fixed activity category**.
- Recent, previously untracked groups are **automatically added** to `Tâches et validations` with the status **À vérifier**. No button is needed.
- On the next opening or while the admin page stays visible, synchronization runs again; previously added groups are not duplicated or reset.
- The task list shows eight priority items at first, with an option to expand the rest.
- Manually added tasks and the pre-existing private journal remain editable and are not overwritten.
- The GitHub activity panel displays a truthful sync outcome or an error; a failed read/write never claims success.

A single category on one date becomes **one** task even if several commits matched it. The feed reads up to **100 latest commits**; only groups from the **last 14 days** are eligible for automatic task creation, capped at 40 groups per sync. This avoids an unbounded first-run import, but if no one opens DZOFT for a long time, older activity will not be backfilled.

## Privacy: no AI / raw GitHub data imported

Only this exact JSON shape crosses from the admin browser into Supabase:

```json
{"date":"2026-11-13","group":"qr"}
```

The owner-only database function **`sync_project_github_groups`** rejects any extra field, unsupported date/category, wrong quote, or non-owner call. The database itself generates a fixed generic title such as **GitHub · QR codes et accès aux lieux (à vérifier)**. The client portal cannot read the private task table.

The browser reads the **first line** of a commit subject locally *only to classify it*. No original subject, commit body, code, diff, commit SHA, author name/email, AI co-author/assistant/model attribution, source file, token, or session URL is sent to Supabase, saved as a task, or sent to Rodney. No AI model is involved.

**GitHub activity is not proof of completion or successful testing**. All new tasks are **À vérifier**; they are never automatically marked Terminé. Client-facing updates are published only after you independently confirm the task and explicitly review a new human-written summary using **Approuver et notifier**. The normal email outbox then handles delivery.

## What auto means

The **installed PWA must be open** (or reopened) to fetch GitHub activity. When closed, it cannot sync in the background. Periodic refresh is available while the admin journal stays open, with a 15-minute cache to protect against GitHub API rate limits. There is no GitHub webhook or dedicated background worker and no GitHub token in the browser.

For continuously running push-time synchronization while the app is closed, an authenticated server-side worker / GitHub webhook would have to be configured separately, with private credentials and a reviewed repository authorization model.

## Reliability and testing

- `tests/auto-github-private-sync.sql` tests the owner-only RPC, date/category validation, rejecting AI metadata, duplicate protection and no emails inside BEGIN/ROLLBACK. It never sends a production email.
- `tests/project-work-item-review.test.cjs` tests the exact sanitized RPC input and project scoping.
- `tests/private-github-journal.test.cjs` tests simulated GitHub messages containing AI session metadata are not copied to DZOFT.
- The project journal, finance records, invoices, payments, accepted milestones and existing published updates must remain untouched by this release.

Backups: DZOFT's encrypted Free-plan backup toolkit exists, but **a separate off-site backup and restore drill remain unverified**. The synchronization is strictly additive and restricted to the new private work-items table.

## Mobile smoke check

1. Sign in to DZOFT Admin with your owner account and MFA.
2. Open Rodney's project and expand **Journal privé du projet**.
3. Wait for the GitHub activity section and private synchronization status to appear.
4. Check **Tâches et validations**: newly detected activity is **À vérifier**, with generic titles and dates, not raw commit text.
5. Reopen the journal or press **Actualiser**: the number of already-created tasks should not increase for unchanged GitHub history.
6. Do not press **Approuver et notifier** just to test the UI on Rodney: it really publishes a summary and may queue a client email.
