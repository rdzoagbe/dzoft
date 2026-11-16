# DZOFT — confirmed receipt corrections (design, not deployed)

16 November 2026 — Issue #64. This is a reviewed proposal, NOT an applied Supabase migration or enabled production feature.

## Verified live baseline

Read-only checks on RD-Clients found one accepted €1,500 contract, two verified receipts totaling €800, three numbered/archived invoices totaling €1,500, and €700 outstanding. Registry and receipt links matched. Do not alter these records for testing.

## Existing technical contracts

- public.project_receipts has an immutable-intended ID, quote_id, optional invoice_id, amount, received_on, method, reference, created_at and created_by. Only the payment-method correction RPC is currently supported.
- private.project_tracking adds sum(project_receipts.amount) and historical paid flags without ledger receipts. It does not subtract later financial adjustments. Both owner and client currently consume its output.
- Official invoice numbers, amounts and PDFs are guarded independently; do not rewrite issued invoices or delete their original receipts.
- Receipt and invoice creation functions lock the quote first. Any correction must follow the same lock ordering and preserve invoice issuance atomicity.

## Operations and their semantics

| Operation | Effect on receipt ledger | Required approach |
|---|---|---|
| Correct payment method | Zero amount change | Existing audited correction RPC |
| Correct historical receipt date | Zero amount change | Append a dated override and preserve original date |
| Reduce erroneous receipt entry | Negative effective receipt delta | Audited reduction limited to unapplied balance |
| Void duplicate/never-received entry | Negative effective receipt delta | Audited remaining-value void; preserve original receipt |
| Increase verified amount | New receipt | Existing verified payment RPC, NOT an upward edit |
| Actual cash refund | Separate cash-out event | Refund ledger plus accountant review and any required credit note |
| Correct issued invoice | No direct receipt operation | Rectifying invoice or credit note with its own number, as applicable |

## Proposed private ledger

Propose private.dzoft_receipt_adjustments with id UUID, request_key UUID UNIQUE, quote_id UUID, receipt_id UUID, kind text (void_error/reduce_error/correct_date), debit_amount numeric(12,2) nullable, corrected_date date nullable, reason 12–500 characters, evidence_reference text nullable, created_by UUID and created_at timestamptz. Reference quotes and receipts; enforce same-quote linkage within the server RPC. Append-only by a trigger forbidding UPDATE and DELETE; grant no direct table access to anon/authenticated; enable RLS.

## Proposed RPC (not implemented)

public.correct_project_receipt(p_quote, p_receipt, p_request_key, p_kind, p_amount, p_corrected_date, p_reason, p_evidence_reference) returns jsonb.

1. Require auth.uid() and privileged owner verification using server-side MFA freshness, not a browser flag. Validate evidence and correction reason.
2. Lock project quote then associated receipt and all adjustments for that receipt transactionally; verify the receipt belongs to the requested quote.
3. On duplicate request key, return the same previous result only for identical parameters; otherwise reject. Apply a unique constraint at the database layer.
4. Correct effective date only through an audit record, rejecting impossible dates and future dates. Amount must remain unchanged.
5. Reduce/void only mistaken recorded funds. Sum existing debits, never allow the new debit to exceed original amount less earlier debits. Prevent negative receipt totals.
6. Preserve original project_receipts row, invoices, invoice registry, invoice PDFs, accepted quote, and historical emails. Queue no notification automatically.
7. Return adjusted project totals atomically and include a separate adjustment history. Add a distinct, opt-in audited client correction notification if explicitly approved.
8. Update BOTH owner and client read models: verified receipts = original confirmed ledger receipts less approved entry-error debits. Maintain legacy paid-flag exclusion whenever the original linked receipt exists, even if voided.
9. Derived invoice-settlement state must replace stale paid flags for affected receipts; do not toggle quote JSON paid values through the client.
10. Keep refunds and credit-note issuance OUTSIDE this RPC. A refund is not automatically a newly collectible debt.

## Release blockers

- Agree accounting semantics of void vs refund vs credit note. Service Public explains when rectifying invoices or credit notes are required; see https://entreprendre.service-public.gouv.fr/vosdroits/F23208 . Obtain accountant signoff.
- Resolve server-side MFA policies and retain owner authorization; see GitHub Issue #57.
- Verify complete migration order/history and triggers; staging-only SQL review needed before generating a canonical migration.
- Extend the project_tracking RPC, invoice paid badges, receipts list and client portal together; do NOT deploy a ledger that the screens ignore.
- Test concurrency (two simultaneous reductions), repeated request keys, partial corrections, cross-client access, negative balances, older paid flags, read-only public behavior and absence of emails.
- Restore an encrypted backup into a disposable staging database first; agree a forward-fix strategy because a genuine financial audit log must not be rolled back by deleting entries.

## Example offline verification

- Original €450 and €350 receipts, total €800, €700 outstanding.
- Preview an erroneous €50 reduction from the €450 receipt: €750 effective received, €750 outstanding; no archived invoice changes.
- Preview voiding the remaining €400 of that receipt: €350 effective received, €1,150 outstanding.
- Fixing receipt date changes €0. An actual refund requires a distinct flow.

The pure preview in tools/receipt-correction-preview.cjs is not imported by the application, sends no requests, and makes no changes. It is a design/testing harness only. Do not represent it as a live reversal feature.