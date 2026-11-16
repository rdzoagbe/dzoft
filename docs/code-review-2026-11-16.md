# DZOFT code review — 2026-11-16

Scope: `admin/index.html`, project dossier, canonical v6 navigation, installed PWA menu, data-backed invoice/journal/documents/catalogue/report views, authenticated Supabase client, and existing synthetic Node/Chromium tests. This is a repository review, **not** an authenticated production data audit or penetration test.

## Verified findings and repairs

| Severity | Finding | Remediation | Validation |
| --- | --- | --- | --- |
| High | Multiple overlapping navigation generations: `unified-app-shell.js` generated old global/project links while `workspace-nav-v6.js` replaced the sidebar, leading to stale handlers, duplicate visual state and inconsistent route ownership. | Reduce `unified-app-shell.js` to branding/breadcrumb only. Keep `workspace-nav-v6.js` as the canonical sidebar/mobile route owner. | Node route ownership contract and Chromium smoke |
| High | `project-finance.js` called `setHref` on sidebar IDs on every render, overwriting canonical `#overview`, `#journal`, and `#invoices` destinations. | Skip legacy sidebar rewrites when `window.DzoftNavigationV6` is active; retain safe fallback hashes only if v6 is unavailable. | Project link contract and Chromium route checks |
| High | During `loadAll()`, the new owner client/quote records were rendered before earlier private journal/documents detail state was invalidated. This could briefly display stale notes after refresh. | Invalidate request generation, mark detail views loading and clear prior detail display before rebuilding owner data. | Synthetic privacy-lifecycle regression |
| Medium | Project switcher accepted a loosely constructed UUID-like string. | Require a complete 36-character UUID before navigating to another accepted project; authorization still handled by the server. | UUID contract regression |
| Medium | Consolidated invoice register omitted the `issuedOn` field used by real invoice records in `suivi.html`. | Recognize `issuedOn` alongside historical date fields. | Invoice metadata contract test |
| Medium | Existing automated tests asserted superseded interface behavior (multiple sidebar owners; automatic one-project redirect). | Replace with a single-owner navigation and stable global dashboard contract. | Full UI test suite |

All modifications above are read-only with respect to customer data: no Supabase migration, no payment or invoice writes, no authentication policy change.

## Important unresolved / follow-up gates

1. **Authenticated end-to-end production verification:** Chromium synthetic fixtures establish routing and rendering, not correctness of each live owner's RLS-filtered query, historical data, or installed-PWA service-worker cache. Test with an authorized owner session before declaring production completely healthy.
2. **Specialized editor consolidation:** `admin/devis.html` and `admin/suivi.html` still contain substantial legacy quotation/billing editing surfaces. They are intentionally retained to protect established invoice issuance, receipts and private journal save rules. Complete replacement needs targeted integration testing and data-integrity checks, not only UI styling.
3. **Catalog as product:** The new Catalogue indexes service lines already appearing in quotations. It is not an independently editable, priced, versioned catalog. Requirements and permissions must be defined before introducing writes.
4. **Business / accounting controls:** Issue #64 still gates receipt reversals and corrections on append-only ledger design, idempotency, RPC authorization, accountant approval, reconciliation and isolated restore evidence. Do not apply database changes solely to improve the admin UI.
5. **Identity / recovery:** Issue #57 gates passkey-only owner access on verified server-enforced user verification and AAL2. Issue #72 gates disaster-recovery claims on a disposable isolated full restore. The code review does not close either issue.
6. **Large-file complexity:** `admin/index.html` and `admin/suivi.html` still combine HTML, UI state, network access and event wiring in large files. Plan incremental module extraction with stable contract tests rather than a high-risk wholesale rewrite.
7. **Legacy compatibility aliases:** `vue-globale` / `vue-classique` and older tab wiring remain as compatibility paths. They are not a second supported design system; retire only after checking bookmarks, redirect behavior and existing installed PWAs.
8. **Translation and accessibility:** FR/EN and mobile behavior still need real-screen audits, keyboard-only navigation and screen-reader checks. The synthetic smoke suite does not prove complete accessibility.

## Release decision

Safe to consider merging the repair branch only after both UI regression and actual Chromium navigation smoke workflows pass. Never treat a skipped real-owner browser workflow as success. Provide users the PR and clearly distinguish code review passing from live production sign-off.
