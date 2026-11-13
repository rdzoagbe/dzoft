# DZOFT — Payment status and optional Revolut invoicing

### The distinction that protects the financial totals

An expected or client-reported transfer is **not** money received. Never reduce the outstanding balance or send a receipt confirmation until the owner explicitly verifies that funds actually arrived.

In the project card **Suivi des versements**, the owner can:
1. **En attente / Pending** — create an expected payment (amount, method, reference) with no invoice number. It does **not** affect the confirmed received figure.
2. **Confirmé envoyé par le client / Client says sent** — set a reported date when the client confirms initiating the payment. Still **not** received.
3. **Reçu et confirmé / Received** — choose the actual date the money cleared, and an independent checkbox **Informer le client par e-mail**. Only this step enters the existing verified receipt ledger and updates the received/outstanding amounts.
4. **Annulé / Cancelled** — void an expected payment that never arrived. A cancelled status is final, but no previously verified receipt is deleted.

The owner cannot switch a verified receipt back to pending. Corrections to historical confirmed receipts require a separate audit-safe reversal workflow, not a status flip.

### Invoicing with Revolut is optional

The pending-payment form does not require an invoice number or a Revolut invoice. If you want to issue a formal invoice, do so separately using Revolut Business (or another invoicing system) and associate the **real** official invoice number later in DZOFT. The app does **not** create Revolut invoices automatically or have a Revolut API connection.

### Client notifications

- Creating or changing pending/reported statuses does **not** send a false payment confirmation.
- After the owner confirms actual receipt, optional client notification uses the existing `queue_project_event` outbox and includes amount received, cumulative confirmed total, and remaining balance.
- Notification **queued** ≠ delivered; delivery is checked in existing email history.
- The client portal can see pending/reported status, as well as verified payment history. Pending money is not included in its "reçu" total.

### Data preservation

The migration creates `project_payment_statuses` and new owner-checked RPC functions, then expands the existing authorized `project_tracking` JSON. Existing `project_receipts`, quotations, invoices, messages, and clients are not rewritten, dropped, or deleted.

The existing €450 confirmed deposit remains untouched. DZOFT cannot infer that the new €350 bank transfer has cleared just because the client says it was sent. Record it as pending or sent, then confirm only after checking the account. Historical cash-vs-transfer metadata should be corrected via a separate audited workflow rather than silently editing a verified receipt.

### Deployment & verification

- Node regression suite: `node --test tests/*.test.cjs`
- SQL integration suite: `tests/payment-status-lifecycle.sql` uses a `BEGIN/ROLLBACK` transaction; test fixtures and notification events are not persisted.
- Deployment order: database migration → SQL integration test → merge frontend → validate GitHub Pages deployment.
