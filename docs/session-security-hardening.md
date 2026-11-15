# DZOFT — Admin and client session hardening

This work is deliberately compatible with GitHub Pages and the existing Supabase project. It **does not** move the admin to another origin, change email/password/passkey login, or bypass MFA.

## Identity and authorization

- Supabase Auth validates email/password or passkey. The frontend does **not** infer ownership from the email string.
- The client portal calls `sb.routeOwner()`, which reads the **server-verified** user from `/auth/v1/user` and checks `app_metadata.dzoft_owner`. Only then does it route to DZOFT Admin. The token is **not** put into the URL.
- Admin itself verifies `is_owner` on the server before rendering customer/payment information. The server function requires appropriately fresh MFA when a verified second factor is enrolled.
- Database policies for clients, quotes, leads, messages, settings, notification history, and email outbox retain RLS. Never assume that hiding a button in the UI is authorization.

## Session refresh and logout

- All private browser API actions now reject when no authenticated session exists. They cannot silently reuse the public anon token.
- Within a tab, all concurrent requests with the same expiring token share one refresh promise.
- On browsers supporting the Web Locks API, the refresh is also serialized across DZOFT tabs using a store-specific exclusive lock. A second tab reuses an already-refreshed token from shared storage.
- A rotated response cannot restore old credentials after a logout, account switch, or newer refresh. Changes to session generation and token IDs are checked before updating browser storage.
- Explicitly invalid refresh tokens clear the matching session. Transient network failures and HTTP 5xx preserve it so the user can retry, but the private request still fails closed.
- If one tab signs out or switches accounts, open Admin and signed-in client tabs hide the previous account's data and reload. Existing guest-link portal access remains independent.

## Limitations

**This is session hardening, not true browser-origin isolation.** GitHub Pages projects under `rdzoagbe.github.io` still share an origin and can access the same localStorage space. An unrelated script hosted on this shared hostname could potentially read tokens. A dedicated hostname is required to address that risk.

Supabase access tokens can remain valid until expiry even after a normal sign-out; server revocation and authorization policy remain critical. The frontend is not a replacement for server authorization.

## Verification

Regression tests in `tests/session-refresh-isolation.test.cjs` cover parallel refresh, cross-tab Web Locks serialization, logout mid-refresh, retry on transient errors, rejection of missing/invalid sessions, and unchanged account routing. Supabase RLS policies are separately inspected via read-only queries. Browser regression checks must pass before deployment.

No real user sessions, MFA factors, passwords, client records or invoices are altered by this change.
