-- Synthetic, transactional check of the owner backup (run after migrations 20261118160000 and 20261118170000).
-- Nothing persists after rollback.
begin;
create temp table t_b as select gen_random_uuid() owner_id, gen_random_uuid() outsider;
grant select on t_b to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select outsider from t_b),'role','authenticated')::text,true);
do $x$ declare failed boolean:=false; begin
  begin perform public.owner_backup_export(); exception when others then failed:=true; end;
  if not failed then raise exception 'FAIL a non-owner exported the data'; end if;
  failed:=false; begin perform public.owner_backup_confirm('{}'::jsonb); exception when others then failed:=true; end;
  if not failed then raise exception 'FAIL a non-owner confirmed a backup'; end if;
end $x$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select owner_id from t_b),'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
do $o$ declare b jsonb; before timestamptz; k text; at timestamptz; begin
  before:=(public.owner_backup_status()->>'last_backup_at')::timestamptz;
  b:=public.owner_backup_export();
  if b->>'format'<>'dzoft-backup' then raise exception 'FAIL format'; end if;
  foreach k in array array['clients','quotes','project_receipts','invoice_registry','invoice_sequences','credit_note_sequences','dzoft_credit_notes','settings','leads','email_outbox'] loop
    if jsonb_typeof(b->'tables'->k)<>'array' then raise exception 'FAIL table % missing',k; end if; end loop;
  if (b->'tables') ? 'sign_codes' then raise exception 'FAIL signature codes exported'; end if;
  if exists(select 1 from jsonb_array_elements(b->'tables'->'clients') c where c ? 'portal_token') then raise exception 'FAIL portal token exported'; end if;
  if (b->'counts'->>'invoice_registry')::int<>3 or (b->'counts') ? 'invoice_sequences' then raise exception 'FAIL counts %',b->'counts'; end if;
  -- Export alone records nothing; only the confirmation does.
  if (public.owner_backup_status()->>'last_backup_at')::timestamptz is distinct from before then raise exception 'FAIL export logged a backup'; end if;
  at:=public.owner_backup_confirm(b->'counts');
  if (public.owner_backup_status()->>'last_backup_at')::timestamptz is distinct from at then raise exception 'FAIL confirm not logged'; end if;
end $o$;
rollback;
