# DZOFT — Audited receipt correction: implementation specification

**Prepared:** 20 November 2026 · **Tracking:** #64 · **Status:** REVIEW ONLY — NOT DEPLOYED.

> **Production gate:** Do not create or apply a migration, enable a correction
> button, add direct receipt mutation, or modify invoice/email records until the
> owner has reviewed this specification, the full restore drill (#72), migration
> history, tax/accounting treatment, staging results, and server-side MFA.
> This document lives in GitHub for review; it is **not** an executable migration.

## 1. Verified source-of-truth review (read-only, 20 Nov)

Read-only queries against the active **RD-Clients** Supabase database confirmed:

- `private.dzoft_receipt_adjustments` **does not exist**.
- The existing receipt ledger has two records; the issued-invoice registry has
  three records; one payment-*method* correction is recorded; no issued credit
  notes exist. No client names, file paths, identifiers or bank details belong
  in this public design document.
- `public.project_receipts` is RPC-only (RLS enabled, no client-facing table
  policy). It has no mutable amount/date correction contract.
- Current `private.project_tracking(p_quote)` computes `received` from
  `sum(project_receipts.amount)` plus *unlinked* historical paid invoice flags,
  then derives `remaining` from accepted value, invoiced supplements and credit
  notes. It does **not** subtract receipt adjustments.
- `private.issue_credit_note` checks paid invoice amounts against raw
  `sum(project_receipts.amount)`. A new ledger must update this and other
  receipt-dependent functions *together*, or corrections will contradict
  invoice issuance.
- Live owner validation uses `public.is_owner()` and its seven-day MFA
  freshness policy. Financial corrections need a distinct, shorter server-side
  step-up; see #57 for the unresolved WebAuthn UV requirement.
- The live Supabase migration versions/names differ from some GitHub migration
  filenames. **Reconcile history before generating anything.**

No DDL, RPC calls that mutate data, emails, invoice issuance, or account changes
were made during this review.

## 2. The operation must be unmistakable

| Operation | Correct accounting interpretation | Effect on confirmed funds | Feature |
| --- | --- | --- | --- |
| Mistaken amount entered too high | Correct a fictitious/misentered receipt | Reduce effective receipts | Proposed `reduce_error` |
| Payment recorded twice or never received | Void a *mistaken accounting entry*, preserving its origin | Reduce remaining effective receipt to zero | Proposed `void_error` |
| Receipt actually occurred on a different date | Document correct evidence-backed receipt date | No change to money | Proposed `correct_date` |
| Real refund sent to the customer | **Actual cash outflow**, not a mistaken entry | Separate refund/payment-out ledger | **Out of scope** |
| Customer receives a discount / service cancelled | Reduce contract debt through numbered credit note as required | Does **not** remove historical funds | Existing `issue_credit_note` |
| Invoice amount/number wrong | Rectifying official invoice/credit note | Distinct from receipt corrections | Existing credit-note workflow + accountant review |
| Genuine additional funds | A separately verified receipt | Increase confirmed funds | Existing receipt RPC |

The user interface must never offer “Undo received payment” as a synonym for
“refund”, “credit note”, or “cancel a draft”.

## 3. Proposed storage contract (for review; not created)

**Schema:** `private.dzoft_receipt_adjustments` — private, immutable,
with no direct `anon`/`authenticated` table grants.

| Column | SQL type / constraint | Purpose |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` | Stable audit ID |
| `request_key` | `uuid not null unique` | Global idempotency |
| `quote_id`, `receipt_id` | `uuid not null`, FK to existing quote/receipt | Explicit project linkage, checked again inside RPC |
| `kind` | `text not null check (kind in ('reduce_error','void_error','correct_date'))` | No refund or credit note mixing |
| `debit_amount` | `numeric(12,2)`, positive only for the two monetary kinds | An **effective** reduction, never a direct receipt edit |
| `corrected_date` | `date`, only for `correct_date` | Evidence-backed date override |
| `reason` | `text`, trimmed length 12–500 | Private justification |
| `evidence_reference` | `text`, <= 200, optional | Reference to private evidence (never public URL) |
| `created_by`, `created_at` | `uuid`, `timestamptz default now()` | Actor and immutable transaction timestamp |
| `original_amount_snapshot`, `effective_after_snapshot` | `numeric(12,2)` | Reviewable event-time balances |
| `request_payload_digest` | deterministic canonical digest or equivalent verified-field comparison | Reject reuse of key with altered arguments |

**Constraints:** `debit_amount` present and > 0 only for
`reduce_error`/`void_error`; `corrected_date` present only for
`correct_date`; client/project linkage must always be verified server-side.
Create `(quote_id,receipt_id,created_at)` index. Enable RLS and revoke
direct access. An UPDATE/DELETE guard trigger prevents ordinary DML
changes to existing adjustments.

**Important:** `project_receipts` remains unchanged; its immutable original
amount, date, payment method history, invoice link, PDF and notification trail
are never replaced by this design.

## 4. Proposed RPC (owner-only, NOT YET WRITTEN AS A MIGRATION)

`public.correct_project_receipt(p_quote uuid, p_receipt uuid, p_request_key uuid,
p_kind text, p_amount numeric, p_corrected_date date, p_reason text,
p_evidence_reference text) returns jsonb`

RPC must use a minimal `SECURITY INVOKER` public wrapper and a reviewed
schema-qualified private implementation **only** where elevated rights are
actually necessary. The private function must have `search_path=''` and
must not be callable by `anon`. Never grant direct write permissions to the
audit table. Avoid impersonating a user through client-supplied email claims.

**Transaction algorithm:**

1. Reject unauthenticated or non-owner calls; require a fresh server-issued
   second factor for this **financial** operation, not solely the existing
   seven-day `is_owner()` convenience window. Until server-enforced
   WebAuthn User Verification is proven, require verified TOTP step-up.
   Do not treat device presence, UI state, `localStorage`, or a passkey
   assertion with unverified UV as sufficient.
2. Validate UUIDs, kind, correct receipt/project combination, trimmed reason,
   evidence reference, nonfuture receipt date using **Europe/Paris** business
   date, exact cent amount, and the meaning of the chosen action.
3. Lock **quote first, then original receipt**, following existing payment
   lock ordering. This serializes competing corrections and invoice flows.
4. On repeated `request_key`, compare all normalized arguments. Return the
   original event identifier without inserting a second row *only* if the
   payload is identical. Reject a reused key with changed parameters.
   Do not send email on either attempt.
5. Compute effective amount as original ledger amount less existing debits.
   For `reduce_error`, allow `0.01 <= amount <= effective`. For
   `void_error`, automatically debit **exactly** the remaining effective
   amount. For `correct_date`, require an actual change from the latest
   effective date and a date not in the future; debit **zero**.
6. Append one immutable adjustment record and return a *derived* snapshot;
   never change, delete, or renumber the original receipt or invoice. Use
   a unique key constraint as a final race-condition guard.
7. Expose owner-only private history and a client-safe projection (adjusted
   amount/date and a neutral “corrected” marker; no private audit reason).
   Client delivery, if legally needed, is a separate explicitly reviewed
   action with its own audit/outbox lifecycle.

**Concurrency:** two simultaneous debit requests against one receipt must
serialize; at most its original amount may be debited. A second request must
not make effective receipts negative. Same-key retries must be idempotent
even when clients retry after timeouts.

## 5. All read/write consumers must be updated in one release

Existing live function discovery shows receipt references in at least:

- `private.project_tracking` and `public.project_tracking` — owner and client
  views must return adjusted **effective** totals; preserve original values and
  expose reconciliation metadata on every receipt.
- `public.portal_project_tracking` — same client-safe totals, including
  secret-link access; audit authorization separately.
- `private.issue_credit_note`, `private.issue_accepted_invoice`,
  `private.issue_interim_invoice`, `public.invoice_draft_amount` —
  evaluate invoice paid/unpaid/remaining using effective receipt settlement.
- `private.record_project_payment`,
  `private.record_project_payment_unbilled`,
  `private.link_project_receipt_invoice`,
  `private.auto_issue_project_receipt_invoice` —
  do not double-count or incorrectly block a replacement verified receipt.
- `private.project_payment_admin_meta` — private adjustment history,
  method-correction history and email status must remain distinct.
- `private.guard_receipt_invoices` — retain original invoices/PDFs and
  prohibit stale JSON paid-flag mutations.
- `public.owner_backup_export` and backup/restore scripts — include
  the private adjustment ledger and restore its audit chain.

**Client and Admin UI** (project Payments, accounting overview, invoice badges,
receipts list, reminders) must display **effective paid** status. The historical
JSON `paid: true` on an invoice linked to a later-voided receipt must NOT
become an additional “legacy” payment. Derived invoice status comes from
effective receipt links and credit notes, not a direct JSON toggle.

**Sequencing rule:** Do not deploy an append-only table alone while
`project_tracking`, the official invoice logic or client UI still relies on
raw receipt amounts. That would make the client's balance inconsistent with
the audit ledger.

## 6. Read-only implementation delivered with this review

`tools/receipt-correction-preview.cjs` has been extended with a pure,
network-free `balanceSnapshot()` function alongside `preview()`:

- Aggregates original verified receipts, effective adjustments and unlinked
  historical paid flags without double counting.
- Applies credit notes to contract value, not cash received.
- Distinguishes invoice original value, adjusted payment, credit, invoice
  remaining balance, and “unpaid/partial/paid/credited” status.
- Rejects excessive adjustments, duplicated keys, other receipts, invalid
  decimal precision, unsupported refunds, and future dates when an
  explicit valuation date is supplied.
- Keeps all original inputs unchanged and returns frozen read-only data.

`tests/receipt-adjustment-ledger-model.test.cjs` uses completely fabricated
receipt and invoice identifiers and amounts, never actual client data. This
is a **calculation and specification test**, not authorization or RLS testing.

## 7. Approval, migration and recovery gates

The next stage is **deliberately NOT authorized by merely requesting a
technical review**. Before touching production:

1. **Owner choice:** confirm that `reduce_error` is strictly correction of
   mistaken recorded funds, not a refunded amount; decide how clients will be
   informed and who can approve the adjustment.
2. **Accounting:** validate French credit-note / rectifying-invoice handling
   with the owner's accounting adviser. Official invoice PDF and sequence
   must be immutable; refund and credit note remain distinct.
3. **Recovery:** complete a verified encrypted backup including all files and
   the isolated restore drill (#72). Store secrets off-repo.
4. **Migrations:** reconcile live Supabase migration history with GitHub
   sources. With Supabase CLI v3, use the supported CLI generator and local
   schema tools; do not invent a timestamp or auto-apply a new migration.
5. **Staging:** verify RLS and grants, SECURITY DEFINER boundary,
   cross-client denial, time-limited TOTP, old paid flags, credit notes,
   receipt linkage, concurrent corrections, duplicate requests, invoice
   issuance and exactly-zero email side effects. Use disposable fabricated
   records and a disposable environment.
6. **Go/no-go:** review SQL diff, backout/forward-fix, dependencies,
   integration tests and written owner approval before any live DDL.
7. **Launch:** coordinate backend + Admin + Client changes and cache
   invalidation; verify a separate synthetic draft, then reconcile production
   **read-only**. Corrections to real money require an explicit individual
   instruction based on verified evidence.

**Forward recovery:** an immutable financial adjustment must not be “rolled
back” by deleting its row. Failed deploys require a forward-fix plan and
reconciliation, not overwriting original receipts.

## 8. References and outstanding adjacent issues

- Previous contract: `docs/receipt-correction-ledger-design-2026-11-16.md`
- Financial audit: `docs/financial-reconciliation-audit-2026-11-16.md`
- Supabase database functions security:
  https://supabase.com/docs/guides/database/functions
- Supabase row-level security:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- French invoicing and corrections:
  https://entreprendre.service-public.gouv.fr/vosdroits/F23208
- Official French VAT/invoice correction guidance:
  https://bofip.impots.gouv.fr/bofip/142-PGP.html/identifiant=BOI-TVA-DECLA-30-20-20-20-20131018
- Separate release gates: #57 (passkey UV), #59 (authenticated UX acceptance),
  #72 (actual verified disaster recovery).

**No SQL migration was generated, deployed or queued by this work.**
