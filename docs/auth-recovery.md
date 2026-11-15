# DZOFT — Supabase Auth recovery and account re-association

**Status (15 November 2026): Recovery procedure prepared; no live Auth export, migration, re-enrollment or isolated restore has been performed.**

This is the missing identity layer after the verified encrypted application-data backup. A PostgreSQL `public` + `private` dump is **not** a backup of Supabase-managed Auth users, passwords, passkey private keys, MFA secrets, sessions, OAuth/SMTP configuration or project secrets.

## Read-only assessment of the live RD-Clients project

Verified through read-only database metadata (no email addresses or secret values exported to GitHub):

| Check | Observed |
| --- | ---: |
| Active Auth users | 3 users currently observed |
| Server-controlled DZOFT owner markers | 1 |
| Verified MFA factors | 1 TOTP |
| Registered discoverable passkeys | 1 |
| Auth identities | 3 |
| `public.clients.user_id` populated | 1 row; 0 broken references |
| `public.leads.user_id` populated | 0 rows; 0 broken references |
| `private.notification_settings.owner_user_id` populated | 1 row; 0 broken references |
| Active Edge Functions | 7 |
| Edge Function directories in GitHub | 6; live `brevo-diag` still requires source-recovery review |

These are **point-in-time counts**, not an inventory of a particular archive. Repeat before every recovery rehearsal.

Three application-side foreign keys reference `auth.users(id)`: `public.clients.user_id`, `public.leads.user_id`, and `private.notification_settings.owner_user_id`. Functions and RLS also use `auth.uid()`, `auth.jwt()` and the server-managed `app_metadata.dzoft_owner` flag. A different replacement Auth user ID will not automatically match these records.

## A. Capture a minimal *encrypted* Auth identity recovery ledger

The repository includes `tools/backup_dzoft_auth.py`. The script **only reads** a pre-defined set of non-credential Auth and application columns and encrypts the result in memory before writing a `.dzoftauth` file. It does **not** create users, alter factors, change access policies or touch financial records.

For each active source account the ledger contains:

- Old Supabase Auth user UUID and email (both treated as private data).
- Whether the email was confirmed and whether the **server-controlled** owner claim was present.
- Authentication provider names (not provider tokens), verified factor **type names** (not TOTP secrets), and count of registered passkeys (not credentials).
- Counts of associated rows in `clients`, `leads` and `private.notification_settings`.

It explicitly **does not export** passwords, password hashes, `auth.identities.identity_data`, personal profile metadata, WebAuthn public/private keys, TOTP seeds, refresh/access tokens, sessions, email provider keys, or full Auth-managed tables.

### Windows PowerShell — capture without Docker

Use the same PostgreSQL 18 installation and RD-Clients **database password** as the successful encrypted application export. From the existing checkout (after PR containing this file is merged):

```powershell
Set-Location "$HOME\DZOFT-Backup-Runner"
git pull --ff-only

python .\tools\backup_dzoft_auth.py capture `
  --host "aws-1-eu-west-3.pooler.supabase.com" `
  --user "postgres.rzghbvmszbjlqkdjzpxc" `
  --port 5432 `
  --pg-bin "C:\Program Files\PostgreSQL\18\bin" `
  --destination "$HOME\DZOFT-Backups"
```

Prompts: (1) **database password** and (2) a **new encryption passphrase**, entered twice. Store the passphrase in your password manager **before** proceeding. It may be different from the application-backup passphrase; record which passphrase unlocks which archive. Passwords are never supplied on the command line or sent to ChatGPT. SQL results are held in the Python subprocess and process memory; no plaintext inventory file is intentionally written. Use Windows Device Encryption/BitLocker and run only on a trusted personal computer.

The successful output names a `dzoft-auth-YYYYMMDD-HHMMSSZ-xxxxxx.dzoftauth` file in `$HOME\DZOFT-Backups`. It prints counts only, never email addresses or IDs. If the project owner identity is missing/ambiguous, the tool **fails closed**.

For stronger server identity verification, retrieve the Supabase SSL CA certificate and add `--ssl-root-cert "C:\path\to\supabase-ca.crt"`. Without it, the tool requires encrypted TLS but does not independently verify the server certificate identity.

### Cloud copy and independent verification

Copy **only the encrypted** `.dzoftauth` to a restricted private folder in Google Drive. Do not put the plaintext inventory, passphrase or connection credentials in Drive or a public GitHub repo. Download the uploaded file from Google Drive in the browser and verify it using:

```powershell
python .\tools\backup_dzoft_auth.py verify "C:\ACTUAL-DOWNLOAD-PATH\dzoft-auth-... .dzoftauth"
```

Use the actual filename without the spaces shown in the placeholder, and enter the ledger's encryption passphrase privately. The tool confirms authenticated decryption and validates project ID, record format, UUID uniqueness, owner count and allowed fields without printing identifying data. Separately compare the **original and downloaded encrypted files' SHA-256 hashes** with `Get-FileHash` to prove exact cloud-copy identity.

Run a new ledger capture whenever account registration, deletion, owner authorization, MFA status or client mapping changes. This complements—but **does not replace**—the regular `.dzoftbak` application-data export. Store both together off the SSD.

## B. Recover accounts onto a **new, isolated** Supabase project

**Do not run the following procedure against the production RD-Clients project. Do not temporarily disable RLS, expose service-role keys to frontend code, or grant owner access based solely on a matching email address.**

1. **Isolation and configuration.** Create a disposable project only when cost/access and the exact target are confirmed. Disable external messaging, scheduled payments, invoices, webhook delivery and background integrations until tested. Establish the correct redirect origins, Auth providers, email templates, SMTP credentials (from your secret store, never GitHub) and relevant project settings. Restore source code/migrations from the reviewed repository and audit all Edge Function secrets separately.
2. **Read the recovery inventory privately.** After decrypting in an encrypted restricted local environment, use the ledger to build an **old UUID → new UUID** mapping. This mapping contains private account data: never commit it, print it to CI logs, or post it into a chat. Require independent confirmation of every user's identity before granting access.
3. **Provision new Auth users using the supported Supabase Auth Admin API** (for example `inviteUserByEmail` or a documented `createUser` flow) from a secure admin-only execution environment; **never** from the public GitHub Pages app. Do not edit `auth.users` manually to recreate credentials or pretend source UUIDs survived. These APIs generally issue new IDs: capture them in the private mapping.
4. **Restore business schema/data with a tested mapping plan.** The native `database/application.dump` may contain FK references to source UUIDs and Supabase-specific dependencies. Preflight `pg_restore --list`; restore only to an isolated database with explicit validation. The application FK columns `clients.user_id`, `leads.user_id` and `private.notification_settings.owner_user_id` must be reconciled with the newly created Auth user IDs **before enabling those accounts to access records**. If import order or FKs make that impossible, stop and design an isolated staging transform; do not solve it by disabling production constraints or guessing users. Check policies, grants and security-definer functions independently.
5. **Owner authorization, only after independent verification.** Recreate the `app_metadata.dzoft_owner` flag **only for the confirmed original owner**, using a privileged Supabase Auth Admin operation. Keep the new Admin UI offline while provisioning; enroll TOTP before granting access to restored private data, then perform a fresh MFA login. The current production `is_owner()` logic has a branch for accounts with no verified MFA factor; do not treat that transitional condition as permission to expose sensitive restored data.
6. **Re-enroll authentication.** A new project cannot use this ledger to reconstruct passwords, passkey private keys or authenticator seeds. Users should set new passwords through secure invitation/recovery flows, enroll new TOTP factors and register new passkeys where supported. Old sessions must not be trusted. Never copy password hashes or TOTP/Passkey secrets into GitHub.
7. **Test isolation and exact associations.** Verify one owner and each separately verified client can log in, owns only their records, sees no other client's documents, and cannot call owner-only payment or quote APIs. Validate password+TOTP enforcement, session expiry, passkey policies as actually deployed, invoice/project access and storage downloads.
8. **Cutover only after approval.** Compare account and table inventory counts, run representative real-browser tests with test records, update the public client Supabase URL/key only at the approved cutover, and recheck email, payment and document integrations. Preserve the original encrypted backups and record a rollback strategy.

### Security and recovery gaps that remain

- The ledger is **identity-mapping metadata**, not a functioning Auth database backup. It does not restore passwords, sessions, registered passkeys, MFA secrets or verified email-provider access.
- Full restoration of the app's custom-format PostgreSQL archive has **not been tested**. A successful `pg_restore --list` or decryption is insufficient evidence of recoverability.
- The live project has **7** Edge Functions while the repository currently contains **6** function directories. `brevo-diag` is deployed but absent from the GitHub source directories; its recovery source and whether it is actually needed must be reviewed without exposing environment secrets.
- Review dashboard Auth configuration (redirect/site URLs, MFA settings, passkey RP ID, email templates, auth providers), Edge Function secrets, scheduled jobs, webhook settings, Brevo credentials and storage bucket policies in a separate **non-secret configuration checklist**. No passwords or secrets belong in this public repository.
- The complete encrypted ledger should be retained independently of the original SSD. A copied archive is not an isolated restore test.

**Current go/no-go: Disaster recovery remains NOT VERIFIED** until account re-association, authorization behavior and application data restoration are successfully exercised in an isolated environment.

## Supabase references

- [Auth user management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Admin invitation](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
- [Admin user update](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
- [TOTP MFA enrollment](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase database migration limitations](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [DZOFT isolated restore drill](isolated-restore-drill.md)
