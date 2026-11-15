# DZOFT — Security, code and resilience review (15 November 2026)

Scope: GitHub Pages public site, installed Admin PWA, authenticated client portal, Supabase RD-Clients project `rzghbvmszbjlqkdjzpxc`, app REST/RPC policies, Edge Functions, emails, invoice PDF handling, Storage, backup tooling and GitHub Actions.

This is a **source-based and configuration-based review**, not an external penetration test. The GitHub-hosted site was reviewed through source code and its automated public/mobile Chromium tests; no authenticated client account or real biometric session was used. No production payment, invoice, client record or email was deliberately created or modified.

## Confirmed findings addressed

| Severity | Finding | Remediation |
| --- | --- | --- |
| High (recoverability) | The encrypted backup helper used `supabase db dump --remote=<project-ref>` and `storage ... --remote=<project-ref>`, unsupported by the current CLI. The fake CLI test previously accepted arbitrary flags, concealing the problem. | Explicitly link to the exact project using `supabase link --project-ref ...`, then run documented `--linked` commands; export `public,private` application schemas; use repository-root working directory; make fake CLI reject invalid commands and abort on linkage failure. |
| Medium (supply chain) | Three deployed mail Edge Functions relied on floating `npm:@supabase/supabase-js@2`. | Pin to `2.57.4`, the same version already used by the working payment-reminder function; keep deployed files and GitHub copies consistent. |
| Medium (availability) | Legacy notification and signature-code endpoints parsed unbounded request JSON and used unbounded Brevo requests. | Reject oversized/malformed JSON; add 12-second provider timeout; preserve owner/MFA or client/quote checks and signature-code rate-limit/reservation cancellation. |
| Low–Medium (privacy) | Legacy provider error details were copied to app/API logs, potentially including email addresses or service response text; the signature email inserted a raw quote number into HTML. | Return generic error messages; retain provider HTTP status without storing response bodies; HTML-escape invoice/quote number in signature email. |
| Low (local secrets) | The public GitHub ignore rules did not cover temporary Supabase CLI project-link metadata. | Ignore `supabase/.temp/`, `supabase/.profiles/` and `supabase/.branches/`. |

## Live access checks (read-only)

- Project state: `ACTIVE_HEALTHY`, PostgreSQL 17, Paris region `eu-west-3`.
- Anonymous-role read audit: **0 visible rows** for clients, quotes, messages, settings and sign codes.
- Authenticated role **without owner identity**: **0 visible rows** for clients, quotes, settings and email outbox.
- Private receipt/invoice tables have RLS or are not granted direct client/anonymous access.
- The client-files Storage bucket is private; its upload/read policies are restricted by user folder or existing owner authorization.
- Admin PWA service worker is network-only for page navigation; it does not cache Supabase REST data, JWTs or client files.
- Invoice number issuance, payment posting, PDF archiving and automated progress publication use reviewed database functions with owner authorization. These were not modified during this audit.

## Supabase advisor findings and interpretation

The Security Advisor flags RLS-enabled tables with no policy (intentional direct access denial for receipt/payment/sign-code and internal tables). It also flags `SECURITY DEFINER` RPCs callable by anonymous or signed-in users. **This is an attack surface to keep under review, not proof of unauthorized access.** The anonymous portal functions use an unguessable portal token and quote/client checks; the authenticated owner functions use `is_owner()` and MFA freshness. Tighten or revoke any new function that does not need public execution.

Official findings:
- [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Anonymous callable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated callable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

Performance Advisor lists missing foreign-key indexes, including private invoice registry, change-request client IDs, email outbox client IDs, messages, project events and audit records. These are **performance INFO notices**, not proof of data exposure. Index selection should be tied to actual query plans and production volume, rather than creating or dropping all indexes speculatively.

## Important remaining risks — not marked fixed

1. **Backup/recovery remains unverified:** a corrected CLI script is not a backup. No real encrypted off-site archive or isolated restoration, including Auth and Storage, has been demonstrated. Supabase Free does not include managed automatic backups. Retain the Settings warning until a real independent backup and restore drill succeed.
2. **Static-site and client token model:** GitHub Pages frontend is public by design. Keep service-role credentials and Brevo secrets exclusively in Supabase; maintain strict RPC privileges and RLS. Existing email portal links are bearer secrets until the account is registered, so exposure via forwarded links is a risk inherent in that workflow.
3. **Spam/rate limits:** the anonymous public lead submission and token-bearing portal endpoints remain exposed to Internet traffic; rate limiting and anti-abuse monitoring beyond the existing signature-code quota need operational evaluation.
4. **Security headers / CSP:** a fully enforced Content Security Policy is not installed. The site uses inline scripts extensively and would require staged CSP report-only rollout and browser verification to avoid breaking clients. GitHub Pages does not provide arbitrary response-header configuration.
5. **French invoicing compliance:** generated PDFs require legal/tax review and are not automatically structured French electronic invoices.
6. **Manual recovery and disaster tests:** no destructive restore to production was attempted; no authenticated malicious-user or actual mobile biometric penetration test was performed.

## Test and release gates

- `tests/security-audit-20261115.test.cjs`: Edge-function dependency pinning, authorization and request guards, backup flags, private cache policy.
- `tests/test_backup_dzoft.py`: synthetic backup encryption, integrity and fake Supabase CLI tests that now reject invalid flags and fail closed on an incorrect project link.
- Existing UI regression, desktop/mobile Chromium smoke/layout tests and GitHub Pages build.
- Edge Functions must be deployed to Supabase independently of GitHub Pages; compare live source to GitHub before deployment, retain existing JWT-check configuration, and verify live active versions after deployment.

The review does not assert that the site is free of vulnerabilities. It records verified safeguards and the priority work necessary to reduce remaining risks.
