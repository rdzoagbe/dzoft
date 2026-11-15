# DZOFT private workspace — faster to find, less to learn

## What changed

This is an incremental **owner-only interface redesign**, not a replacement of Supabase, authentication, billing or the client portal. All the original page URLs and functionality remain available. It requires **no SQL migration**.

### One search for cases

Inside **Dossiers clients / Clients & projects**, typing at least two characters into the existing search field now shows matching, already-loaded **requests, clients, quotes and active projects** together. Choose a result to go to its existing screen and highlight its row. It is not a separate private-data index: it searches the DOM that the authenticated admin already rendered, sends no new requests, and saves no search history.

The normal section filters remain available, including request statuses, archived requests, and individual client editing. Search results contain only the label and a short description; never raw project notes or full lead messages. The first 24 matches are displayed to avoid overwhelming small screens; refine a query for more.

### Five clear destinations

The daily working areas are **Aujourd'hui / Today**, **Dossiers clients / Clients & projects**, **Messages**, **Factures & paiements / Billing** and **Paramètres / Settings**. The trash is still reachable through **Settings → Voir la corbeille et restaurer**, the existing top options, and the installed PWA menu. Original deep links to requests, quotes and projects continue working. The client portal is unchanged.

### One project page

The project header offers direct actions for **invoices and payments**, **milestones and progress**, **client messages**, **documents** and **history**. Each jumps to the existing feature and automatically opens its folded details when needed. No payment is confirmed, invoice issued, email sent or project note published by opening a section.

## Validation

- Static tests: \`tests/private-workspace-flow.test.cjs\`.
- Synthetic Chromium tests: \`e2e/synthetic-admin.spec.mjs\` use mock data and block private Supabase network calls; verify the search and shortcut navigation on desktop/mobile.
- Follow \`.github/workflows/ui-regressions.yml\` and \`.github/workflows/browser-regressions.yml\` before merging to main.

The invoicing improvements merged separately in PR #49. This UI-only change preserves the newer invoice studio and does not alter invoice business logic. No data migration, email sending, new billing records, or recovery work is included.
