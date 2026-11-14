-- Draft-only automation for the approved GitHub source, with no client publication.
-- Existing manually prepared progress_draft remains untouched.
alter table public.quotes add column if not exists progress_auto_draft jsonb;

create or replace function private.dzoft_refresh_github_progress_draft(p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 q public.quotes;
 result jsonb;
 fingerprint text;
 updates_json jsonb;
 newest date;
 previous_published_hash text;
 previous_batch text;
begin
 if p_quote is distinct from 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid then
    return jsonb_build_object('configured',false,'updates','[]'::jsonb);
 end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null then
    raise exception 'Accepted project required';
 end if;
 select md5(coalesce(string_agg(w.source_date::text||'/'||w.source_group,'|'
   order by w.source_date,w.source_group),'')),
   max(w.source_date)
 into fingerprint,newest
 from public.project_work_items w where w.quote_id=p_quote
   and w.source_group is not null and w.source_date >= (now() at time zone 'Europe/Paris')::date - 13
   and w.source_date <= (now() at time zone 'Europe/Paris')::date + 1;
 if q.progress_auto_draft->>'source_hash' = fingerprint
   and jsonb_typeof(q.progress_auto_draft->'updates')='array' then
   return q.progress_auto_draft;
 end if;
 -- Hardcoded descriptions, not raw commit subjects, AI text, names, code or diffs.
 select coalesce(jsonb_agg(
   jsonb_build_object('category',c.category,'status','working',
      'summary','Activité GitHub récente dans '||c.area||
      ' ; réalisations et tests à vérifier avant de confirmer l’avancement.')
   order by c.last_day desc,c.category),'[]'::jsonb)
 into updates_json
 from (
   select category,area,max(source_date) as last_day from (
     select w.source_date,
       case w.source_group
        when 'qr' then 'venue' when 'evenements' then 'venue'
        when 'profils' then 'accounts' when 'securite' then 'safety'
        when 'messagerie' then 'chat' when 'interface' then 'design'
        else 'other' end as category,
       case w.source_group
        when 'qr' then 'les QR codes' when 'evenements' then 'les lieux et événements'
        when 'profils' then 'les comptes et profils' when 'securite' then 'la sécurité'
        when 'messagerie' then 'la messagerie' when 'interface' then 'l’interface'
        when 'administration' then 'l’administration' when 'donnees' then 'les données'
        when 'tests' then 'les correctifs' when 'livraison' then 'les déploiements'
        when 'fonctionnalites' then 'les fonctionnalités'
        else 'la maintenance' end as area
     from public.project_work_items w where w.quote_id=p_quote
       and w.source_group is not null
       and w.source_date >= (now() at time zone 'Europe/Paris')::date - 13
       and w.source_date <= (now() at time zone 'Europe/Paris')::date + 1
   ) mapped
   group by category,area
   order by max(source_date) desc,category
   limit 6
 ) c;
 previous_published_hash:=q.progress_auto_draft->>'published_hash';
 previous_batch:=q.progress_auto_draft->>'published_batch';
 result:=jsonb_build_object(
   'configured',true,'source','github_private_categories','source_hash',fingerprint,
   'prepared',now(),'last_activity_on',newest,'updates',updates_json,
   'requires_owner_review',true,'client_notified',false,
   'published_hash',previous_published_hash,'published_batch',previous_batch);
 update public.quotes set progress_auto_draft=result where id=p_quote;
 return result;
end $fn$;

create or replace function public.owner_refresh_github_progress_draft(p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 return private.dzoft_refresh_github_progress_draft(p_quote);
end $fn$;

create or replace function private.dzoft_refresh_github_insert_trigger()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare target uuid;
begin
 for target in
   select distinct quote_id from new_github_items
   where source_group is not null
     and quote_id='c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid
 loop
   perform private.dzoft_refresh_github_progress_draft(target);
 end loop;
 return null;
end $fn$;
drop trigger if exists dzoft_progress_auto_insert on public.project_work_items;
create trigger dzoft_progress_auto_insert after insert on public.project_work_items
referencing new table as new_github_items for each statement
execute function private.dzoft_refresh_github_insert_trigger();

create or replace function public.owner_publish_github_progress_draft(
 p_quote uuid,p_batch uuid,p_hash text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; response jsonb;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 if p_hash !~ '^[0-9a-f]{32}$' or p_batch is null then raise exception 'Invalid draft identity';end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null
   or q.progress_auto_draft->>'source_hash' is distinct from p_hash then
     raise exception 'Draft has changed: refresh before publishing';
 end if;
 if q.progress_auto_draft->>'published_hash'=p_hash then
   if q.progress_auto_draft->>'published_batch'=p_batch::text then
     return private.project_tracking(p_quote);
   end if;
   raise exception 'This GitHub draft was already published';
 end if;
 response:=private.publish_project_updates(p_quote,p_batch,p_items);
 update public.quotes set progress_auto_draft=
    coalesce(progress_auto_draft,'{}'::jsonb)||
    jsonb_build_object('published_hash',p_hash,'published_batch',p_batch::text,'published_at',now())
 where id=p_quote;
 return response;
end $fn$;

revoke all on function private.dzoft_refresh_github_progress_draft(uuid),
 private.dzoft_refresh_github_insert_trigger(),
 public.owner_refresh_github_progress_draft(uuid),
 public.owner_publish_github_progress_draft(uuid,uuid,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.owner_refresh_github_progress_draft(uuid),
 public.owner_publish_github_progress_draft(uuid,uuid,text,jsonb) to authenticated;
