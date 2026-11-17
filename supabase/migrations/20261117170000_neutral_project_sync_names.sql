-- DZOFT: the background GitHub sync no longer carries a client's name in its objects (public repository).
--   private.rodney_sync_state            -> private.project_git_sync_state
--   *.verify_rodney_sync_token(text)     -> *.verify_project_sync_token(text)
--   *.background_import_rodney_groups()  -> *.background_import_project_groups()
--   *.rodney_sync_overview()             -> *.project_sync_overview()
--   Vault secret dzoft_rodney_sync_token -> dzoft_project_sync_token (same value)
--   Cron job dzoft_rodney_background_git -> dzoft_project_background_git, calling the Edge Function sync-project-github
-- Same behaviour, same rights, same data.

alter table private.rodney_sync_state rename to project_git_sync_state;
alter table private.project_git_sync_state rename constraint rodney_sync_state_pkey to project_git_sync_state_pkey;
alter table private.project_git_sync_state rename constraint rodney_sync_state_singleton_check to project_git_sync_state_singleton_check;
alter table private.project_git_sync_state rename constraint rodney_sync_state_check to project_git_sync_state_check;

select vault.update_secret(id, null, 'dzoft_project_sync_token') from vault.secrets where name='dzoft_rodney_sync_token';

create or replace function private.verify_project_sync_token(p_token text)
 returns boolean language sql security definer set search_path to '' as $function$
  select p_token is not null
   and length(p_token)=64
   and coalesce(p_token=(
     select decrypted_secret from vault.decrypted_secrets
     where name='dzoft_project_sync_token' limit 1
   ),false);
$function$;
create or replace function public.verify_project_sync_token(p_token text)
 returns boolean language sql set search_path to '' as $function$
  select private.verify_project_sync_token(p_token);
$function$;

create or replace function private.background_import_project_groups(p_items jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  quote_uuid uuid := 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid;
  n int; added int := 0;
  v jsonb; d text; dt date; grp text; title_part text; cat text; fresh uuid;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Expected safe category array';
  end if;
  n := jsonb_array_length(p_items);
  if n > 40 then raise exception 'Too many activity categories'; end if;
  if not exists (
    select 1 from public.quotes q where q.id=quote_uuid
      and q.accepted_at is not null and q.deleted_at is null
  ) then
    raise exception 'Project unavailable';
  end if;
  for v in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v) is distinct from 'object'
      or not (v ? 'date') or not (v ? 'group')
      or (select count(*) from jsonb_object_keys(v)) <> 2
      or jsonb_typeof(v->'date') is distinct from 'string'
      or jsonb_typeof(v->'group') is distinct from 'string' then
      raise exception 'Raw metadata rejected';
    end if;
    d := v->>'date'; grp := v->>'group';
    if d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date'; end if;
    dt := d::date;
    if dt < current_date-interval '21 days' or dt > current_date+1 then
      raise exception 'Date outside window';
    end if;
    title_part := case grp
      when 'administration' then 'Administration'
      when 'qr' then 'QR codes et accès aux lieux'
      when 'evenements' then 'Lieux et événements'
      when 'profils' then 'Profils et inscription'
      when 'securite' then 'Sécurité et accès'
      when 'messagerie' then 'Messages et notifications'
      when 'interface' then 'Interface et affichage'
      when 'donnees' then 'Données et configuration'
      when 'tests' then 'Tests et correctifs'
      when 'livraison' then 'Mises en ligne'
      when 'fonctionnalites' then 'Fonctionnalités'
      when 'other' then 'Développement et maintenance'
      else null end;
    if title_part is null then raise exception 'Unknown activity group'; end if;
    cat := case grp
      when 'qr' then 'venue'
      when 'evenements' then 'venue'
      when 'profils' then 'accounts'
      when 'securite' then 'safety'
      when 'messagerie' then 'chat'
      when 'interface' then 'design'
      else 'other' end;
    fresh := null;
    insert into public.project_work_items
      (quote_id,title,status,category,source_date,source_group,created_by)
    values (
      quote_uuid,'GitHub · '||title_part||' (à vérifier)',
      'review',cat,dt,grp,'00000000-0000-0000-0000-000000000001'::uuid
    )
    on conflict on constraint project_work_items_unique_source do nothing
    returning id into fresh;
    if fresh is not null then added:=added+1; end if;
  end loop;
  insert into private.project_git_sync_state
    (singleton,last_success_at,last_inserted,last_checked)
    values(true,now(),added,n)
    on conflict(singleton) do update
    set last_success_at=excluded.last_success_at,
        last_inserted=excluded.last_inserted,
        last_checked=excluded.last_checked;
  return jsonb_build_object('added',added,'checked',n,'client_notified',false);
end $function$;
create or replace function public.background_import_project_groups(p_items jsonb)
 returns jsonb language sql set search_path to '' as $function$
  select private.background_import_project_groups(p_items);
$function$;

create or replace function private.project_sync_overview()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  select jsonb_build_object(
    'last_success_at',s.last_success_at,
    'last_inserted',s.last_inserted,
    'last_checked',s.last_checked,
    'backend_enabled',exists(
      select 1 from cron.job j where j.jobname='dzoft_project_background_git'
        and j.active
    )
  ) into result
  from private.project_git_sync_state s where singleton=true;
  return coalesce(result,jsonb_build_object(
    'last_success_at',null,'last_inserted',0,'last_checked',0,'backend_enabled',false
  ));
end $function$;
create or replace function public.project_sync_overview()
 returns jsonb language sql set search_path to '' as $function$
  select private.project_sync_overview();
$function$;

-- Same rights as before: the worker (service_role) verifies and imports; only the signed-in owner reads the overview.
revoke all on function private.verify_project_sync_token(text), public.verify_project_sync_token(text),
  private.background_import_project_groups(jsonb), public.background_import_project_groups(jsonb),
  private.project_sync_overview(), public.project_sync_overview() from public, anon, authenticated, service_role;
grant execute on function private.verify_project_sync_token(text), public.verify_project_sync_token(text),
  private.background_import_project_groups(jsonb), public.background_import_project_groups(jsonb) to service_role;
grant execute on function private.project_sync_overview(), public.project_sync_overview() to authenticated;

select cron.unschedule('dzoft_rodney_background_git') where exists(select 1 from cron.job where jobname='dzoft_rodney_background_git');
select cron.schedule('dzoft_project_background_git', '17,47 * * * *', $cron$
    select net.http_post(
      url := 'https://rzghbvmszbjlqkdjzpxc.supabase.co/functions/v1/sync-project-github',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-DZOFT-Cron-Secret',
        (select decrypted_secret from vault.decrypted_secrets
         where name='dzoft_project_sync_token' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
$cron$);

drop function public.verify_rodney_sync_token(text);
drop function private.verify_rodney_sync_token(text);
drop function public.background_import_rodney_groups(jsonb);
drop function private.background_import_rodney_groups(jsonb);
drop function public.rodney_sync_overview();
drop function private.rodney_sync_overview();
