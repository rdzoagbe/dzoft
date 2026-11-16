# DZOFT financial reconciliation — 16 November 2026

## Scope and non-destructive guarantee

Read-only reconciliation of the connected **RD-Clients** Supabase project (`rzghbvmszbjlqkdjzpxc`) against the GitHub application, issued-invoice SQL migrations, and payment-receipt UI. No production data, invoice numbers, email outbox rows, migrations, or security policies were modified during this audit.

## Verified live baseline (aggregate queries, 16 November 2026)

| Measure | Verified value |
|---|---:|
| Accepted original quote | €1,500 |
| Confirmed receipts in `project_receipts` | €800 (2 records) |
| Current outstanding balance | €700 |
| Invoiced on original quotation | €1,500 (3 records) |
| Entries in official `private.dzoft_issued_invoice_registry` | 3 |
| Missing registry-to-invoice matches | 0 |
| Missing invoice-linked receipts | 0 |
| Invoices without archived PDFs | 0 |
| Duplicate final invoices | 0 |
| Original quotation overbilled | No |
| Original quotation overcollected | No |
| Audited payment-method corrections | 1 |
| Unlinked confirmed receipts | 0 |

The **remaining to invoice** is €0 on the accepted quotation; the **remaining to collect** is €700. Issuing the €700 final invoice did **not** change the €1,500 accepted quote or pay it. The requested additional €500 scope has not been accepted and is not part of this calculation.

### Live schema and function verification

- `issue_accepted_invoice`, `issue_final_invoice_checked`, `issue_interim_invoice`, `invoice_draft_amount`, `project_tracking` and `correct_project_receipt_method` exist.
- Active triggers include `a_guard_receipt_invoices`, `dzoft_issued_invoice_amounts`, and `dzoft_auto_invoice_pdf_immutable`.
- The server receipt-invoice function excludes supplemental invoices from original quotation ceilings.
- The owner-only issue function is idempotent. The invoice immutability guard is present.
- Database migration history includes the auto-numbering, PDF archive, payment correction, accepted-invoice and interim-invoice updates. Git migration filenames and recorded migration history names differ; they should be reconciled before any migration work.

These are **read-only checks**, not evidence that every real authenticated issuance or email-delivery path has been exercised.

## Fix applied in companion pull request

In the project invoice editor, legacy `Mark as paid` checkboxes directly mutated the JSON invoice `paid` flag. That path did not require the amount, receipt date, method, idempotency key or audit trail used by the verified receipt RPC. It could incorrectly increase legacy paid totals when no receipt existed.

- Remove direct user-editable paid checkboxes for **new** confirmation, but retain historic paid flags and amounts unchanged.
- Show previously paid external invoices as legacy historical records; do not record a second receipt.
- Show `Record verified payment` on eligible unpaid invoice details, official and external.
- The button opens the owner-only existing payment editor, selects the matching invoice, and requires full amount/date/method and final confirmation. If the invoice is not available, fail closed with a warning rather than inventing an unbilled receipt.
- Server RPC remains the authority for recording, ledger totals, invoice linking, idempotency and notification queuing.
- No change to already issued official invoices or PDFs.

## Payment correction policy — NOT IMPLEMENTED

Already supported in production: owner-only **payment method** corrections with reason (12–500 characters) saved to `project_receipt_method_audit`. They leave amount, date, original invoice and email history untouched.

**Amount, date or duplicate receipt corrections** cannot safely be implemented by deleting or editing a confirmed receipt row or by toggling an invoice's paid flag. They require a reviewed accounting reversal/correction ledger, including:

1. Owner authorization based on authenticated session and server-side MFA rules.
2. Original receipt reference, correction type, positive/negative adjustment amount and receipt currency.
3. Mandatory documented reason, supporting evidence, actor and timestamp; immutable reversal record.
4. Transactional account balance adjustment and explicit protection against over-reversal or duplicate request.
5. No renumbering, rewriting or deleting invoices or payment receipts; issue credit notes/rectifying invoices separately when legally required.
6. Explicitly distinguish *refund actually sent*, *credit-note issued*, *cash receipt corrected*, and *client notice sent*.
7. Consistent owner and client views, and a separate email notification audit. No automatic client email without user confirmation.
8. Tests for repeat requests, partial reversals, racing requests, unrelated client access, voided payment claims, and accounting reconciliation.

**Release gate:** no DDL/migration for such a reversal ledger should be applied before reviewing its SQL, existing invoice triggers, rollback procedure, regulatory documentation and owner acceptance.

## PR #52 reconciliation

PR #52 is obsolete and merge-conflicted against the released UI work. Its valid behavior has been covered in other changes: live payment truth/remaining collection, reviewed amount issuance, protected official invoices, safe correction guidance and the future PDF accepted-quote recap (PRs #56, #60). Do not merge its outdated snapshot into `main`.

## Manual release acceptance (synthetic tests are not sufficient)

- Open original accepted quote; verify **€1,500 accepted**, **€1,500 invoiced**, **€800 received**, **€700 remaining to collect**.
- Verify all three official archived PDFs match unchanged registry numbers.
- Open the final €700 invoice; confirm *Record verified payment* navigates to the receipt form without creating funds merely by opening it.
- **Do not submit** a €700 real receipt unless it has actually cleared.
- Confirm that historical €450/€350 receipts are still visible and cannot be re-entered through an invoice shortcut.
- Verify payment-method correction history and that incorrect/duplicate amounts have no silent delete path.
- Verify bilingual mobile/Desktop and client portal read-only invoice status.
- Confirm GitHub Actions green, GitHub Pages success, and cached PWA refresh.
