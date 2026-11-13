# Rodney's private project journal — safe GitHub activity

## Behaviour

In DZOFT Admin → Dossiers → Projets → UPZONE (quote D-2026-001) → **Journal privé du projet**, you now have:

1. A **quick note** form: one short note, type (Fait / Demande / Décision / En attente), date, Save.
2. **GitHub activity**, automatically read from the existing public ProjectRodney/ProRod repository when the owner expands the journal. If DZOFT remains open, the feed checks for new commits periodically (15-minute cache). A manual **Actualiser** control is also available.
3. The **eight most recent manual notes** by default, with Voir tout and the existing category filters.
4. Advanced editing, bulk import and copying inside a collapsed toolbox.

No historical manual journal entries were deleted or rewritten by this release.

## What does *not* get imported

The GitHub feed intentionally displays **only**:
- the calendar date of a commit,
- the number of commits on that date,
- fixed, generic, locally computed activity labels (interface, administration, security, etc).

It **never** copies any commit message (including the message body), diff, source file, author identity, AI model credit, co-author, session URL, or SHA into a DZOFT table or the client portal.

The first line of the GitHub commit subject is read only inside the owner's browser to choose a deterministic category. It is immediately discarded, never shown or sent to Supabase. No AI model or external inference service is used. The raw GitHub history already exists publicly on GitHub; this feature does not change those commits.

**GitHub commits are activity, not proof a task is complete or approved by Rodney.** Continue marking manual milestones and publishing client-visible updates explicitly. This feed is never connected to email or automatic client notifications.

## Scope and limitations

- The repository and branch are fixed and explicitly allowlisted as **ProjectRodney/ProRod**, branch **main**. The UI only loads for the exact Rodney quote UUID; other projects cannot accidentally receive Rodney's GitHub activity.
- Data source: public GitHub REST API, latest 100 commits; this is a read-only activity view, **not** a persisted GitHub webhook import. The source must remain publicly readable.
- **Automatic while the admin app is open or whenever the journal is opened**; nothing runs in the background when the installed PWA is closed.
- If GitHub is unavailable or imposes rate limiting, the page shows an error without touching manual journal data. Reopening when available refreshes the timeline.
- No GitHub personal access token, repository action secret, Supabase database change or worker deployment is required.
- The client portal remains unchanged and cannot display the private project journal.

If the GitHub repo becomes private or the project moves to another owner/repository, add a separately authenticated server-side integration and review the allowlist first; **do not place a personal access token in browser JavaScript**.

## Verification

- GitHub CI: `node --test tests/*.test.cjs`.
- `tests/private-github-journal.test.cjs` exercises synthetic commit metadata including AI coauthor text and a session URL; it verifies none appear in the UI.
- Admin/portal SQL regression tests verify private `quotes.journal` is never returned in client-facing RPCs.
- Live browser validation: sign in to DZOFT Admin, open Rodney's project, expand Journal, check grouped dates and quick note. Do not use actual customer notes for automated tests.
