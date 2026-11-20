# DZOFT — Authenticated acceptance gate (20 November 2026)

**Repository:** rdzoagbe/dzoft  
**Status:** PENDING genuine owner/client sign-in and physical-device acceptance. The script and existing synthetic CI tests do not certify production authorization.

## Read-only preflight — verified 20 November

The linked RD-Clients project is ACTIVE_HEALTHY in the Paris region. Read-only SQL returned 3 Auth accounts, 1 quote, 2 recorded receipts, and 3 private client-files Storage objects.

For accepted original project D-2026-001: **accepted scope €1,500; received €450 cash + €350 bank transfer = €800; original balance €700**. These figures were checked from the accepted quote and receipt ledger, NOT inferred from an invoice signature. No extra-work amount is counted unless contractually accepted and subsequently reflected by the authoritative ledger. No live records were edited.

## Owner-operated real-browser probe

The opt-in tools/acceptance-readonly.mjs is designed for a trusted Windows computer. It opens a fresh visible Chromium browser, lets the owner personally complete normal sign-in and TOTP, and checks the canonical seven Admin sections, real dashboard, 390 px browser width, and (optionally) the five sections of a project selected **by the owner in the browser**.

Install dependencies from this repository, then run locally:

    npm install --ignore-scripts
    npx playwright install chromium
    node tools/acceptance-readonly.mjs

An additional, explicitly authorized **test-client** account can be checked with:

    node tools/acceptance-readonly.mjs --client

The script does not accept passwords, store cookies/tokens/browser state, download files, take screenshots, or print customer names or amounts. It blocks service-worker interception and aborts potentially mutating network requests. Only manually performed Auth sign-in/TOTP requests and a reviewed allowlist of read-only RPCs are permitted. A blocked request is reported by operation label/count and makes the run non-passing; do not add a blocked RPC to the allowlist without verifying its actual server definition.

The test is deliberately **not run in GitHub Actions**. A 390 px browser viewport cannot replace an installed phone PWA. Browser tests may require local Chromium installation.

## Real authenticated acceptance matrix

| Gate | Pass condition | Current state |
| --- | --- | --- |
| Owner sign-in | Supported password or passkey first factor, genuine required TOTP, correct new owner dashboard | **PENDING** |
| Owner navigation | Dashboard, Clients, Quotes, Projects, Accounts, Messages and Settings open current workspace, no legacy page or duplicate mobile menu | **PENDING** |
| Project navigation | Overview, Work, Money, Documents and Messages work on one real authorized project; Cancel never commits unfinished form data | **PENDING — #59** |
| Financial display | Project D-2026-001 displays accepted €1,500, genuinely received €800 and original remaining €700; an invoice signature is not receipt of funds | **SQL verified, UI PENDING** |
| Supplementary work | Unaccepted new proposal is distinguished from signed scope; preparing Outlook/WhatsApp text does not send mail | **PENDING** |
| Client privacy | Authorized test client sees only their own project/invoices/progress and correct ledger-backed balance; independently authorized second test client cannot access it | **PENDING** |
| Owner MFA | UI hides private data immediately on AAL1 downgrade/expired MFA and failed owner recheck; server remains the permission boundary | **Synthetic CI verified, live PENDING — #57** |
| Language | Admin Settings FR–EN–FR affects nav, invoice UI, project tabs and update controls consistently | **PENDING** |
| Mobile PWA | On an **installed physical Android PWA**, exactly one top menu, no bottom duplicate, seven correct destinations and no horizontal overflow | **PENDING** |
| Passkey-only owner access | Server enforces user verification before removing TOTP; preserve recovery | **BLOCKED — #57** |
| Receipt amount/date correction | Append-only audit and legally appropriate correction, not editing or deleting original receipts | **BLOCKED — #64** |
| Full disaster recovery | Database + three private Storage objects + Auth mapping restored and verified in a disposable isolated target | **BLOCKED — #72** |

## Safety and evidence

Only authorized accounts and read-only views should be used on production. **Do not** record a payment, sign a proposal, issue a real invoice, send a message, reverse a receipt, create a client, alter MFA factors, change an official PDF or download private files merely to run acceptance. Use synthetic/staging fixtures for tests requiring writes.

Record test case, PASS/FAIL/NOT TESTED, test date, browser/device type and a **sanitized symptom**. Never commit screenshots of real clients, project URLs/IDs, access tokens, MFA codes, invoice files or private correspondence to GitHub.

Keep issues **#57, #59, #64 and #72 OPEN** until their distinct gates are fulfilled. An approved pull request, a green synthetic build, a SQL aggregate or the mere existence of this runner is not authenticated production acceptance.
