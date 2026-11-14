# DZOFT — Brevo delivery verification (live)

## Status, 14 November 2026

**Active in Supabase RD-Clients:** Brevo event-reporting reconciliation, scheduled every hour.
The first backfill checked **10** existing email records and recorded **18** matching
provider events. Brevo independently confirmed delivery of Rodney's €350 payment
confirmation at **2026-11-14 09:16:52 UTC** (10:16:52 Paris time).
The owner's copy was delivered and has an open-tracking signal.

The Brevo **webhook-management API returned HTTP 400** on this account for
both filtered and unfiltered GET /v3/webhooks. Consequently, the
webhook receiver is securely deployed but **no Brevo webhook has been
successfully registered**. Do not call it connected. Instead the
working official reporting API `GET /v3/smtp/statistics/events` is used
for an automated, hourly, server-side poll. It requires no changes to a
recipient's email or action by Rodney. There are no automatic emails.

## Owner interface

**DZOFT Admin → Dashboard → Email delivery history** and
**Projects → Rodney → Activity** show each recipient separately:

- **Accepted by Brevo:** sending API accepted the request; no delivery verification yet.
- **Delivered:** the receiving mail server accepted the message; not proof the
  recipient read or noticed it.
- **Opened (tracked):** an email image/open event was detected; privacy proxies
  and automatic image downloads can trigger this without human reading.
- **Bounced, temporary bounce, blocked, invalid address, deferred, spam:** provider-reported issues.
- **Sending failed:** the pre-existing email sending process failed, with its
  existing manual retry available.

The original `email_outbox.status` is **unchanged**: `sent` continues to
mean accepted by the sending provider. New `delivery_status` and event
timestamps record the downstream result. Old emails without a matched provider
event remain `unconfirmed`.

## Data flow and security

The Edge Function `brevo-delivery-events` is deployed as an HTTP endpoint
with `verify_jwt=false`, but its `/reconcile` and `/backfill` routes
require a **256-bit random secret generated and stored exclusively in Supabase Vault**.
Only the server-side Cron job and trusted Edge Function use that token.

- Cron job: `dzoft_brevo_delivery_reconcile`, runs at minute 25 of every
  hour (UTC). No mobile app, laptop, or browser needs to remain open.
- The worker reads at most **18 recent DZOFT messages** (past 14 days) during
  each poll. It queries Brevo by the **known provider message ID + recipient email**.
- One-off backfill can check up to 25 past emails (up to 85 days), without
  sending anything.
- Brevo events are saved only when **both** message ID and recipient address
  match an already sent DZOFT outbox record. Callback ordering and duplicates
  are handled safely; the existing `status=sent` is never changed.
- Event audit rows contain only internal outbox ID, event type and timestamp.
  Raw email content, tracking links, IP, user agent, and other Brevo payload
  fields are never stored in DZOFT.
- The delivery status and audit are owner-private. Client portal access,
  finance records, signed quotes and payment receipts remain unchanged.
- The separate HTTP webhook route can process future Brevo events, but only
  with a different Vault-protected secret in a custom header; it is not yet
  connected in Brevo due to webhook-management API errors.

If Brevo is unavailable or its API returns an error, a message remains in its
last *verified* state. We do not invent delivery results.

## Tests and proof

- SQL transaction-only tests:
  `tests/brevo-delivery-lifecycle.sql`: recipient substitution, unknown IDs,
  retries, out-of-order callbacks, valid Vault credentials, owner-only grants.
- JS tests: `tests/brevo-delivery-ui.test.cjs`.
- Chromium tests: mocked owner and client rows, verifies independent statuses
  on dashboard and project activity without reaching production.
- Live initial backfill: HTTP 200 `{"ok":true,"mode":"scheduled_polling","checked":10,"matched":18}`.
- Next monitoring check: confirm the scheduled Cron job runs successfully and
  `last_polled_at` advances. A manual successful backfill does not prove a
  scheduled run occurred.

Brevo documentation:
https://developers.brevo.com/reference/get-email-event-report
https://developers.brevo.com/docs/transactional-webhooks
https://developers.brevo.com/docs/secured-webhooks
