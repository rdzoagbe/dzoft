# DZOFT — Owner session and passkey security acceptance (20 November 2026)

**Repository:** `rdzoagbe/dzoft` · **Project:** RD-Clients · **Issue:** #57

## Production evidence (read-only)

- **3** active Auth users, **1** owner designated in server-controlled
  `app_metadata.dzoft_owner`, **1** verified MFA factor attached to the owner
  and **0** owner accounts lacking a verified factor. No passwords,
  account emails, passkeys or Auth tokens were fetched.
- Active `public.is_owner()` is a SECURITY DEFINER function with
  `EXECUTE` denied to `anon` and allowed to `authenticated`; its code checks
  for AAL2 and a second-factor AMR timestamp within **seven days** when a
  verified factor exists. The seven-day interval is an explicit existing
  owner preference, **not** a new change in this PR.
- Supabase Security Advisor continues to report functions callable via the
  `anon` role and a set of tables with RLS and no policies. Some functions
  deliberately support token-gated customer invitation workflows; treating
  the entire list as automatically exploitable would be inaccurate. Verify
  each function's token validation and quota before applying any grants.
- Active `is_owner()` still has a no-verified-MFA-factor fallback. It is not
  currently triggered for the owner, but it means there is **no universal
  mandatory-MFA guarantee** after someone removes the last enrolled factor.
  A server policy change would require a vetted recovery path and separate
  approved migration. **This PR does not alter server authorization.**
- Passkeys remain a **first factor**. Browser-provided
  `userVerification:'required'` is not proof that the hosted server
  requires UV. Keep the passkey-only rollout gate #57 **open**.
- The Admin is hosted under `rdzoagbe.github.io`; this is a shared site
  origin across repositories. It is not a dedicated security origin.

## Concrete source-code finding fixed

1. Previously, `admin/index.html` checked MFA freshness when the user
   returned to the tab, but **skipped the check entirely for AAL1**.
   A downgraded session could leave already-rendered private data visible.
2. For an expired AAL2 session, the Admin called the Auth API **before
   hiding the app**. During a network outage or slow Auth response, previously
   rendered client and payment information could remain visible even though
   the server no longer authorized privileged requests.
3. An Auth-user read failure from the owner `start()` check did not itself
   hide the previously rendered Admin app.
4. The separate `admin/suivi.html` and `admin/devis.html` pages also
   returned early for AAL1, instead of redirecting into the owner MFA
   verification flow.

### UI defense-in-depth implemented

- Every owner revalidation hides the private Admin UI and open modals
  **synchronously**, invalidates outstanding data-read generations and
  clears the locally displayed owner marker **before** awaiting Auth.
- An expired seven-day MFA window or AAL1 downgrade now triggers this
  lock on focus/visibility/periodic checks.
- An unsuccessful verification leaves the private app hidden and displays
  a retryable login notice; it never treats a network error as approval.
- Both the single-quote editor and project workspace immediately conceal
  existing content, then route back to the owner verification gate on AAL1,
  old MFA or expired MFA. If the account has **no enrolled factor**, the owner
  landing page deliberately routes a pending return target to **Settings →
  MFA setup**, avoiding an endless redirect; this preserves the existing
  recovery pathway without granting AAL1 on the auxiliary pages.
- The owner can continue using the normal passkey-first sign-in and TOTP
  verification; nothing changes the seven-day window or signs the owner out
  automatically merely because they returned to a tab.
- No production Auth accounts, permissions, email settings, invoices,
  payments, SQL functions, RLS or private data were changed.

## Automated tests

`tests/owner-expired-session-lock.test.cjs` synthetically validates:

- fresh AAL2 remains visible;
- expired MFA and AAL1 instantly hide the dashboard and open modals,
  clear the displayed owner and invalidate pending load generations;
- a never-responding Auth endpoint cannot leave the app visible;
- failed Auth lookup cannot restore old customer/payment content;
- non-owner denial stays hidden;
- verified MFA factors must produce a new TOTP challenge;
- project and quote pages redirect on AAL1 or expired AAL2 and preserve
  normal navigation when MFA is still valid.

The normal UI, navigation Chromium and desktop/mobile Playwright CI must
also pass before a merge. These are **synthetic** checks, not impersonation
of or sign-in to a real owner/client account.

## Remaining acceptance gates

Before calling the production security implementation fully accepted:

1. Log in using an actual owner device with a registered passkey and
   **real TOTP**, verifying the private app stays hidden until AAL2.
2. On a controlled separate browser tab/session, check the owner dashboard
   and project/quote editor when MFA becomes stale, when the token is
   downgraded and when Auth is temporarily unreachable. Observe the
   private DOM is never re-exposed on failure.
3. Verify a client and unrelated signed-in identity cannot call owner-only
   financial RPCs, across signed-in Client and private-link flows. Do not
   use a real customer's account for the penetration test.
4. Audit the no-factor owner fallback and confirm a safe recovery mechanism
   **before** proposing a migration to remove it.
5. Assess a dedicated owner origin without breaking the free GitHub Pages
   deployment, and plan a new passkey RP ID/registration before changing
   domains.

**Issue #57 is not closed.** Passkey-only owner access has not been made
safe or enabled by these changes.

Supabase source documentation:
https://supabase.com/docs/guides/auth/passkeys
https://supabase.com/docs/guides/auth/auth-mfa
https://supabase.com/docs/guides/auth/jwt-fields
