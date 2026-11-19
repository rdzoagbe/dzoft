# DZOFT — Technical acceptance audit (19 November 2026)

## Scope and evidence

Read-only source review of `rdzoagbe/dzoft` `main` at commit
`de256ad455e46684e5139261a44f345fbccf54e2`, plus the 19 November GitHub Actions results.
Areas inspected: Admin global/project/editor navigation, installed Admin PWA menu,
FR/EN updater, quotation editor and supplementary calculator, manual supplementary
proposal review, invoicing/payment test contracts, existing security and recovery
documentation. No live Supabase or production customer sessions were used.

At the audited commit, UI regression, browser smoke and GitHub Pages deployment
workflows all reported success. That is **not** a signed-in owner/client acceptance
test, a passkey ceremony, or evidence of financial/recovery correctness.

## Confirmed code defects addressed by the companion pull request

1. **Dynamically created update controls did not fully follow the Settings language.**
   `admin/update-notice.js` translated the build label on
   `dzoft:locale-change`, but not the **Check for updates** button or its previous
   outcome message. This is not covered by the shared static translation map.
   Repair: translate all three and preserve the outcome meaning across FR/EN
   changes, with a no-network-write VM regression test.
2. **Installed-PWA menu had a stale temporary route list.**
   `admin/installed-app-menu.js` built entries including old `vue-globale`,
   `dossiers`, `demandes`, and `corbeille`, before
   `admin/workspace-nav-v6.js` replaced them with the seven canonical Admin
   destinations. This exposed an obsolete fallback if the later script failed
   or had not run. Repair: align the initial menu with the canonical seven;
   retain **View website** and **Log out**.
3. **Client browser cache freshness.** Both changed JavaScript assets have
   versioned references in the relevant Admin HTML pages, so an installed PWA
   does not silently keep the previous presentation scripts.

These are presentation-only changes. No auth policy, Supabase SQL migration,
payment/invoice mutation, email send, client approval or legal text is changed.

## Implemented work verified from source history, not yet manually accepted

- Seven Admin destinations and one project page with five tabs:
  `admin/workspace-nav-v6.js`, `admin/editor-navigation.js`,
  `admin/project-workspace-tabs.js` (PRs #111–#112).
- Supplementary pricing, catalogue and discounts:
  `assets/change-requests.js` with completed UI/SQL test suites.
- Owner-reviewed manual supplementary proposal delivery:
  `assets/change-requests.js`, PRs #135, #137 and #138.
  Opening Outlook/WhatsApp drafts must not enqueue transactional mail.
- Credit-note workflow and invoice-receipt reconciliation:
  `supabase/migrations/20261118120000_credit_notes.sql` and follow-up,
  related tests, PRs #120–#122.
- FR/EN language persistence and initial client portal work:
  `assets/dzoft-language.js`, PRs #99–#103.

**Important product gap:** `admin/devis.html` supports manual line-item
quotations and presets; `assets/change-requests.js` implements a separate
post-signature supplementary calculator. The originally requested **new-quote
included-in-base vs additional-work package classifier** was not established
as a working, integrated path in the original quotation editor. Treat as a
scoped product feature, not as fixed by the supplementary calculator.

## Open issues and non-negotiable gates

| GitHub issue | State | Remaining work |
| --- | --- | --- |
| #57 | Open | Server-enforced user verification before any passkey-only owner policy. PR #42 closed without merge. Seven-day password+TOTP window remains in place. |
| #64 | Open | Owner-approved, append-only corrections of confirmed payment amount/date/duplicate receipt; no direct edits to existing financial records. |
| #72 | Open | End-to-end restore in an isolated target including Auth mapping, business rows, policies, invoice registry and Storage bytes; browser-only backups are not full disaster recovery. |
| #59 | Open | End-to-end Cancel/Back/correction acceptance for owner, editor and client surfaces, on desktop and installed mobile. |

## Remaining release acceptance (not claimed done)

1. Authenticated owner: verify every canonical route and each project tab with
   a live authorized account; inspect failed queries, stale CSS/scripts and safe
   return after MFA.
2. Client account and secret-link flows: verify least-privilege project isolation,
   genuine invoice/payment figures, signed documents and private progress visibility.
3. Manual communication: inspect French explanation, editable recipients and
   drafts; prove preparing a message does not send one; verify actual customer
   delivery only with owner approval.
4. Mobile PWA: verify a single top menu, seven routes, no obsolete bottom menu,
   update-check text after language switch, accessibility/keyboard behavior,
   no horizontal overflow at 390 px.
5. Finance: verify invoice totals and cash-received totals are kept distinct;
   do not record test payments or generate official invoices on real accounts.
6. Verify backup completeness (database + private files), separate Auth mapping
   and full disposable restore before calling the service recoverable.

## Next product milestone

Specify the initial-quote calculator as an additive module that categorises
requested blocks by package, flags included work and paid extras, calculates
a reviewable quote total, and freezes accepted scope. Do **not** silently
reprice a signed quote, change historical payment records or reuse an unsigned
supplementary proposal as an accepted invoice.

This audit is deliberately bounded to code and GitHub evidence. No production
security or data-integrity certification is implied.
