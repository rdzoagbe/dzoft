# DZOFT — Background GitHub sync and weekly owner review

## Server-side synchronization

The private Rodney/UPZONE project can now synchronize GitHub activity **even when the admin PWA is closed**.

- Source: public `ProjectRodney/ProRod`, branch `main`, maximum 100 recent commits.
- Cadence: PostgreSQL Cron at minutes **17 and 47** of every hour, UTC (~30 minutes; this is polling, **not instant push-triggered webhooks**).
- The cron job invokes the separately deployed `sync-rodney-github` Supabase Edge Function.
- Authentication uses a **random purpose-specific secret generated in Supabase Vault**. It is never committed to GitHub or shown to a client. The Edge Function validates it via a server-only RPC before contacting GitHub.
- The Edge Function reads the **first line only** of each commit locally in memory, maps it to a fixed category, groups by day, then sends **only** `{"date":"YYYY-MM-DD","group":"qr"}` pairs to Supabase.
- The owner-private database RPC checks project ID, date window, allowed groups, and exact JSON keys. Duplicate category/date pairs are ignored, and existing statuses are preserved.
- Up to 40 groups from the latest 14 days are processed each run. Newly detected items are **To verify**, not automatically completed or client-approved.
- The client portal, journal notes, accepted milestones, payments, and email outbox are untouched. **No client notification is sent** by automated sync.

The worker logs and returns aggregate counts only. It does not store or upload raw commit texts, SHA values, diffs, author identities, AI co-author text, prompts, agent/session URLs, or code.

**Limitations:** cron jobs may be delayed or fail due to GitHub availability, rate limits, or hosting issues. The UI shows the last confirmed successful run, not a claim that every GitHub change was captured. Older commits outside the rolling window may never be imported if no run succeeds for an extended period. This is not a verified completion or delivery system.

## Weekly internal review

In **DZOFT Admin → Projects → Rodney → Private project journal**, the new **This week's project review** card shows:
- GitHub topic groups detected this week (no raw descriptions);
- Tasks **To verify**, **In progress**, and **Completed**;
- Categories involved and a safe-to-copy internal summary;
- Whether the backend scheduler is enabled and the time of the last successful server-side sync.

**Copy private review** only copies a generic internal draft to the owner’s clipboard. It does not publish to Rodney. To share anything with the client, the owner must independently validate the work, mark it completed, write and explicitly approve a new client summary, and confirm notification under the existing task workflow.

## Secure storage and incident response

- The database secret is created with `gen_random_bytes(32)` inside Postgres. It stays in Supabase Vault. Do not paste it into code, GitHub Actions, or a chat.
- The Edge Function has `verify_jwt=false` because it performs its own **server-verified cron-token authentication** using a restricted RPC. All unauthenticated and invalid-token requests must return HTTP 401. It uses Supabase's built-in server-only secret key to verify the token and write limited date/category records.
- Secret validation and background ingestion are granted **only** to `service_role`; anonymous and ordinary authenticated accounts cannot call those functions.
- The owner-only sync status RPC exposes timestamps and counts, never tokens or client data.
- Cron and Edge Function errors should be inspected in the Supabase dashboard; aggregate status is not a full error log.
- If stopping background activity, deactivate the `dzoft_rodney_background_git` schedule in **Supabase → Cron**. Revoke/rotate the purpose-specific token if it may be compromised, then redeploy/reconfigure the caller.

## Data backup readiness: still NOT verified

**A working backup tool is not a backup.** The Free-plan project does not provide automatic managed daily backups. A real encrypted database export, off-site copy, separate client Storage object backup, and an isolated restore drill remain the next required owner-side recovery controls.

See [the DZOFT backup guide](backup-recovery.md) for a Windows walkthrough. No production client export was copied into GitHub or used in automated tests, and no unverified recovery status is marked completed.

## Acceptance checks

- [x] Rollback-only tests of input sanitization, duplicate protection and no mail.
- [x] Node tests for owner weekly review and no raw GitHub information crossing the boundary.
- [ ] Deploy Edge Function with purpose-specific token verification; check rejected request.
- [ ] Install database Vault token, RPCs and cron schedule.
- [ ] Verify a successful server run and actual private task counts.
- [ ] Confirm last successful run in admin and that no client-facing publication/email was generated.
- [ ] Create a real encrypted off-site backup and test recovery independently.
