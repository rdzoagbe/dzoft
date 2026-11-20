# DZOFT — Disaster-recovery evidence audit (20 November 2026)

**Project:** RD-Clients (Supabase Paris) · **GitHub issue:** #72  
**Result: NOT RESTORE-VERIFIED.** This audit was read-only on the live project. The companion
pull request adds an **offline evidence gate**, not a remote backup or a finished restore.

## 1. Live inventory verified on 20 November 2026

The following are aggregate-only database/API observations; customer names,
object names, personal identifiers, access tokens and invoice PDFs were not read.

| Component | Verified live count | What the current backups must cover |
| --- | ---: | --- |
| Application tables, `public` | **18** | Schema, rows, indexes, RLS, triggers, grants, functions |
| Application tables, `private` | **8** | Schema, rows, restricted RPC grants, immutable registry and history |
| Managed Auth users | **3** | Separate encrypted mapping; credentials cannot be reconstructed |
| Storage buckets | **1** | Bucket creation/configuration and policies on restored platform |
| Objects in private `client-files` bucket | **3** | Actual three object **bytes**, not merely database metadata |
| Deployed Supabase Edge Functions | **9** | Current function source and per-function configuration |
| GitHub `supabase/functions/` directories | **7** | Recovery source inventory is not yet complete |
| Owner browser-backup log entries | **1** | **Not proof** of a full, encrypted, restorable external backup |

The most recent *browser backup log event* was **18 November 2026, 17:31 UTC**;
a log event is not evidence that Google Drive received a complete application
database, Auth mapping, private files and Edge Function configuration.

### Edge Function source mismatch

Two deployed names did **not** have matching source directories at the time of
inspection: `brevo-diag` and `sync-rodney-github`. Both remain deployed and
their source retention/necessity must be reviewed separately. The repository
contains `sync-project-github`; do **not** assume the older deployed function
is equivalent or delete/replace a production function without reviewing the
cron and notification dependencies. The other seven deployed function slugs
have corresponding source directories. This is a recovery blocker even if the
PostgreSQL dump is completely readable.

### Other unproven components

- Original 15 November native encrypted database archive was integrity-checked,
  but it predates the three Storage objects observed later.
- The 15 November encrypted Auth inventory is mapping metadata, **not** a
  backup of credentials, passkeys, TOTP secrets, sessions or OAuth/SMTP settings.
- The 16 November Storage count discrepancy was diagnosed in the backup tool,
  but there is no verified **current full export plus isolated restore**.
- Supabase migration-history timestamps/names still differ from some GitHub
  migration filenames. Preserve live history and reconcile offline before a
  fresh target is populated.
- Database backups do not contain private Storage object bytes, managed
  Auth credentials, all functions, secrets, webhooks or project configuration.
- External messaging, invoice issuance and scheduled jobs **must be disabled**
  before a disposable recovery rehearsal, otherwise test data could trigger
  real integrations.

## 2. New offline evidence gate

`tools/check_dzoft_recovery.py` runs on the owner's trusted Windows machine,
**never in GitHub Actions using real backup files**. The tool:

1. Authenticates/decrypts one encrypted application archive and verifies every
   manifest entry's content checksum and archive CRC.
2. Refuses a backup that contains zero/partial Storage when the user-supplied,
   newly refreshed live count is nonzero. With the 20 November inventory, the
   expected count is **three**.
3. Checks timestamp freshness against an explicit window (72 hours by default).
   A historical archive can remain valid evidence of old data yet fail
   *current recovery* freshness.
4. Verifies a **different, independently obtained encrypted off-site copy**
   has the same SHA-256 and can decrypt; rejects a same-file or hardlinked
   alias. **The operator must still confirm** the copy was really obtained
   from a separate protected storage location: software cannot prove that.
5. Independently decrypts the separate Auth identity-mapping ledger and
   validates user count, unique source IDs and exactly one owner marker.
6. Optionally invokes trusted local `pg_restore` **without any database
   connection** to inspect a native archive's TOC, render schema SQL in memory
   and stream full data SQL to discarded stdout. It never runs the SQL.
   Supabase CLI split-SQL files require their own separate staging restore.
7. Prints **counts and status only**. It never prints passphrases, filenames
   inside the archive, personal emails, documents, database connection strings
   or SQL. Error messages are sanitized.
8. Always prints **NOT RESTORE-VERIFIED**, regardless of passed evidence.
   Missing/expired evidence or actual-restore gate returns a nonzero exit
   status; it cannot be misread as proof of a successful recovery.

### Local command — only after obtaining a **fresh** encrypted full backup

On your encrypted Windows machine, with an official updated repository and
your privately held encrypted files, substitute the exact paths, do **not**
paste any secret into a command or chat:

```powershell
Set-Location "$HOME\DZOFT-Backup-Runner"
git pull --ff-only

python .\tools\check_dzoft_recovery.py `
  --archive "$HOME\DZOFT-Backups\ACTUAL-NEW-FULL-ARCHIVE.dzoftbak" `
  --offsite-copy "$HOME\Downloads\ACTUAL-NEW-DOWNLOADED-COPY.dzoftbak" `
  --auth-archive "$HOME\DZOFT-Backups\ACTUAL-NEW-AUTH-LEDGER.dzoftauth" `
  --expected-storage-count 3 `
  --expected-auth-count 3 `
  --max-age-hours 72 `
  --pg-bin "C:\Program Files\PostgreSQL\18\bin"
```

The figures **3 Storage objects / 3 Auth users were observed on 20 November
2026**. Repeat the read-only inventory immediately before export. If they
change, use the newly verified counts; never alter them simply to make the
checker pass. The archive and off-site copy must be new: the 15 November
database-only archive cannot satisfy the three-current-files requirement.
A newer Auth ledger is also needed to satisfy the freshness window.

**Caution:** the tool deliberately exits **2** even when all offline checks
pass, because the isolated database, Auth remapping and private-file restore
remain unperformed. Read `PASS`, `PENDING` and `BLOCKED` messages instead
of assuming a zero exit code means recoverable.

If the backup is a split-SQL Supabase CLI archive, omit `--pg-bin` if desired;
the tool still validates the encrypted archive/storage/identity/offsite copy,
but cannot certify SQL replay.

The existing `Start-DZOFT-Recovery.cmd` is *schema PRE-DATA only* on a
hard-pinned local PostgreSQL lab. It is not a restore of the application data.

## 3. Real isolated recovery drill — still needed

The next real recovery test requires a trusted copy of the **new encrypted
full backup** and the decryption passphrase *on your machine*, plus a
separate disposable PostgreSQL/Supabase test environment. Do not put
passwords, dumps or clients' document bytes in GitHub, ChatGPT, logs or
unrestricted cloud storage.

**Preconditions:** fresh DB+Storage backup and decrypted offsite copy; a
current Auth identity ledger; source/configuration of all active Edge
Functions; a verified disposable target with no production network/auth
settings or outbound email/scheduled jobs; source and target migration
histories reconciled.

**Restore test, in order:** target-only check → platform-managed Auth/Storage
prerequisites → application schemas → application rows → indexes/FKs/RLS/
grants and SECURITY DEFINER boundaries → Storage objects with byte-level
checksum comparison → independently recreated Auth identities with
validated old→new ID mapping (never claiming passwords or passkeys were
restored) → owner/client isolation and logged-in navigation tests → invoices,
receipts, official archived PDFs and private documents → settings, secrets,
scheduled jobs and Edge Functions configured *without activating external
side effects*.

**Acceptance evidence:** numeric before/after table row counts; zero
unmatched FK mappings; counts/hashes of the three Storage objects; login
and least-privilege results for independent test identities; stable
invoices/receipts/credit-note registry; successful redirection and static
site deployment; a signed-off recovery date and reproducible procedure.
Do not mark #72 closed on archive verification or schema-only restoration.

## 4. What was / was not done in this PR

| Activity | Status |
| --- | --- |
| Recheck live project, Auth, Storage and Edge Function inventory | **Completed read-only** |
| Find missing Edge Function source names | **Completed** |
| Add encrypted, checksum-checked offline completeness/offsite/Auth gate | **Implemented with synthetic tests** |
| Document safe owner commands and full restore acceptance gates | **Completed** |
| Capture a new real encrypted DB + all three private object bytes | **Not performed** |
| Independently download/verify its private offsite copy | **Not performed** |
| Restore rows + security + Auth mappings + Storage to disposable target | **Not performed** |
| Recreate missing source for deployed functions | **Not performed; separate source/cron review needed** |
| Alter production RD-Clients tables, policies, users or payments | **Never attempted** |

## 5. Official documentation

- Supabase database backup guidance: https://supabase.com/docs/guides/platform/backups
- Supabase CLI database dump limitations (managed `auth`/`storage`
  schemas excluded):
  https://supabase.com/docs/reference/cli/supabase-db-dump
- Supabase Storage object downloads:
  https://supabase.com/docs/guides/storage/management/download-objects
- Restore/migrate within Supabase:
  https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Repo guides: [backup-recovery.md](backup-recovery.md),
  [isolated-restore-drill.md](isolated-restore-drill.md),
  [auth-recovery.md](auth-recovery.md).

**Issue #72 remains OPEN until a real isolated data+Auth+Storage recovery
drill produces auditable proof.**
