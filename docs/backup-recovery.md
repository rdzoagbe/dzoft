# DZOFT — data recovery readiness and safe deployment

**Current status: backup not independently verified.** A count of client records, a GitHub repository, or a SQL integration test is **not** a recoverable database backup.

## Connected infrastructure checked

- Project: `RD-Clients`, Supabase project ref `rzghbvmszbjlqkdjzpxc` (Paris region).
- Client file bucket: `client-files`, **private**. At the time of review, the bucket metadata showed no stored objects; new files may be uploaded at any time.
- The project plan and its backup retention were **not verified**. Do not assume it has daily backups just because the project is healthy.
- No customer data, authentication tokens, SQL exports or service-role keys belong in GitHub or a public GitHub Actions artifact.

## What the owner must configure

1. Open [Supabase Database Backups](https://supabase.com/dashboard/project/rzghbvmszbjlqkdjzpxc/database/backups) and verify whether an actual usable recovery point exists, the retention period and the most recent timestamp. Supabase has automatic daily backups on **Pro, Team and Enterprise**; **Free** requires manual exports for a recoverable copy. PITR is an optional paid add-on, not enabled here.
2. Independently archive the application schema and database **data** in a restricted, encrypted location. On your trusted workstation, use a current Supabase CLI and first inspect `supabase db dump --help`. In current CLI v3, `--remote` targets the linked database. Example after authenticating and linking the project:
   ```sh
   supabase link --project-ref rzghbvmszbjlqkdjzpxc
   supabase db dump --remote -f ./secure-backups/dzoft-schema.sql
   supabase db dump --remote --data-only --use-copy -f ./secure-backups/dzoft-data.sql
   ```
   The CLI excludes managed schemas by default. Database exports may not cover all `auth` and `storage` metadata; use Supabase's [backup/restore instructions](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) for a full migration and confirm which schemas and roles are included. Never paste passwords or dump file contents into chat.
3. **Storage objects are separate.** Database backups preserve Storage metadata but do **not** restore the actual contents of `client-files`. Use an authenticated, access-controlled export of Storage objects to a separate encrypted archive with a manifest and file hashes. Confirm object counts and names against the Supabase Storage dashboard.
4. Choose a frequency: for a live business, start with a daily backup of database changes and files, with at least one additional off-site copy. Retain several generations and restrict access to the owner.
5. Validate restoration **in an isolated test project**. Check client/quote/receipt counts, invoice files and access controls. Never run `db reset`, `TRUNCATE`, bulk `DELETE` or a restore against the live project without a separately verified backup and explicit approval.
6. Record the last **successful and restore-tested** recovery point. Only after that can the Settings warning be replaced with a verifiable backup status.

## Release acceptance and payment smoke test

- The Today dashboard must show **verified**, **awaiting verification**, **invoices to address** and **client messages** separately; never subtract pending transfers from the remaining balance.
- Payments stay under owner authentication and MFA. Clicking a Today card must **navigate**, not confirm or send money.
- Test existing `tests/payment-status-lifecycle.sql` and `tests/payment-method-correction.sql` inside `BEGIN ... ROLLBACK` transactions. Verify a new `tests/payment-notification-journey.sql` also rolls back its fixture and email jobs.
- A confirmed payment should update total received and remaining, and queue the optional client notification only when requested. The outbox's `sent` status indicates provider acceptance, not guaranteed inbox receipt/read.
- Check a 390px viewport and English/French labels on an authenticated test account. Automated JavaScript contract tests do **not** prove the full Supabase login and email provider workflow.
- Before and after release, compare counts and row fingerprints of client, quote and payment records. **Matching fingerprints are a consistency check, not a backup.**

## Future reliability milestones

Set up a dedicated administration origin to isolate browser session storage, an authenticated browser test account for staging, and periodic tested backups of both Postgres and Storage. Keep production clients and notifications out of test fixtures.
