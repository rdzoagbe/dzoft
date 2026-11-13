# DZOFT — Secure backup and recovery

## Verified infrastructure (13 November 2026)

| Area | Finding |
| --- | --- |
| Supabase | RD-Clients, project rzghbvmszbjlqkdjzpxc, active |
| Plan | **Free** — no automatic daily managed database backups |
| Documents | Private Storage bucket client-files; 0 objects at last inspection |
| Independent off-site backup | **Not yet created or restore-tested** |
| Public GitHub | rdzoagbe/dzoft — NEVER commit archives, passphrases or credentials |

Supabase recommends off-site database exports for Free projects. Database backups do not include the actual Storage objects, only metadata.

## Windows 11: create a local encrypted application-data backup

This repository includes [tools/backup_dzoft.py](../tools/backup_dzoft.py). It was tested with synthetic data only. It is an export helper, not a managed backup service.

1. On your trusted Windows computer with BitLocker/Device Encryption enabled, install a current **Supabase CLI** and Python 3.12+. Follow the official Supabase CLI installation guide.
2. Download or clone this GitHub repository. Open Windows Terminal (PowerShell) in the repository folder.
3. Install encryption dependency:

        python -m pip install cryptography==46.0.4

4. Authenticate locally and check commands:

        supabase --version
        supabase db dump --help
        supabase login
        python tools/backup_dzoft.py self-test

   Check that the CLI accepts the explicit remote project selector. Supabase may request your database password **on your own machine**. Never send passwords to ChatGPT or paste them into GitHub.

5. Run backup:

        python tools/backup_dzoft.py backup

   Enter a unique encryption passphrase of at least 16 characters twice. The script saves one encrypted .dzoftbak file under your home DZOFT-Backups directory. **Store the passphrase in your password manager**; losing it makes the file unreadable.

6. Verify the file using the exact filename printed by the backup tool:

        python tools/backup_dzoft.py verify "C:\path\to\your\backup.dzoftbak"

   The script verifies encryption authentication, archive CRC checks and SHA-256 hashes. It automatically verifies right after writing the file.

7. **Copy the encrypted .dzoftbak off the computer** to another restricted location (encrypted external drive or separately secured cloud storage), keeping several generations. Do not commit it to this public GitHub repository or attach it to an email.

### Storage object handling

The backup tool checks the private client-files bucket. When objects exist, it attempts a temporary local copy via the Supabase CLI before adding them to the encrypted archive. Those temporary files are **plaintext** until encryption completes: use a trusted machine with full-disk encryption.

If Storage is not accessible or a nonempty listing produces no downloaded files, the script fails rather than reporting a successful complete backup. The operator can deliberately run with --skip-storage for a database-only archive, but that is not a full backup.

### Important limitations

This is an **application-data archive**, not a fully verified Supabase disaster-recovery image. Supabase CLI excludes managed Auth and Storage database schemas from its default dump. The archive alone may not recreate Auth accounts, secrets, Storage metadata and all managed services. Separate migration/restore checks are necessary.

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
