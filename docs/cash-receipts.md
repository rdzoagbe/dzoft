# Verified payments without an invoice number

DZOFT can record genuinely received money before its official numbered invoice is issued.

## Record

On the admin's **Dossiers → Projets → Fiche projet** page, choose **Enregistrer un paiement** then **Sans numéro de facture — à établir**. Enter the exact amount, actual date received, method (cash / transfer / card / other), and optional reference. Choose whether to notify the client. Confirm only after the cash has been handed over or the bank/card receipt has been verified. No payment is created automatically by installing the update.

The normal `record_project_payment` path for a numbered invoice is still supported. The new owner-only `record_project_payment_unbilled` stores a ledger receipt with `invoice_id = NULL`, checks that it cannot exceed the remaining agreed amount, enforces idempotency, and can queue a payment-confirmation email for the client and owner. A queued email is **not** proof of delivery.

## Issue and link the official invoice

The recorded payment appears as **Facture à établir** in both the admin and client progress views. In the same project payment card, open **Associer une facture au paiement** after actually issuing the official invoice.

You can attach a previously recorded numbered invoice with enough available invoice balance, or create its DZOFT entry using the **real official number, amount and label**. The latter does not issue an invoice in Revolut or any other official accounting system. Do not generate a fictional invoice number as a placeholder.

The `link_project_receipt_invoice` RPC atomically associates the pre-existing receipt and, if necessary, creates the invoice entry. The receipt amount **is never reinserted** or counted twice. It marks the invoice as paid when all its linked receipts cover the invoiced amount. The original payment-confirmation email is **not** resent when a number is attached.

You can attach the official invoice PDF from the existing invoice controls in the project.

## Implementation and safety

- Migration: `supabase/migrations/20261113214500_verified_payment_without_invoice.sql`. Only makes the existing `invoice_id` column nullable, updates its guard to skip unbilled receipts, and adds two owner-checked RPC pairs. No deletion or rewrite of existing client, quotation or receipt rows.
- Transactional ledger: `public.project_receipts` remains RPC-only. Existing `private.project_tracking` sums receipts and legacy paid invoices without inflating the total.
- A missing invoice does **not** mean the cash wasn't received. The dashboard and finance area flag the document to issue while preserving correct received/remaining totals.
- An official invoice must ultimately be produced according to applicable accounting rules. A confirmation email or DZOFT ledger entry is not itself an official invoice.
- Test SQL: `tests/verified-unbilled-payments.sql` wraps all fictitious transactions in `BEGIN` / `ROLLBACK` and verifies the data calculations, no duplicate emails, invoice linkage, owner restrictions and overpayment validation.
- UI tests: `node --test tests/*.test.cjs`.

**Deployment order:** additive database migration first, then merge frontend changes to main. Take an independent backup as appropriate for your Supabase plan; the Git repository contains no customer records or backup data.
