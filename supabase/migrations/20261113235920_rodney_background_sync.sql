-- DZOFT Rodney background GitHub sync: guarded service-to-service ingestion.
-- No raw commit messages, code, AI metadata, or third-party data are stored.
-- No client notifications, no published project updates, no financial mutation.
create table if not exists private.rodney_sync_state (
  singleton boolean primary key default true check (singleton),
  last_success_at timestamptz,
  last_inserted int not null default 0,
  last_checked int not null default 0,
  check (last_inserted >= 0 and last_checked >= 0)
);
revoke all on private.rodney_sync_state from public,anon,authenticated;

do $init$
begin
  if not exists (
    select 1 from vault.secrets where name='dzoft_rodney_sync_token'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32),'hex'),
      'dzoft_rodney_sync_token',
      'Cron-to-Edge private DZOFT GitHub sync; no client/API permissions'
    );
  end if;
end
$init$;

create or replace function private.verify_rodney_sync_token(p_token text)
returns boolean language sql security definer
set search_path='' as $fn$
  select p_token is not null
   and length(p_token)=64
   and coalesce(p_token=(
     select decrypted_secret from vault.decrypted_secrets
     where name='dzoft_rodney_sync_token' limit 1
   ),false);
$fn$;
create or replace function public.verify_rodney_sync_token(p_token text)
returns boolean language sql security invoker
set search_path='' as $fn$
  select private.verify_rodney_sync_token(p_token);
$fn$;

create or replace function private.background_import_rodney_groups(p_items jsonb)
returns jsonb language plpgsql security definer
set search_path='' as $fn$
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
  insert into private.rodney_sync_state
    (singleton,last_success_at,last_inserted,last_checked)
    values(true,now(),added,n)
    on conflict(singleton) do update
    set last_success_at=excluded.last_success_at,
        last_inserted=excluded.last_inserted,
        last_checked=excluded.last_checked;
  return jsonb_build_object('added',added,'checked',n,'client_notified',false);
end $fn$;

create or replace function public.background_import_rodney_groups(p_items jsonb)
returns jsonb language sql security invoker
set search_path='' as $fn$
  select private.background_import_rodney_groups(p_items);
$fn$;

create or replace function private.rodney_sync_overview()
returns jsonb language plpgsql security definer
set search_path='' as $fn$
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
      select 1 from cron.job j where j.jobname='dzoft_rodney_background_git'
        and j.active
    )
  ) into result
  from private.rodney_sync_state s where singleton=true;
  return coalesce(result,jsonb_build_object(
    'last_success_at',null,'last_inserted',0,'last_checked',0,'backend_enabled',false
  ));
end $fn$;
create or replace function public.rodney_sync_overview()
returns jsonb language sql security invoker
set search_path='' as $fn$
  select private.rodney_sync_overview();
$fn$;

revoke all on function
  private.verify_rodney_sync_token(text),
  public.verify_rodney_sync_token(text),
  private.background_import_rodney_groups(jsonb),
  public.background_import_rodney_groups(jsonb),
  private.rodney_sync_overview(),
  public.rodney_sync_overview()
  from public,anon,authenticated;
grant execute on function
  private.verify_rodney_sync_token(text),
  public.verify_rodney_sync_token(text),
  private.background_import_rodney_groups(jsonb),
  public.background_import_rodney_groups(jsonb)
  to service_role;
grant execute on function
  private.rodney_sync_overview(),
  public.rodney_sync_overview()
  to authenticated;
