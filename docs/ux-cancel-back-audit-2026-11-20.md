# DZOFT — Cross-site Cancel / Back / correction audit

**Date:** 20 November 2026  
**Source revision at start:** `adf0dd70d81d1be5b1c1d4f576932c8c92685b2f` on `main`  
**Tracking:** GitHub issue #59  
**Scope:** Admin, quotation editor, project tracking, payment status, client portal, supplement workflow, mobile menu. Code and synthetic tests only.

## Meaning of Cancel in DZOFT

1. **Cancel / Annuler** a form means discard _unsaved_ local values. It must not
   issue an RPC, payment, invoice, signature, delivery notification or audit entry.
2. A **pending** save or confirmation must not be made to look cancelled when the
   server is already processing it. Controls should remain visible and the owner
   or client should see the real result.
3. **Remove** a meaningful line in an auto-saving quotation is a destructive draft
   operation. Require explicit confirmation before changing it; blank placeholders
   can be removed immediately.
4. **Cancel** a pending payment status is a committed server change and is distinct
   from discarding edits to its status form.
5. A **confirmed payment** must not be deleted or reversed using a local Cancel.
   Its amount/date/reversal workflow remains issue #64, subject to separate
   financial schema and owner approval.
6. An **issued invoice** must use appropriate corrective documents/credit notes;
   draft-form Cancel must never mutate official numbers or archival PDFs.

## Source-level coverage and findings

| Surface | Existing behavior inspected | Result in this audit |
| --- | --- | --- |
| Admin login, first sign-in, reset password, MFA | Back links for auth forms, MFA setup Cancel; server verification during challenge | Existing checks retained, no Auth policy changes |
| Admin Settings | Payment-settings Cancel restores saved values; backup and security actions remain separately confirmed | Existing tests retained |
| Admin dashboard / navigation | Seven canonical routes; legacy links redirect; installed PWA has a single top menu | No new navigation rewrite needed |
| Initial quote estimator | Cancel discards candidate selection; requires explicit Apply; signed quotes protected | Prior tests retained |
| **Original quote editor** | Import Cancel existed, but deleting a nonempty priced line, heading or hosting entry silently autosaved | **Fixed:** confirm before any meaningful line/header/hosting removal; clearly state heading deletion leaves child lines |
| Project payment entry | Received-payment form and optional invoice association are already in expandable editors with Cancel; confirmation before committing funds | Existing protections retained |
| **Pending-payment status update** | The inline `form[data-status-id]` had Save, but was absent from the generic Cancel selector | **Fixed:** “Annuler les modifications / Discard changes” restores the original status/date, updates conditional fields, focuses the status control, no RPC |
| Pending-payment creation/receipt confirmation | Expandable forms had Cancel; in-flight submit disables escape | Retained |
| Payment-method correction | Audited correction form has its own Cancel; no amount/date edits | Retained |
| Invoice linking and emitted PDF | Invoice-link form Cancel present; official credit-note review is separately confirmed | Retained |
| Progress journal / work items / client visibility | Quick note Cancel, publication Cancel, private vs shared confirmation | Retained |
| Client portal | Message Cancel, review Cancel, account password Cancel, login return paths | Retained |
| **Client change requests and owner supplementary proposals** | Their Cancel button could reset/close its form while a create/price/sign request was already being committed | **Fixed:** the containing change-request panel tracks an in-flight save; Cancel refuses to hide the form until the operation resolves |
| Mobile/PWA | Touch layout and previously unified menu reviewed in source; versioned scripts updated here | Synthetic desktop/mobile browser checks required; real PWA acceptance pending |

## Regression coverage

- `tests/full-site-ux-safety-20261120.test.cjs`: executable tests
  for inline status Cancel, no-RPC form resets, in-flight supplement guard,
  and meaningful quote deletion confirmation.
- `tests/project-form-cancel.test.cjs`: expanded to assert the inline
  pending-status selector and bilingual discard action.
- `e2e/ux-cancel-safety.spec.mjs`: synthetic desktop/mobile tests for
  quote-line dismissal and a client request attempted Cancel during an
  unresolved server mutation. No real customer account or Supabase call.
- Existing `tests/cancel-back-buttons.test.cjs`,
  `tests/client-portal-cancel-actions.test.cjs`,
  `tests/quote-save-retry.test.cjs`, and UI/Chromium suites remain active.
- Browser cache version references and Admin release metadata are updated.

## Acceptance still required — leave issue #59 open until checked

The following cannot be certified by source review or fake sessions:

- Test an authenticated **owner** on a draft test quote, project
  payment-status form and payment confirmation (do not create real receipts).
- Test an authenticated **client** request and unfinished proposal signature;
  no real messages should be sent in this check.
- Test French and English, keyboard focus and screen reader announcements,
  and physical installed phone PWA at 390 px: dismissing a form must not
  accidentally navigate to an obsolete Admin page or drop hidden edits.
- Exercise errors/timeouts with read-only or disposable fixtures and prove the
  cancel action is disabled during in-flight operations; callbacks must
  surface success/failure truthfully.
- Check preview/confirmation for issued invoices and formal credit notes.
- Audit unusual screens and future forms as they are introduced; static
  instrumentation cannot prove all event-driven forms behave correctly.

**No database migrations, official invoice modifications, receipt reversals,
outbound emails or passkey security changes are part of this PR.**
