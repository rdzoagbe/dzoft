# DZOFT owner device sign-in — secure rollout

## User journey

The admin sign-in page now presents **Unlock with this device** (Windows Hello, Windows PIN, fingerprint, face unlock or a security key) on browsers supporting WebAuthn. The existing email/password form is retained under **Use email and password** as a fallback. After you have registered a passkey on the current device, the form is collapsed by default; this preference is only a UI choice, not authentication.

Settings → **Sign in with Windows Hello or fingerprint** lets the owner register or revoke passwordless passkeys on each device. Device registration is allowed only after a recent Supabase **AAL2** (TOTP) verification, and the server cryptographically verifies WebAuthn challenges.

No device PIN, fingerprint template, biometric image, GitHub token, Supabase service key, or passkey private key is ever sent to DZOFT. Only a WebAuthn signed assertion is sent to Supabase Auth.

**Owner passkey policy (proposed 15 November 2026):** A successful Supabase Passkey sign-in is still an `aal1` first-factor authentication. For DZOFT's **owner only**, a fresh, server-verified passkey login can be accepted instead of password + TOTP for access to Admin. This is an explicit authentication-policy change, **not a claim that Supabase promoted the session to `aal2`**. The existing TOTP second factor is still mandatory for password sign-ins when one is enrolled, and for sensitive Auth operations such as passkey registration/removal. The change requires the protected `public.is_owner()` SQL gate, which checks the signed JWT, Supabase's `auth.sessions` row, and the server-created `auth.mfa_amr_claims` `passkey` record for the **same user and session**, all within 12 hours. A frontend flag or stored passkey is never sufficient. The six-digit code stays available for recovery.

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

## Android / Google Password Manager — existing laptop passkey

When Chrome on a laptop stores a DZOFT passkey in **Google Password Manager**, Google can synchronize that same passkey to a Samsung/Android phone using the same signed-in Google account. A new passkey does **not** have to be created on each device. The phone may offer the already-registered credential when the user chooses **Unlock with this device** on the DZOFT sign-in page.

The passkey list shows credentials **registered against the DZOFT account**, not physical devices. A row labelled **Google Password Manager** does not prove it lives only on the laptop.

**Owner diagnostic — 14 November 2026:** DZOFT Supabase Auth recorded three successful `POST /passkeys/registration/options` responses (HTTP 200) at 21:21–21:22 UTC, with no matching registration-verification attempt in that window. The failure occurred before a completed credential reached Supabase: possible explanations include a duplicate/synced credential, browser rejection, or an aborted platform prompt. These logs **do not** establish exactly which local Android error was thrown.

The DZOFT Settings UI now:
- Explains that passkeys can sync through Google Password Manager and recommends testing existing sign-in before creating a second credential.
- Labels the optional action **Add another passkey** when one is already registered.
- Differentiates `InvalidStateError` / `webauthn_credential_exists`, `NotAllowedError`, `NotSupportedError`, `SecurityError`, Supabase challenge expiry and expired MFA verification.
- Reuses one status panel on repeated failures instead of stacking identical red alerts.
- Never removes or overwrites a registered credential, bypasses AAL2/TOTP or exposes raw passkey challenge data in error messages.

To test without deleting anything (after the backend migration is deployed): **Sign out on the phone → Unlock with this device → choose the existing Google Password Manager credential → authenticate with fingerprint/PIN → Admin opens without a six-digit code.** If the installed PWA does not offer the credential, open `https://rdzoagbe.github.io/dzoft/admin/` in the latest Android Chrome browser and try the same flow. Keep email/password and authenticator available as recovery.

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
- Password sign-ins retain TOTP verification; password recovery, sign-out and the 12-hour freshness window remain. Passkey sessions have a separate, server-verified owner-only path.
- One database migration changes only the owner-access function, not customer data, MFA enrollment, Auth service settings, service secrets, emails or payments.
- A failed/cancelled device prompt never creates a session.
- Passkey registration requires a fresh server-issued `aal2` claim. Any login token remains exactly what Supabase Auth issued.

## Test coverage

- `tests/device-passkeys.test.cjs`: challenge + WebAuthn assertion + server token, disabled-backend failure, requirement for `aal2` registration, discoverable credential, passkey listing, and no MFA bypass.
- `e2e/public-and-auth.spec.mjs`: real Chromium desktop/mobile login, recovery, passkey-disabled fallback.
- Existing UI regression suite and owner synthetic browser checks remain required.

A real device/browser biometric ceremony cannot be safely simulated with a customer's live account in automated CI. It must be verified interactively on each device after the hosted Auth setting is enabled.

Sources: https://supabase.com/docs/guides/auth/passkeys and https://supabase.com/docs/guides/auth/auth-mfa

## Server-side user verification caveat

In Supabase Auth's implementation at the time of this review, the shared WebAuthn configuration uses `UserVerification: VerificationPreferred`. DZOFT's browser explicitly requests `userVerification: 'required'`, but this **does not independently guarantee that Supabase's server will reject every credential assertion lacking a local biometric/PIN user-verification flag** if a modified client makes the request. The server verifies that the passkey signature is valid; the Auth AMR record does **not** itself certify that the UV flag was required.

Consequently, the proposed passwordless owner policy is **not AAL2**, is **not equivalent to password + independent TOTP**, and has a documented security tradeoff even when it is implemented correctly. Keep the migration un-applied until the owner accepts this assurance model or Supabase exposes a reliably enforced server-side UV / WebAuthn MFA policy. The existing production password + TOTP rule remains the safe fallback.

## Passkey-only Admin rollout and safety checks (15 November 2026)

This change is **not live** until the SQL migration is applied to RD-Clients and the reviewed GitHub branch is merged/deployed. It should be staged deliberately because it changes the accepted assurance policy from mandatory AAL2 to either AAL2 **or** a verified owner passkey. A passkey is phishing-resistant but this is **not equivalent** to a separate MFA factor.

- First, run all UI, browser and security tests. The SQL permission check must remain owner-only and cannot accept a password-only `aal1` token.
- Then apply the proposed `20261115123000_allow_recent_owner_passkey_login.sql` migration using Supabase's migration workflow. Confirm the server function definition and execute grants.
- Deploy the updated Admin, then manually sign out and select **Unlock with this device** with a previously registered passkey on Windows and Android Chrome. Confirm no TOTP prompt **and** real private data loads.
- Separately sign out, use **email + password**, confirm the six-digit code is required, and verify wrong/expired codes fail closed.
- Check a non-owner client account cannot access Admin, and a passkey challenge that is cancelled or fails leaves private data hidden.
- After 12 hours (or in an isolated test with shortened time), re-verify that the user must perform a new passkey sign-in or enter TOTP.
- If a passkey is rejected, leave password + TOTP active; **do not disable MFA**. Roll back the server function to `supabase/migrations/20261110090000_owner_mfa_window_12_hours.sql` and the UI to the previous release if necessary.

The deployment can use GitHub Pages and Supabase Free; no new hosting or provider is required.
