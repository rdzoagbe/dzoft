# DZOFT — Secure backup and recovery

## Verified infrastructure (13 November 2026)

| Area | Finding |
| --- | --- |
| Supabase | RD-Clients, project rzghbvmszbjlqkdjzpxc, active |
| Plan | **Free** — no automatic daily managed database backups |
| Documents | Private Storage bucket client-files; 0 objects at last inspection |
| Independent off-site backup | **Not yet created or restore-tested** |
| Managed Auth identities | **3 accounts observed 15 November 2026 — excluded from the application export** |
| Recovery drill checklist | [Isolated restore drill](isolated-restore-drill.md); no real restore completed |
| Windows verified-copy launcher | CLI selector corrected and synthetic tests added; no real off-site backup or restore test yet |
| Public GitHub | rdzoagbe/dzoft — NEVER commit archives, passphrases or credentials |

Supabase recommends off-site database exports for Free projects. Database backups do not include the actual Storage objects, only metadata.


## Windows 11: Docker-free encrypted backup with PostgreSQL 18

This workflow uses **native pg_dump**, not Docker or the Supabase CLI. It preserves the current GitHub Pages + Supabase Free setup. It creates **one consistent custom-format PostgreSQL snapshot of public and private application schemas**, encrypted immediately in memory into a .dzoftbak file. It intentionally does **not** export managed Auth data, Supabase service roles, project settings or Edge Function secrets. It does not restore, change, or upload any client data.

**Prerequisites:** PostgreSQL 18 Command Line Tools (pg_dump, pg_restore, psql), Python with the existing cryptography dependency, a trusted PC with device encryption, and a secure external or independently synced folder. Check \`"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" --version\`. The client PostgreSQL version can be newer than Supabase's database version.

### Configure your correct database connection

1. Open [DZOFT Supabase → Connect](https://supabase.com/dashboard/project/rzghbvmszbjlqkdjzpxc?showConnect=true) and choose **Session pooler** (port 5432) if your Windows internet connection uses IPv4. Copy **host** and **user** separately from the Connect details. The user must have the form \`postgres.rzghbvmszbjlqkdjzpxc\`. The port 6543 **transaction pooler must not be used**. If direct IPv6 works, the correct host is \`db.rzghbvmszbjlqkdjzpxc.supabase.co\` and user is \`postgres\`.
2. Retrieve your **database password** privately from Supabase's secure settings. Never send it through chat, insert it into a command, add it to source code or copy the full connection URL into terminal history.
3. Optionally download the project's SSL CA certificate from Supabase's SSL/connection settings and supply \`-PgSslRootCert "C:\path\to\supabase-ca.crt"\` for **verify-full** identity checks. Without it, SSL is required but server certificate identity is not independently verified.
4. Run \`git pull --ff-only\` inside your existing DZOFT checkout **after the reviewed PR is merged to main**. Before merge, use a separate checkout on the feature branch to run an isolated synthetic test; do not replace the production script manually.

From PowerShell in \`C:\Users\<WindowsUser>\DZOFT-Backup-Runner\`, using the exact host and user from your Supabase dashboard, and with an independently protected destination connected:

\`\`\`powershell
.\tools\backup-dzoft-windows.ps1 -NativePostgres \`
  -PgHost "HOST_FROM_SUPABASE_CONNECT" \`
  -PgUser "postgres.rzghbvmszbjlqkdjzpxc" \`
  -PgPort 5432 \`
  -PgBin "C:\Program Files\PostgreSQL\18\bin" \`
  -OffsitePath "E:\Private-DZOFT-Backups"
\`\`\`

The script securely prompts for the **database password** and a separate, strong **encryption passphrase**; it does not store either. Its PostgreSQL child processes receive the database password in process environment (not command line). It uses \`pg_dump --format=custom --schema=public --schema=private\`, passes the dump in memory to the encrypted backup helper, then verifies that the resulting archive is decryptable. It copies the encrypted archive to the chosen destination, SHA-256 compares it, and independently decrypt-verifies that copy with your passphrase again. Do not use a destination under GitHub.

If \`storage.objects\` reports **zero** objects in the private \`client-files\` bucket before and after the dump, the manifest records \`verified_empty_by_sql\`. If it reports objects or cannot be checked, the script **fails closed**. To intentionally create a **partial database-only archive** while separate object backup arrangements are made, add \`-SkipStorage\`; never treat such an archive as complete. Other buckets, managed Storage metadata, Auth credentials, email provider settings, managed roles and secrets are not backed up by this helper.

**Native restore format:** The encrypted archive contains \`database/application.dump\` rather than the CLI workflow's separate \`database/schema.sql\`, \`database/data.sql\`, and \`database/roles.sql\`. Extract only in an isolated encrypted folder. The \`.dump\` file is PostgreSQL custom format intended for \`pg_restore\` after manually preparing a disposable target. It is not an immediately-restorable full Supabase image. Do not restore it to the production database. Refer to the isolated recovery drill guide and explicitly check owner grants, policies, Auth references and extensions.


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
