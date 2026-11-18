-- Synthetic, transactional check of the owner backup. Nothing persists after rollback.
begin;
-- (run after supabase/migrations/20261118160000_owner_backup.sql is applied)
create temp table t_b as select gen_random_uuid() owner_id, gen_random_uuid() outsider;
grant select on t_b to authenticated;
set local role authenticated;
-- A non-owner can neither export nor read the status.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select outsider from t_b),'role','authenticated')::text,true);
do $x$ declare failed boolean:=false; begin
  begin perform public.owner_backup_export(); exception when others then failed:=true; end;
  if not failed then raise exception 'FAIL a non-owner exported the data'; end if;
  failed:=false; begin perform public.owner_backup_status(); exception when others then failed:=true; end;
  if not failed then raise exception 'FAIL a non-owner read the backup status'; end if;
end $x$;
-- The owner exports every business table, without access secrets, and the export is logged.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select owner_id from t_b),'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
do $o$ declare b jsonb; s jsonb; k text; begin
  b:=public.owner_backup_export();
  if b->>'format'<>'dzoft-backup' then raise exception 'FAIL format %',b->>'format'; end if;
  foreach k in array array['clients','quotes','project_receipts','invoice_registry','invoice_sequences','dzoft_credit_notes','settings','leads'] loop
    if jsonb_typeof(b->'tables'->k)<>'array' then raise exception 'FAIL table % missing',k; end if; end loop;
  if (b->'tables') ? 'sign_codes' then raise exception 'FAIL signature codes exported'; end if;
  if exists(select 1 from jsonb_array_elements(b->'tables'->'clients') c where c ? 'portal_token') then raise exception 'FAIL portal token exported'; end if;
  if (b->'counts'->>'quotes')::int <> (select count(*) from public.quotes) then raise exception 'FAIL quote count'; end if;
  s:=public.owner_backup_status();
  if (s->>'last_backup_at') is null then raise exception 'FAIL export not logged'; end if;
  raise notice 'OK export: %', b->'counts';
end $o$;
rollback;
