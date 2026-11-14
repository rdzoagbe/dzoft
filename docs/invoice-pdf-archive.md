# DZOFT — Automatic private PDF archive for numbered invoices

## Scope
When DZOFT issues an invoice through `auto_issue_project_receipt_invoice`, it now attempts to generate a standalone A4 PDF, upload it into the existing private Supabase `client-files` bucket and bind its path to the **same** issued invoice. The receipt, number, total and emails are never re-entered or resent.

The existing authenticated client portal already offers **Download PDF** when the invoice's `file` field is set. No new public URL, unauthenticated download endpoint or token is created.

## Owner workflow
1. In **Projects → Payments**, generate a numbered invoice as usual; DZOFT attempts archival automatically.
2. If PDF generation, upload or linking fails, the invoice remains correctly issued and shows **Archive invoice PDF**. Click it to retry without creating a second invoice.
3. An already archived invoice shows **Download invoice PDF**. The signed URL expires; the stored file remains private.
4. **Official invoices and details** shows its linked PDF; generated invoice PDFs cannot be removed or replaced through the admin UI.
5. The client sees the same document through their existing authenticated invoice download UI.

### Where a retry will be required
The client must have a linked `auth.users` account, since the private Storage RLS currently allows `u/<client-user-id>/...` paths. If there is no client account, the numbered invoice remains issued but the archive state stays incomplete. Enroll/link the client account, then retry. Never put an invoice into public storage to work around this.

## Security and ledger invariants
- No external browser JavaScript dependencies; the deterministic PDF writer is local.
- Deterministic file path: `u/<client-user-id>/factures/<quote-id>/<F-YYYY-NNNN>.pdf`.
- `sb.files.upload(...)` uses `x-upsert:false` (no overwrite). A repeat 409 is reconciled by the strictly validated attachment RPC, not by replacing bytes.
- The attachment RPC validates owner authentication, quote, issued number, private bucket object, client user identity and exact path.
- The immutable document guard prevents changing the attached PDF path, invoice label and issuance metadata on an already-issued invoice. Future corrections should use a documented credit note, not silent edits.
- The client portal's pre-existing private `sb.files.link(...)` authorization is preserved.
- No real client records are written by synthetic tests. Run `tests/invoice-pdf-archive.sql` inside a transaction which rolls back.

## Legal and archival limitations
This PDF is a printable representation of an issued DZOFT invoice, **not** a validated French Factur-X/UBL/CII e-invoice and **not** a substitute for an accredited French e-invoicing platform where required. Verify mandatory information (seller/buyer identity, SIREN where applicable, category, payment terms, tax regime and any applicable B2B penalties) before treating it as the final accounting document.

**Storing an invoice in Supabase is not an independent backup.** A verified encrypted off-site export and isolated restore test remain outstanding; see `docs/backup-recovery.md`. Do not mark disaster recovery as complete merely because PDFs are downloadable.

## Tests
- `tests/invoice-pdf-archive.test.cjs`: PDF bytes, issued number/date, security contract and client download existing path.
- `tests/invoice-pdf-archive.sql`: transaction-only creation, wrong/missing path, no duplicate receipt, owner-only attachment, immutable invoice.
- GitHub desktop/mobile tests: synthetic browser workflows with no real client uploads or emails.
