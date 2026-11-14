# DZOFT — Signed-scope change requests

## What this does

The public website promises a fixed price for the **accepted scope**, not unlimited new features. Clients can request additional work from their existing **Project** page. The original signed quote and invoices remain immutable.

Lifecycle:
1. **Client requests:** title and description, no immediate commitment or charge.
2. **Owner reviews:** submits scope, extra price in EUR, and any schedule impact, or declines the request with a reason.
3. **Client decides:** reviews the *current* proposal version, explicitly checks the approval box, enters their name and accepts or rejects. A revised version invalidates consent to an older version.
4. **Owner begins work:** only an approved proposal can become **In progress**, then **Completed**.
5. **Accounting:** any supplementary invoice must be issued separately, referencing the approved change. Never increase the original signed quote or mutate an issued invoice. **Automatic supplementary invoice generation is not part of this change.**

This is an auditable acceptance record, **not the OTP-based electronic signature used for the initial quote**. For contracts requiring a formal electronic signature or standardized e-invoicing, complete that separate workflow.

## Implementation

- `public.dzoft_change_requests`: current state + proposal version + amount/timing and approver.
- `public.dzoft_change_events`: append-only event log of requests, proposals and decisions. RLS enabled; table DML revoked.
- `public.my_*` APIs check `auth.uid()` against linked `clients.user_id`.
- `public.portal_*` APIs verify the existing secret link against `clients.portal_token`, limited to clients who have not registered an account.
- `public.owner_*` APIs enforce MFA-aware `public.is_owner()`.
- Both client and owner can view only their permitted project changes. No data from unrelated projects is exposed.
- All monetary values are decimal EUR amounts with a maximum set by server validation. Duplicate/outdated approvals and unapproved execution are rejected.
- Basic submission rate limiting (5 active requests, one new request per 60 seconds per client/project).
- No email sends, automatic invoicing, payment inserts, or changes to `quotes.accepted_total`.

## How to use

**Client:** Client Workspace → Projects → select a signed project → Change requests. Submit a request. Once DZOFT posts a proposal, review scope/price/timing and explicitly approve or decline.

**Owner:** Admin → Projects → open project → Change requests and supplementary proposals. Review, prepare a proposal, then see the recorded client decision. Once approved, mark work started and completed. Handle any supplementary invoice as a separate accounting transaction.

## Verification

- `tests/change-requests.test.cjs`: entry points, permissions, consent and ledger isolation.
- `tests/change-requests.sql`: synthetic, rollback-only state transitions, stale proposal protection, audit immutability, and unchanged accepted amount.
- Standard UI and desktop/mobile smoke CI.

## Future tasks
- Notification emails for new requests and proposals, with recipient-specific delivery tracking.
- Downloadable signed amendment PDF, archived privately and linked to the approval event.
- A supplementary invoicing flow integrated with the existing sequential invoice numbering without conflating addendum billing with the original project total.
