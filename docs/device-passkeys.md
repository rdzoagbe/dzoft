# DZOFT owner device sign-in — secure rollout

## User journey

The admin sign-in page now presents **Unlock with this device** (Windows Hello, Windows PIN, fingerprint, face unlock or a security key) on browsers supporting WebAuthn. The existing email/password form is retained under **Use email and password** as a fallback. After you have registered a passkey on the current device, the form is collapsed by default; this preference is only a UI choice, not authentication.

Settings → **Sign in with Windows Hello or fingerprint** lets the owner register or revoke passwordless passkeys on each device. Device registration is allowed only after a recent Supabase **AAL2** (TOTP) verification, and the server cryptographically verifies WebAuthn challenges.

No device PIN, fingerprint template, biometric image, GitHub token, Supabase service key, or passkey private key is ever sent to DZOFT. Only a WebAuthn signed assertion is sent to Supabase Auth.

**Critical distinction:** Supabase **passkey login** is currently a first-factor sign-in. It can replace entering your email and password but **does not automatically replace an enrolled TOTP second factor** or grant `aal2`. DZOFT's existing owner permission checks and 12-hour MFA freshness check remain intact. A device-based second-factor alternative depends on Supabase enabling/accepting WebAuthn MFA factors; the existing code detects already verified factors but enrollment is deliberately disabled until supported. This release does NOT claim the phone authenticator is eliminated for every login. We will not forge `aal2` JWTs, reuse TOTP secrets, or disable MFA to achieve that.

## Beta Passkeys enabled — live Auth endpoint verified

On 14 November 2026, after the owner activated the experimental feature, a direct live check of
`POST /auth/v1/passkeys/authentication/options` on DZOFT project
`rzghbvmszbjlqkdjzpxc` returned **HTTP 200** with a valid WebAuthn challenge
and relying-party ID `rdzoagbe.github.io`. The earlier repeated HTTP 404 errors
occurred before beta activation.

DZOFT can now discover passkey availability on the login page and inside the
authenticated Settings screen. It caches the capability check within the page,
so simply opening Settings does not repeatedly start new challenges. When the
hosted endpoint is unavailable again, the device button stays hidden and
Settings explains the error without bypassing sign-in.

**Next owner action:** Sign in normally and complete the six-digit authenticator
step once. In Admin Settings → **Sign in with Windows Hello or fingerprint**,
select **Add this device** and complete the Windows Hello or Android passkey
registration prompt. Then sign out and test **Unlock with this device**.
A valid server challenge does **not** mean a user passkey was already registered.

The Chrome message `beforeinstallpromptevent.preventDefault() called; banner not shown`
is an unrelated PWA installation notice. It does not affect passkey Auth.

## When the Supabase feature is disabled

The login page now checks the Auth server, not merely WebAuthn browser support.
If Supabase returns `passkey_disabled`, DZOFT hides the unusable device-sign-in
button and keeps email/password visible. Settings explains that the project
needs **Authentication → Passkeys** enabled, provides the direct dashboard link,
and offers a **Check again** button. It never pretends that an unregistered
Windows Hello PIN or fingerprint is already linked to DZOFT.

If the Auth service is temporarily unreachable, the device button also stays
hidden; this is a fail-closed display decision, not a session or authorization
change. After enabling Passkeys, use **Check again** in Settings or reload the login
screen. DZOFT validates that the hosted endpoint is responding before showing
the device button.

## Required owner-side setup in Supabase

Supabase's passkey support is **experimental** and must be enabled in the hosted project:

1. Visit https://supabase.com/dashboard/project/rzghbvmszbjlqkdjzpxc and open **Authentication → Passkeys**.
2. Enable **Passkey authentication** if offered on the project.
3. Configure **Relying Party ID**: `rdzoagbe.github.io`. Configure **Relying Party Origins**: `https://rdzoagbe.github.io`. Configure display name: `DZOFT`. (No `/dzoft/admin/` path or `https://` inside RP ID.)
4. Save the configuration. Sign into DZOFT normally and complete your existing 6-digit authenticator step.
5. Go to Settings → **Sign in with Windows Hello or fingerprint** → **Add this device** and approve the OS/browser prompt.
6. Test sign-out and device sign-in on your Windows 11 laptop. Repeat registration on your Android installed PWA if needed; device/synced passkey availability varies by password manager.
7. Keep your password and authenticator as recovery until you have tested both devices.

**Origin/domain caution:** DZOFT currently uses `rdzoagbe.github.io`, a shared GitHub Pages origin. Passkeys are bound to that domain, and moving the admin to a separate domain later requires new registrations. Because other repos under the same GitHub Pages origin can affect local browser security, a **dedicated admin domain** is preferable before treating the login deployment as fully hardened. Avoid adding untrusted scripts to any project sharing that origin.

If the Supabase project does not expose the Passkeys toggle or returns `passkey_disabled`, the new device feature will show an honest setup/unavailable state while password+TOTP continues to work. Merely merging the code does not enable server-side passkeys.

## What remains unchanged

- Owner role and server-side MFA checks protect clients, quotes, receipts, and project journals.
- Existing TOTP verification, password recovery, sign-out, and 12-hour MFA freshness checks remain.
- No database migrations, service secrets, client email notifications, finance changes, or stored secrets are added.
- A failed/cancelled device prompt never creates a session.
- Passkey registration requires a fresh server-issued `aal2` claim. Any login token remains exactly what Supabase Auth issued.

## Test coverage

- `tests/device-passkeys.test.cjs`: challenge + WebAuthn assertion + server token, disabled-backend failure, requirement for `aal2` registration, discoverable credential, passkey listing, and no MFA bypass.
- `e2e/public-and-auth.spec.mjs`: real Chromium desktop/mobile login, recovery, passkey-disabled fallback.
- Existing UI regression suite and owner synthetic browser checks remain required.

A real device/browser biometric ceremony cannot be safely simulated with a customer's live account in automated CI. It must be verified interactively on each device after the hosted Auth setting is enabled.

Sources: https://supabase.com/docs/guides/auth/passkeys and https://supabase.com/docs/guides/auth/auth-mfa
