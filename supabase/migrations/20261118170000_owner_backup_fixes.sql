-- DZOFT (18 Nov 2026) — owner backup, two fixes from review.
-- 1. One consistent picture: every table is now read in a single SQL statement, so the export sees one snapshot
--    (under READ COMMITTED each statement of a function can otherwise see a different moment, e.g. an invoice's
--    register entry without the invoice itself).
-- 2. A backup is recorded only once the browser has encrypted and downloaded the file: the export no longer logs;
--    the page calls owner_backup_confirm() afterwards. A failed download leaves the dashboard reminder in place.
create or replace function public.owner_backup_export()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare b jsonb;
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  with t as (select jsonb_build_object(
    'leads',                        (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.leads x),
    'clients',                      (select coalesce(jsonb_agg(to_jsonb(x) - 'portal_token'),'[]') from public.clients x),
    'quotes',                       (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.quotes x),
    'messages',                     (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.messages x),
    'reviews',                      (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.reviews x),
    'notifications',                (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.notifications x),
    'project_receipts',             (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.project_receipts x),
    'project_receipt_method_audit', (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.project_receipt_method_audit x),
    'project_payment_statuses',     (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.project_payment_statuses x),
    'project_updates',              (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.project_updates x),
    'project_work_items',           (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.project_work_items x),
    'project_events',               (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.project_events x),
    'email_outbox',                 (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.email_outbox x),
    'dzoft_change_requests',        (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.dzoft_change_requests x),
    'dzoft_change_events',          (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.dzoft_change_events x),
    'dzoft_credit_notes',           (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.dzoft_credit_notes x),
    'settings',                     (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.settings x),
    -- The invoice register and its counters prove that invoice and credit-note numbers follow on without gaps.
    'invoice_registry',             (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from private.dzoft_issued_invoice_registry x),
    'invoice_sequences',            (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from private.dzoft_invoice_sequences x),
    'credit_note_sequences',        (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from private.dzoft_credit_note_sequences x)
  ) v)
  select jsonb_build_object('format','dzoft-backup','version',1,'exported_at',now(),'tables',t.v,
    'counts',(select jsonb_object_agg(k, jsonb_array_length(t.v->k)) from jsonb_object_keys(t.v) k
              where k not in ('invoice_sequences','credit_note_sequences')))
    into b from t;
  return b;
end $f$;
revoke all on function public.owner_backup_export() from public, anon;
grant execute on function public.owner_backup_export() to authenticated;

-- Called by the page after the encrypted file has been created and handed to the browser for download.
create or replace function public.owner_backup_confirm(p_counts jsonb)
 returns timestamptz language plpgsql volatile security definer set search_path to '' as $f$
declare at timestamptz;
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  insert into private.owner_backup_log(made_by, counts)
    values (auth.uid(), case when jsonb_typeof(p_counts)='object' then p_counts else '{}'::jsonb end)
    returning made_at into at;
  return at;
end $f$;
revoke all on function public.owner_backup_confirm(jsonb) from public, anon;
grant execute on function public.owner_backup_confirm(jsonb) to authenticated;
