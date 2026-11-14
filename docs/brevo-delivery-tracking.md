# DZOFT — Verified Brevo transactional email delivery

## What you see in Admin

**DZOFT Admin → Dashboard → Email delivery history** and **Projects → Rodney → Activity** now show a **separate delivery state for each recipient**:

- **Accepted by Brevo:** Brevo accepted the sending API call; delivery is **not verified**.
- **Delivered:** Brevo reports that the recipient's mail server accepted the message. This does not guarantee the person saw it in their inbox.
- **Opened (tracked):** a tracking-pixel signal was observed; automatic image fetching and privacy proxies can produce opens. It is not proof Rodney read it.
- **Temporary bounce / Bounced / Blocked / Invalid / Deferred / Spam complaint:** provider-reported delivery problems. Displayed without changing the underlying payment status or sending record.
- **Sending failed:** the existing outbound queue failed and its existing explicit retry is available.

The separate `email_outbox.status = sent` still means accepted by the provider, never “delivered”. Historical sent messages have an initial **unconfirmed** delivery state until a verified provider event arrives.

## Integration architecture

- Provider: Brevo transactional email API and transactional webhooks.
- Supabase Edge worker: `brevo-delivery-events`, URL
  `https://rzghbvmszbjlqkdjzpxc.supabase.co/functions/v1/brevo-delivery-events`.
- Incoming webhook requests authenticate through a **256-bit random secret** in the HTTP header `X-DZOFT-Delivery-Token`. The secret is created and held inside **Supabase Vault**, and checked using a service-role-only RPC; it is never saved to GitHub, local storage, client JavaScript, or a chat message.
- A one-time trusted `/setup` call uses a **different** Vault setup token to register or update the exact DZOFT webhook through the existing server-side `BREVO_API_KEY`. Custom webhook headers are configured in Brevo automatically. The setup function never changes any unrelated Brevo webhooks.
- Events tracked: delivered, opened (with caveat), hard/soft bounced, blocked, invalid, deferred and spam. Only the Brevo message-ID, recipient email, event name and UTC event timestamp are used to match an existing `email_outbox` row. Raw message content, IP, user-agent, subject and click links are not stored.
- An event with an unknown message-ID or the wrong recipient cannot update DZOFT. Duplicate callbacks are idempotent; out-of-order provider callbacks do not regress a more recent state.
- The private audit table stores minimal event type and timestamp, not full webhook payloads. It is not available to anonymous or client users; owner-only RLS for email_outbox is retained.
- The setup worker performs a one-time **read-only reconciliation** of a bounded set of previously sent DZOFT emails against Brevo's `GET /v3/smtp/statistics/events?messageId=...` API. It never re-sends emails, publishes updates or touches client payments.

## Verification and operations

- Supabase SQL tests: `tests/brevo-delivery-lifecycle.sql`, run strictly inside `BEGIN; ... ROLLBACK;`.
- Node tests: `tests/brevo-delivery-ui.test.cjs` verify classification, spoofing resistance contracts and private client-facing boundaries.
- Chromium E2E: synthetic owner dashboard + private project activity, with two separate recipients and no actual API writes.
- Live smoke: an unauthenticated webhook request must return **401**, a configured webhook must be visible in Brevo's Transactional Webhooks, and a live provider event must update only its matching recipient.
- If Brevo is temporarily unavailable, an email must remain **Unconfirmed** rather than being labeled Delivered. A setup-backfill failure should be shown as incomplete, not reported as proof of delivery.

**Brevo webhook and logs references:**
https://developers.brevo.com/docs/transactional-webhooks
https://developers.brevo.com/docs/secured-webhooks
https://developers.brevo.com/reference/get-email-event-report

The integration is added without confirming or changing receipts, generating invoices, emailing Rodney, or changing the signed quote.
