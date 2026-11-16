# DZOFT — Isolated recovery drill checklist

**Status: NOT restore-tested.** One encrypted application-data archive was later uploaded to Google Drive and the downloaded copy successfully decrypted/validated. The full restore and Auth account re-association remain untested. The downloaded Auth recovery ledger has been independently SHA-256 matched, decrypted and validated on the owner's PC. See [Auth recovery plan](auth-recovery.md). This checklist prevents a successful encrypted-export check from being mistaken for a recoverable Supabase project.

## Current inventory change — 16 November 2026

A read-only SQL aggregate found **3 private `client-files` Storage objects** in RD-Clients, compared with **0 objects** during the original November 15 archive. See [backup-recovery.md](backup-recovery.md#recovery-protection-update--16-november-2026-read-only-inventory) for the current counts and the verified-Storage-count CLI backup procedure. This is not evidence those three object bytes are present in the previous archive. The real recovery drill is still unperformed; do not remove the NOT VERIFIED warning.

## Verified inventory snapshot — 15 November 2026

A read-only query against the connected DZOFT Supabase project returned:

| Resource | Observed |
| --- | ---: |
| `public` base tables | 17 |
| `private` base tables | 6 |
| Supabase Auth accounts | 3 |
| Objects in private `client-files` bucket | 0 |
| Independently stored encrypted export | One Google Drive copy downloaded and decrypted; full restore not tested |
| Auth/Storage restoration test | Not performed |

These are **point-in-time counts**, not a manifest of a particular backup; counts and content may change.

## Before a backup counts as independently protected

1. Use a trusted, disk-encrypted Windows machine with current Supabase CLI, Python and the pinned cryptography library; never provide credentials to ChatGPT.
2. Run the repository's `tools/backup-dzoft-windows.ps1` interactively. Use a destination **outside GitHub, outside Supabase, and outside the local system disk**, or an access-controlled cloud folder whose completed synchronization you independently verify.
3. Supply and safely preserve a unique, strong encryption passphrase using a password manager. Never store it in the repository or print it into logs.
4. Confirm the script reports an encrypted archive, exact copied-file SHA-256 match, and a **successful independent decrypt-and-verify of the destination copy**. A same-drive folder alone is not independent protection.
5. Check the archive status:
   - `exported` means the Storage CLI downloaded objects and the archive contains the declared file count.
   - `verified_empty_by_cli` means the CLI listed no Storage objects **at the time of export**.
   - `skipped_by_operator` is a **partial database-only archive**; it cannot substantiate full application backup readiness.
6. Retain multiple dated encrypted copies and protect the encryption passphrase separately.

## Offline preflight on Windows (read-only, no Docker, no PostgreSQL server)

**First run this before attempting any database restore.** The tool inspects the original native encrypted `.dzoftbak` using PostgreSQL 18's local `pg_restore.exe`. It never connects to Supabase or local PostgreSQL, never executes SQL, and never writes plaintext SQL or a dump file.

From the existing local DZOFT checkout, on the Windows computer holding the encrypted archive:

```powershell
Set-Location "$HOME\DZOFT-Backup-Runner"
git pull --ff-only

python .\tools\preflight_dzoft_restore.py `
  --archive "$HOME\DZOFT-Backups\dzoft-20261115-145839Z-b191cd.dzoftbak" `
  --pg-bin "C:\Program Files\PostgreSQL\18\bin"
```

Enter the **database backup** encryption passphrase locally (not the separate `.dzoftauth` passphrase unless you deliberately chose them to be the same). No Supabase password is needed. Do not share a passphrase or plaintext SQL in chat.

What preflight does:
1. Fully decrypts and validates the DZOFT authenticated envelope, ZIP manifest, CRC and SHA-256 checks, all in memory.
2. Runs local `pg_restore --list` over the in-memory custom PostgreSQL archive; counts application tables, data entries, functions, policies and FK constraints without printing names or data.
3. Runs `pg_restore --schema-only --no-owner --no-privileges --file=-` to **render** schema SQL to memory and flags managed Auth and Storage dependencies.
4. Runs `pg_restore --no-owner --no-privileges --file=-` to **render and decompress the full SQL** while immediately discarding stdout; it does not produce a file or run a database server.

A `PASS` means the backup envelope, table of contents, schema rendering and full SQL rendering were readable. A `BLOCKER` or `DEPENDENCY` identifies work required before a standalone restore (most notably foreign keys to `auth.users` and `auth.uid()`). **Even if every preflight check passes, no actual database restore, row-count verification, Auth login, RLS or isolated project test has been performed.** Keep readiness marked **NOT VERIFIED**. This is a necessary but insufficient prerequisite to a restoration exercise.

Any future **actual** local restore must be performed in a separately initialized PostgreSQL cluster with no production connection strings, or on a separately approved disposable target, after planning managed Auth schema and extension dependencies. Do **not** point `pg_restore -d`, `psql`, or a Supabase CLI restore command at the production project.

## Simplified Windows one-click local check (preferred for this owner)

Use the reviewed \`Start-DZOFT-Recovery.cmd\` at the repository root, or the identical file supplied in the conversation as a downloadable single-click helper. This is a Windows Command Script for the **existing, initialized** Recovery Lab and the **existing** 15 November 2026 native encrypted backup. It does not create a new lab or perform a complete disaster restore.

1. Save the script from the trusted DZOFT repository (or conversation attachment) on the owner's Windows computer.
2. Review it before running, then **double-click** it. Do not use Run as Administrator.
3. It checks that the local backup, lab data directory, PostgreSQL 18, Git and Python exist. It requires the local DZOFT working copy to be on \`main\`.
4. It fast-forward-updates the local checkout from the **exact official GitHub repository URL** and launches \`tools/restore_dzoft_lab_schema.py\`. GitHub gets no backup data or passwords.
5. Enter the two secrets **on the local computer only**: (a) the locally created recovery lab administrator password; and (b) the encrypted \`.dzoftbak\` **database** archive passphrase. Neither is the Supabase DB password, nor should either be shared through chat.
6. Read the final message: **schema stage complete**, or **needs review / blocked**. The helper pauses so that the window stays visible. In either case **full recovery is NOT verified**; additional application data, Auth, FK, Storage and RLS tests are required.

On a blocker, the Python tool runs the schema in a single transaction so it rolls back failed schema modifications; it does not retry or silently create fake Supabase users. Do not override SmartScreen/Windows security warnings casually: inspect the script and confirm the copy came from the official repository. Do not turn off antivirus or device protection.

## Verified local lab prerequisite and schema-stage rehearsal

On 15 November 2026, the operator provisioned PostgreSQL 18 on Windows with a second server bound to 127.0.0.1:55439 and database dzoft_restore_test. Both the database path and empty app-table count were independently checked via psql. BitLocker reports 100% used-space encryption and Protection On. Locally, pgcrypto and uuid-ossp were installed into extensions; anon, authenticated and service_role exist as NOLOGIN NOBYPASSRLS roles. These are **local-only compatibility roles, not a complete Supabase role/security implementation**.

The next step is a **schema PRE-DATA only** restore; it does not import customer rows, foreign keys, RLS policies, grants or users. Only run the script after reviewing the backup's trusted provenance and ensuring the machine is encrypted. PostgreSQL restore executes SQL from the source archive even when restoring only a section.

On the same Windows machine from the existing DZOFT repository:

\`\`\`powershell
Set-Location "$HOME\DZOFT-Backup-Runner"
git pull --ff-only
python .\tools\restore_dzoft_lab_schema.py \`
  --archive "$HOME\DZOFT-Backups\dzoft-20261115-145839Z-b191cd.dzoftbak" \`
  --pg-bin "C:\Program Files\PostgreSQL\18\bin"
\`\`\`

The script prompts separately for the local lab password and DZOFT encrypted **database** backup passphrase. The passwords never appear in terminal command history or GitHub. It decrypts the trusted archive in memory, checks the current database name, literal loopback endpoint, listening address, exact Windows data directory, zero application tables, expected extensions and restricted roles. It then runs pg_restore on stdin in a single SQL transaction with the **pre-data** section only. It uses IF EXISTS cleaning only on the exact disposable lab and only when zero app tables are present, to handle PostgreSQL's pre-existing default public schema. It does not create fake Auth users or install missing Supabase-managed extensions.

If any dependency causes a failure, pg_restore's one-transaction mode rolls back its SQL; the script reports a sanitized cause and leaves the actual data restore **pending**. Do not repeat a successful schema stage in the already-populated lab: the script refuses overwriting existing app tables. If schema creation succeeds, compare the restored table-definition count to the archive. Full recovery still requires post-data constraints, Auth mapping, security, and row-by-row verification, followed by separate data restoration. Keep the full readiness banner **NOT VERIFIED** until an end-to-end drill succeeds.

## Isolated restore drill: do not restore over production

**Stop before running any SQL unless your target is a separately created, disposable test environment**. Do not run restore commands against `rzghbvmszbjlqkdjzpxc`.

1. Create a disposable, separately authenticated PostgreSQL/Supabase **test** target. If this incurs charges, obtain approval first; do not assume development branches are free.
2. Choose a separate, encrypted local extraction folder. Run `python tools/backup_dzoft.py verify <archive>` and then `python tools/backup_dzoft.py extract <archive> --destination <empty-folder>`. The extraction produces **sensitive plaintext**; never upload this folder or its contents to GitHub, a bug report, or a chat.
3. Inspect the manifest and the selected export format:
   - Supabase CLI split-SQL archives include `database/schema.sql`, `database/data.sql`, and `database/roles.sql`.
   - Docker-free native PostgreSQL archives include `database/application.dump` (custom-format `PGDMP`). They **do not** include managed database roles, Auth, or Storage objects. Use `pg_restore --list` on the extracted custom archive to inspect contents before planning an isolated restore. Do not run `pg_restore --dbname` against the live project.
   - In both cases, cross-check the manifest, hashes and exact Storage state (`verified_empty_by_cli`, `verified_empty_by_sql`, or explicitly partial `skipped_by_operator`).
4. **Do not assume that the schema/data SQL will restore independently.** The Supabase CLI intentionally excludes the platform-managed `auth` and `storage` database schemas. Inspect and resolve dependencies (including foreign keys to `auth.users`, RLS, extensions, grants and Storage metadata) on the disposable target.
5. Restore only after reviewing SQL content and the actual target. Validate expected application table counts and key project/receipt relationships without copying any production customer data into a public environment.
6. Test representative role denial (anonymous/client cannot read other clients, invoices or banking settings), owner MFA authorization, email-based routing, quote/project retrieval, invoice archive access, and Storage object retrieval.
7. Document exact expected and observed results. **If even one critical identity, authorization, or file-restoration check fails, mark disaster recovery NOT verified.** Delete test artifacts using appropriate secure procedures.

## Critical gap: Supabase Auth is not included

The current encrypted application-data export does **not** include managed Supabase Auth users, identities, MFA factors, hashed credentials or sessions. The live project had three Auth users when inspected on 15 November 2026.

This matters because `clients.user_id` and related references may point to Auth identifiers that do not exist in a newly created Supabase project. Do not automatically recreate clients, rewrite IDs, or change production authentication to make a restoration succeed. A **separate, carefully reviewed identity-recovery plan**, including secure re-enrollment and association of client records with server-verified users, is required.

The backup tool also cannot reconstruct Auth configuration, provider secrets, all Storage metadata, project-level settings, Edge Function secrets, webhooks, or external integrations merely from the SQL/Storage files. Those require a separately maintained, secure configuration and restoration procedure.

## Readiness criteria

- [ ] Real application-data export completed successfully
- [ ] Encrypted archive exists independently of GitHub and Supabase
- [ ] Off-site copy independently decrypted and hashes verified
- [ ] Every real Storage object accounted for or separately protected
- [ ] Identity recovery process tested without weakening authentication
- [ ] Schema, data, private Storage and RLS restored and tested on disposable isolated infrastructure
- [ ] Representative invoices, account routes and project records verified
- [ ] Documented restore steps and evidence of a successful drill

**Until every applicable criterion is met, keep the DZOFT Admin warning "Sauvegarde récupérable : non vérifiée."**

See [backup-recovery.md](backup-recovery.md) for backup preparation, CLI setup, encryption and Windows invocation. This guide contains **no passwords, access tokens, database dumps, or client records**.
