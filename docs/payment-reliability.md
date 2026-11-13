# DZOFT — Reliability-first release, November 2026

## What this release actually changes

DZOFT's project workspace now distinguishes **money received**, **money merely announced**, **official invoices**, and **outbound email status**. They are not interchangeable.

### Financial truth

- Confirmed deposits are calculated from `project_receipts`; pending and client-reported transfers are excluded until verified.
- The finance dashboard shows pending/reported transfers in a separate fourth total. A pending amount **remains included** in the outstanding balance.
- Receipt history shows the actual payment method and date.
- A new **Correct payment method** action lets the owner fix a misclassified cash/transfer/card payment. The owner must enter a reason of at least 12 characters and confirm.
- A correction writes the previous method, corrected method, reason, actor and date to a private audit table. It does not change the amount, receipt date, invoice association, customer records, or payment-confirmation emails.
- The earlier €450 record is **not** edited automatically. The administrator may open its correction form and select `Espèces` only after checking the original evidence.

### Email status, not promises

The owner sees each receipt's client-email status as recorded by the outbox:
- **Accepted by provider:** `email_outbox.status='sent'` (not proof of inbox delivery or reading)
- **Queued:** a record exists but has not reached `sent`
- **Failed:** provider/worker reports an error; inspect email history
- **No client email recorded:** there is no client outbox row associated with that receipt
- **Unavailable:** cannot load the owner-only status feed, explicitly labeled as unknown

The client portal still shows payment receipts and progress, but never correction reasons, audit actors or email administration. No notification is triggered by a metadata correction.

## Deployment controls

1. Use a dedicated branch and review pull request.
2. Execute the migration and its integration test in a single rollback-only transaction before applying it.
3. Take a baseline of existing record counts and fingerprints, then recheck after.
4. Run `node --test tests/*.test.cjs` and the rollback SQL integration test.
5. Merge the UI only after the database function is confirmed deployed.
6. Confirm that GitHub Pages deploys and that both FR/EN views render.

No existing client data is exported into GitHub. This is **not a database backup**. An independent recoverable backup of database and Supabase Storage files remains necessary, with retention, restore testing and restricted access. Follow Supabase's plan-specific backup and PITR guidance.

## Remaining work (in priority order)

1. **Authenticated browser regression tests:** log in with a non-production test account, exercise MFA, create a pending transfer, mark it sent by the client, verify it remains unpaid, confirm with opt-in notification, and check the client portal. Do not send real test emails to customers.
2. **Invoice/reporting checks:** verify partial receipts, invoice-number association, invoice PDF access, and maintenance billing; test duplicate receipt IDs and rejects.
3. **Restore drill:** independently back up Postgres and storage objects; verify a restore in an isolated Supabase project before trusting the backup policy.
4. **Session isolation:** move the administrative app to a dedicated origin. The shared `rdzoagbe.github.io` origin makes browser local-storage session tokens accessible to other same-origin projects. This cannot be fully resolved with a cosmetic redirect or by moving the app to another subdirectory.
5. **Code maintainability:** extract the large HTML-embedded scripts into tested modules, keep existing URL routing and translations, and add browser smoke tests to CI.
6. **Marketing proof:** publish completed client case studies and testimonials only when permission and supporting facts exist. Keep demos explicitly labeled as such.

## Manual verification (before important financial corrections)

- Admin / Payments shows four totals; pending must not be included in received.
- Client page does not show private correction/audit controls.
- The original €450 receipt and receipt date appear unchanged.
- Correct method only after checking real evidence; audit entry should appear immediately after successful correction.
- Check the email outbox status independently before claiming an email reached the client.
- On mobile, test opening project payments, pending status, correction details, invoice attachments and client messages.

**No feature here changes an existing client's payment without the administrator taking an explicit action in the app.**
