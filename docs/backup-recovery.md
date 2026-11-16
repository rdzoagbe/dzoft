# DZOFT — Secure backup and recovery


## Windows CLI Storage download fix — 16 November 2026

The Supabase CLI successfully exported the DZOFT database after Docker Desktop was enabled, but the encrypted backup correctly stopped at `storage cp -r` with **"Unsupported operation"** when the CLI received an absolute Windows scratch path. The backup tool now runs `supabase storage cp -r ss:///client-files . --experimental --remote` **from inside its isolated temporary directory** instead of passing an absolute Windows destination. No remote Storage objects are modified; all previous expected-count and listing-stability checks remain in force. Synthetic CLI tests require this exact relative-destination behavior in both legacy and v3 command modes.

On the owner's Windows machine, update the trusted repository, check that the independent backup drive is available, verify the current Storage object count in a **read-only** SQL query, and retry:

```powershell
cd "$HOME\\DZOFT-Backup-Runner"
git pull --ff-only
Test-Path "E:\\"
.\\tools\\backup-dzoft-windows.ps1 -OffsitePath "E:\\Private-DZOFT-Backups" -ExpectedStorageCount 3
```

**Use 3 only if a fresh SQL inventory still returns 3.** The script prompts for the encryption passphrase again; earlier failed executions created no archive. A passing encrypted and copied backup still does **not** verify that full data, Auth accounts and private files can be restored. Keep recovery marked **NOT VERIFIED**.

## Recovery protection update — 16 November 2026 (read-only inventory)

The connected **RD-Clients** project remains active. Its live inventory, checked using aggregate read-only SQL on 16 November, shows **17 public application tables**, **6 private tables**, **3 Auth users**, **one Storage bucket** and **three objects in `client-files`**. Earlier 13–15 November checks recorded zero Storage objects. The existing November 15 encrypted database archive therefore cannot be used as proof of recoverability for documents uploaded since then. No object names, customer details, account emails or passwords were exported during this review.

**Status: NOT RESTORE-VERIFIED.** The 15 November application-data archive had been decrypted and validated from a privately stored cloud copy, and the separate Auth mapping ledger had passed its copy hash and decrypt checks. Neither constitutes a demonstrated restore. The local `restore_dzoft_lab_schema.py` supports only a tightly pinned **schema PRE-DATA** stage; it does not restore complete application rows, private Storage objects, Auth credentials, RLS grants, Edge Functions or SMTP configuration.

**Critical Storage safety change:** The native `-NativePostgres` backup refuses to call a snapshot complete if `client-files` is nonempty (it may explicitly export a **PARTIAL database-only** archive with `-SkipStorage`). The alternative **Supabase CLI backup mode** can include files, but must be run on a trusted disk-encrypted Windows computer. From **SQL Editor** in the same RD-Clients project, immediately before running the export, use this read-only query and record only the total:

```sql
select count(*) as client_files_objects from storage.objects where bucket_id = 'client-files';
```

Then from the official checked-out DZOFT repository on your trusted Windows PC, using a genuinely independent, restricted off-site destination, run the **CLI** (not native PostgreSQL) backup with the count returned by the query. For the inventory seen during this audit, that count was **3**; **refresh it before using the command**:

```powershell
.\tools\backup-dzoft-windows.ps1 -OffsitePath "E:\Private-DZOFT-Backups" -ExpectedStorageCount 3
```

The updated backup tool requires an independently verified expected count if the CLI Storage listing is nonempty. It refuses an absent, zero or mismatched count, and re-lists Storage after the download to detect changes while exporting. The encrypted manifest must report `exported`, and the independent copy must pass SHA-256 comparison and passphrase-protected verification. These checks cannot guarantee the files' individual content or permit restoring the project; all three files must also be checked in a **disposable isolated restoration drill** before declaring recovery readiness.

**Do not** use `-SkipStorage` to bypass the completeness check, restore to production, put backups or passphrases on public GitHub, or paste client filenames and confidential SQL into support chats. The encrypted archive, Auth-ledger passphrase and any Supabase database password should remain outside the repository. If the CLI's commands are no longer supported, stop and inspect `supabase storage ls --help` / `supabase storage cp --help`; do not force a local or differently linked export.

Supabase Free does not include automatic daily managed backups, and even managed database snapshots do **not** contain Storage object bytes. See [official Supabase database backup guidance](https://supabase.com/docs/guides/platform/backups) and [Storage download guidance](https://supabase.com/docs/guides/storage/management/download-objects).

## Recovery milestone — 15 November 2026

The owner created an encrypted native PostgreSQL application-data archive `dzoft-20261115-145839Z-b191cd.dzoftbak` (57,786 bytes), copied it to private Google Drive, downloaded it back and successfully ran the authenticated backup integrity/decryption verification on that downloaded copy. The original and downloaded file SHA-256 values have **not yet been compared side-by-side**. This establishes one verified readable cloud copy, **not** a proven database restore or complete Supabase disaster-recovery image.

**Auth recovery is a separate step:** see [Supabase Auth recovery and encrypted identity mapping](auth-recovery.md). The optional `tools/backup_dzoft_auth.py` tool produces an encrypted `.dzoftauth` metadata ledger (old user UUIDs, emails, provider names and account-link counts) without exporting credentials. On 15 November 2026, the owner created an encrypted Auth ledger `dzoft-auth-20261115-153623Z-6a1ee7.dzoftauth`, uploaded it privately to Google Drive, downloaded a copy, confirmed its SHA-256 exactly matched the local file, and successfully ran `backup_dzoft_auth.py verify` (3 accounts and 1 owner marker). This is account mapping metadata, NOT a credential recovery or Auth restore.


## Verified infrastructure (13 November 2026)

| Area | Finding |
| --- | --- |
| Supabase | RD-Clients, project rzghbvmszbjlqkdjzpxc, active |
| Plan | **Free** — no automatic daily managed database backups |
| Documents | Private Storage bucket client-files; 0 objects at last inspection |
| Independent off-site backup | **Encrypted application-data file exists in Google Drive; downloaded copy passed integrity and decryption checks on 15 November. Full restore NOT tested.** |
| Managed Auth identities | **3 accounts observed 15 November 2026 — excluded from the application export** |
| Recovery drill checklist | [Isolated restore drill](isolated-restore-drill.md); no real restore completed |
| Windows verified-copy launcher | CLI selector corrected and synthetic tests added; no real off-site backup or restore test yet |
| Public GitHub | rdzoagbe/dzoft — NEVER commit archives, passphrases or credentials |

Supabase recommends off-site database exports for Free projects. Database backups do not include the actual Storage objects, only metadata.


## Windows 11: Docker-free encrypted backup with PostgreSQL 18

This workflow uses **native pg_dump**, not Docker or the Supabase CLI. It preserves the current GitHub Pages + Supabase Free setup. It creates **one consistent custom-format PostgreSQL snapshot of public and private application schemas**, encrypted immediately in memory into a .dzoftbak file. It intentionally does **not** export managed Auth data, Supabase service roles, project settings or Edge Function secrets. It does not restore, change, or upload any client data.

**Prerequisites:** PostgreSQL 18 Command Line Tools (pg_dump, pg_restore, psql), Python with the existing cryptography dependency, a trusted PC with device encryption, and a secure external or independently synced folder. Check `"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" --version`. The client PostgreSQL version can be newer than Supabase's database version.

### Configure your correct database connection

1. Open [DZOFT Supabase → Connect](https://supabase.com/dashboard/project/rzghbvmszbjlqkdjzpxc?showConnect=true) and choose **Session pooler** (port 5432) if your Windows internet connection uses IPv4. Copy **host** and **user** separately from the Connect details. The user must have the form `postgres.rzghbvmszbjlqkdjzpxc`. The port 6543 **transaction pooler must not be used**. If direct IPv6 works, the correct host is `db.rzghbvmszbjlqkdjzpxc.supabase.co` and user is `postgres`.
2. Retrieve your **database password** privately from Supabase's secure settings. Never send it through chat, insert it into a command, add it to source code or copy the full connection URL into terminal history.
3. Optionally download the project's SSL CA certificate from Supabase's SSL/connection settings and supply `-PgSslRootCert "C:\path\to\supabase-ca.crt"` for **verify-full** identity checks. Without it, SSL is required but server certificate identity is not independently verified.
4. Run `git pull --ff-only` inside your existing DZOFT checkout **after the reviewed PR is merged to main**. Before merge, use a separate checkout on the feature branch to run an isolated synthetic test; do not replace the production script manually.

From PowerShell in `C:\Users\<WindowsUser>\DZOFT-Backup-Runner`, using the exact host and user from your Supabase dashboard, and with an independently protected destination connected:

```powershell
.\tools\backup-dzoft-windows.ps1 -NativePostgres `
  -PgHost "HOST_FROM_SUPABASE_CONNECT" `
  -PgUser "postgres.rzghbvmszbjlqkdjzpxc" `
  -PgPort 5432 `
  -PgBin "C:\Program Files\PostgreSQL\18\bin" `
  -OffsitePath "E:\Private-DZOFT-Backups"
```

The script securely prompts for the **database password** and a separate, strong **encryption passphrase**; it does not store either. Its PostgreSQL child processes receive the database password in process environment (not command line). It uses `pg_dump --format=custom --schema=public --schema=private`, passes the dump in memory to the encrypted backup helper, then verifies that the resulting archive is decryptable. It copies the encrypted archive to the chosen destination, SHA-256 compares it, and independently decrypt-verifies that copy with your passphrase again. Do not use a destination under GitHub.

If `storage.objects` reports **zero** objects in the private `client-files` bucket before and after the dump, the manifest records `verified_empty_by_sql`. If it reports objects or cannot be checked, the script **fails closed**. To intentionally create a **partial database-only archive** while separate object backup arrangements are made, add `-SkipStorage`; never treat such an archive as complete. Other buckets, managed Storage metadata, Auth credentials, email provider settings, managed roles and secrets are not backed up by this helper.

**Safe offline preflight:** Before attempting any database restore, use `python tools/preflight_dzoft_restore.py --archive <existing.dzoftbak> --pg-bin "C:\\Program Files\\PostgreSQL\\18\\bin"` on the trusted Windows PC. The tool authenticates/decrypts the encrypted native PostgreSQL archive, inspects `pg_restore --list`, renders schema SQL in memory and decompresses full SQL into a discarded stdout stream. It **never connects to or changes any database**, and never writes plaintext. The output highlights managed Auth/Storage dependencies but **cannot establish restorability**. See [the preflight and isolated restore checklist](isolated-restore-drill.md).

**Native restore format:** The encrypted archive contains `database/application.dump` rather than the CLI workflow's separate `database/schema.sql`, `database/data.sql`, and `database/roles.sql`. Extract only in an isolated encrypted folder. The `.dump` file is PostgreSQL custom format intended for `pg_restore` after manually preparing a disposable target. It is not an immediately-restorable full Supabase image. Do not restore it to the production database. Refer to the isolated recovery drill guide and explicitly check owner grants, policies, Auth references and extensions.


## Windows 11: create a local encrypted application-data backup

This repository includes [tools/backup_dzoft.py](../tools/backup_dzoft.py). It was tested with synthetic data only. It is an export helper, not a managed backup service.

1. On your trusted Windows computer with BitLocker/Device Encryption enabled, install a current **Supabase CLI** and Python 3.12+. Follow the official Supabase CLI installation guide.
2. Download or clone this GitHub repository. Open Windows Terminal (PowerShell) in the repository folder.
3. Install encryption dependency:

        python -m pip install cryptography==46.0.4

4. Authenticate locally and check commands:

        supabase --version
        supabase db dump --help
        supabase storage ls --help
        supabase login
        supabase init
        supabase link --project-ref rzghbvmszbjlqkdjzpxc
        python tools/backup_dzoft.py self-test

   Supabase CLI v3 (November 2026) defaults database commands to the **local** stack unless `--remote` is specified. It supports `supabase db dump --remote=<project-ref>` and deprecates the older `--linked` flag. Older CLI versions may still require `--linked`. The DZOFT helper uses `supabase link --project-ref rzghbvmszbjlqkdjzpxc` and then checks each command's `--help` to select the **supported explicit remote-target option**; it refuses to dump anything if it cannot verify a supported remote option. Storage commands are checked independently. Source: [Supabase CLI v3 breaking-change notice](https://supabase.com/changelog/supabase-cli-v3). If the repository already has a Supabase config, skip `supabase init`; never overwrite a working configuration. The backup tool re-links to RD-Clients before every export and runs commands from the DZOFT repository root to prevent exporting a different linked project. Supabase may request the database password **on your computer**. Never send credentials to ChatGPT or commit them to GitHub. <Link to official Supabase CLI guide: https://supabase.com/docs/reference/cli/supabase-db-dump>.

5. Run backup:

        python tools/backup_dzoft.py backup

   Enter a unique encryption passphrase of at least 16 characters twice. The script saves one encrypted .dzoftbak file under your home DZOFT-Backups directory. **Store the passphrase in your password manager**; losing it makes the file unreadable.

6. Verify the file using the exact filename printed by the backup tool:

        python tools/backup_dzoft.py verify "C:\path\to\your\backup.dzoftbak"

   The script verifies encryption authentication, archive CRC checks and SHA-256 hashes. It automatically verifies right after writing the file.

7. **Copy the encrypted .dzoftbak off the computer** to another restricted location (encrypted external drive or separately secured cloud storage), keeping several generations. Do not commit it to this public GitHub repository or attach it to an email.

### Windows: guided encrypted copy to a separate destination

A Windows PowerShell launcher is included at [tools/backup-dzoft-windows.ps1](../tools/backup-dzoft-windows.ps1). It **runs the existing encrypted backup tool** interactively on your trusted PC, then copies the new encrypted `.dzoftbak` file to a directory you choose and compares SHA-256 hashes. It never saves the passphrase, uploads unencrypted SQL or performs a restore.

After following the Python/Supabase CLI preparation above, connect an encrypted external drive or configure a restricted, independently synchronized cloud folder. In PowerShell **from the repository root**, run (replace the example destination with your own real location):

```powershell
.\tools\backup-dzoft-windows.ps1 -OffsitePath "E:\Private-DZOFT-Backups"
```

The tool asks for the encryption passphrase through Python, saves a separate local and destination copy, compares their SHA-256 hashes and **asks for the passphrase a second time to independently decrypt and verify the destination copy**. Check that the destination is actually **off-site** or independently protected; a second folder on the same disk is not an off-site backup. The launcher displays a warning for same-drive copies. A successful encrypted-file verification **does not** prove the database, Auth accounts or Storage files can be restored.

This launcher is deliberately **interactive**, not unattended: storing a database password or a backup passphrase inside a public GitHub workflow, the website or a Windows scheduled-task argument would be unsafe. Fully unattended scheduling needs a separately managed secret store, a protected runner and a tested isolated recovery process, none of which has been enabled.

### Storage object handling

The backup tool checks the private client-files bucket. When objects exist, it attempts a temporary local copy via the Supabase CLI before adding them to the encrypted archive. Those temporary files are **plaintext** until encryption completes: use a trusted machine with full-disk encryption.

If Storage is not accessible or a nonempty listing produces no downloaded files, the script fails rather than reporting a successful complete backup. The operator can deliberately run with --skip-storage for a database-only archive, but that is not a full backup.

### Important limitations

This is an **application-data archive**, not a fully verified Supabase disaster-recovery image. Supabase CLI excludes managed Auth and Storage database schemas from its default dump. The archive alone may not recreate Auth accounts, secrets, Storage metadata and all managed services. **The live project had three Auth accounts on 15 November 2026; these identities, password/passkey/MFA credentials and login sessions are NOT exported by this tool.** Their identifiers may be referenced by client records and foreign keys. Separate identity-recovery and migration/restore checks are necessary.

The verification command now refuses missing database components, mismatched Storage counts, duplicate/unsafe archive entries and excessive uncompressed ZIP contents. If Storage was skipped deliberately, integrity checking can still pass but the result is explicitly marked as **partial**. See the [isolated recovery checklist](isolated-restore-drill.md) for the test procedure and outstanding dependencies.

Never restore to the production RD-Clients project for testing. To decrypt SQL and files for an **isolated** restoration test, choose a new, empty, restricted folder:

        python tools/backup_dzoft.py extract "C:\path\to\backup.dzoftbak" --destination "C:\path\to\empty-test-folder"

These extracted SQL and object files are sensitive plaintext. Clean up securely after testing. Validate the schema, data, authentication, row-level security and documents on a separate staging project before claiming a fully recoverable backup.

The release does **not** automatically schedule backups, store backup passwords, or enable a paid Supabase plan. GitHub Actions runs tests using fake data only; it never connects to production or uploads real client backups.

### Recurring protection schedule

- Daily, while DZOFT is used for client payments or documents: create and copy a new encrypted snapshot.
- Monthly: verify you can decrypt and restore an archive on an isolated test project.
- Keep multiple dated archives and the passphrase in independent, secure locations.

## Managed backup alternative

Supabase Pro, Team, and Enterprise plans include daily managed database backups with different retention. This project is currently Free. No subscription upgrade has been made.

[RD-Clients backup settings](https://supabase.com/dashboard/project/rzghbvmszbjlqkdjzpxc/database/backups) · [Supabase official backup guide](https://supabase.com/docs/guides/platform/backups) · [CLI install guide](https://supabase.com/docs/guides/local-development/cli/getting-started)

## Checklist: when can the warning be removed?

- [ ] A real encrypted archive exists off-site and off Supabase.
- [ ] Owner can decrypt it and verify its integrity.
- [ ] All Storage objects are included or separately backed up.
- [ ] Auth and private schema recovery have been validated.
- [ ] Full isolated restoration of application data and files succeeded.

Until then, the DZOFT Admin Settings message **Sauvegarde récupérable : non vérifiée** must remain visible. Schema/code in GitHub and matching row counts are **not** backups.
