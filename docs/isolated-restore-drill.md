# DZOFT — Isolated recovery drill checklist

**Status: NOT restore-tested.** This checklist prevents a successful encrypted-export check from being mistaken for a recoverable Supabase project.

## Verified inventory snapshot — 15 November 2026

A read-only query against the connected DZOFT Supabase project returned:

| Resource | Observed |
| --- | ---: |
| `public` base tables | 17 |
| `private` base tables | 6 |
| Supabase Auth accounts | 3 |
| Objects in private `client-files` bucket | 0 |
| Independently stored encrypted export | Not verified |
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
