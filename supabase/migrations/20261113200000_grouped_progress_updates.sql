-- Several client summaries published together = one portal refresh and ONE email (client + owner copy).
-- Rows of the same publication share batch_id; the email worker lists them from the event key "digest:<batch_id>".
alter table public.project_updates add column if not exists batch_id uuid;
update public.project_updates set batch_id = id where batch_id is null;
alter table public.project_updates alter column batch_id set not null;
create index if not exists project_updates_batch_idx on public.project_updates(batch_id);

create or replace function private.publish_project_updates(p_quote uuid, p_batch uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; it jsonb; n integer; existing integer; cat text; st text; sm text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or not q.shared or q.accepted_at is null then raise exception 'Accepted shared project required'; end if;
 if p_batch is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid publication'; end if;
 n := jsonb_array_length(p_items);
 if n<1 or n>6 then raise exception 'Publish between 1 and 6 summaries'; end if;
 -- Same publication sent twice (double click, retry): return the current state, never a second email.
 select count(*) into existing from public.project_updates where batch_id=p_batch;
 if existing>0 then
  if existing<>n or exists(select 1 from public.project_updates where batch_id=p_batch and quote_id<>p_quote) then raise exception 'Publication key already used'; end if;
  return private.project_tracking(p_quote);
 end if;
 for it in select value from jsonb_array_elements(p_items) loop
  cat := it->>'category'; st := it->>'status'; sm := btrim(coalesce(it->>'summary',''));
  if cat is null or cat not in ('design','accounts','venue','chat','safety','other')
  or st is null or st not in ('planned','working','built','tested')
  or length(sm)<1 or length(sm)>220 then raise exception 'Invalid summary'; end if;
  insert into public.project_updates(id,quote_id,category,status,summary,created_at,created_by,batch_id)
  values(gen_random_uuid(),p_quote,cat,st,sm,now(),auth.uid(),p_batch);
 end loop;
 perform private.queue_project_event('digest:'||p_batch,'progress_digest',
  'Avancement publié : '||n||case when n>1 then ' résumés' else ' résumé' end,
  q.client_id,q.id,p_notify_client=>true,p_notify_owner=>true);
 return private.project_tracking(p_quote);
end $fn$;
create or replace function public.publish_project_updates(p_quote uuid, p_batch uuid, p_items jsonb) returns jsonb
language sql security invoker set search_path='' as $fn$ select private.publish_project_updates(p_quote,p_batch,p_items); $fn$;
revoke all on function private.publish_project_updates(uuid,uuid,jsonb), public.publish_project_updates(uuid,uuid,jsonb) from public,anon;
grant execute on function private.publish_project_updates(uuid,uuid,jsonb), public.publish_project_updates(uuid,uuid,jsonb) to authenticated;

-- The single-summary action stays available and becomes a batch of one.
create or replace function private.publish_project_update(p_quote uuid,p_id uuid,p_category text,p_status text,p_summary text) returns jsonb
language plpgsql security definer set search_path='' as $fn$
begin
 return private.publish_project_updates(p_quote, p_id,
  jsonb_build_array(jsonb_build_object('category',p_category,'status',p_status,'summary',p_summary)));
end $fn$;
