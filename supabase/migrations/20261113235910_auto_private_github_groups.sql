-- Automatic, private GitHub category intake (owner-only).
-- ONLY pre-approved date+category may be submitted; never code/commit/AI metadata.
-- Does not publish tasks, change milestones, or queue emails.
create or replace function private.sync_project_github_groups(
  p_quote uuid,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v jsonb;
  d_text text;
  d date;
  g text;
  label text;
  work_category text;
  created uuid;
  n int;
  added int := 0;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  if p_quote is distinct from 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid then
    raise exception 'Unapproved project source';
  end if;
  if not exists (
    select 1 from public.quotes q
    where q.id = p_quote and q.deleted_at is null and q.accepted_at is not null
  ) then
    raise exception 'Accepted project required';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Expected categories array';
  end if;
  n := jsonb_array_length(p_items);
  if n > 40 then
    raise exception 'Too many categories per sync';
  end if;

  for v in select value from jsonb_array_elements(p_items) loop
    -- Fail closed: objects must contain EXACTLY date and group; no extra
    -- author, raw message, code, model, session or untrusted metadata fields.
    if jsonb_typeof(v) is distinct from 'object'
      or not (v ? 'date') or not (v ? 'group')
      or (select count(*) from jsonb_object_keys(v)) <> 2
      or jsonb_typeof(v->'date') is distinct from 'string'
      or jsonb_typeof(v->'group') is distinct from 'string' then
      raise exception 'Forbidden GitHub metadata';
    end if;
    d_text := v->>'date';
    g := v->>'group';
    if d_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid activity date';
    end if;
    d := d_text::date;
    if d < current_date-interval '21 days' or d > current_date+1 then
      raise exception 'Activity outside recent window';
    end if;
    label := case g
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
    if label is null then
      raise exception 'Unapproved activity category';
    end if;
    work_category := case g
      when 'qr' then 'venue'
      when 'evenements' then 'venue'
      when 'profils' then 'accounts'
      when 'securite' then 'safety'
      when 'messagerie' then 'chat'
      when 'interface' then 'design'
      else 'other' end;

    created := null;
    insert into public.project_work_items
       (quote_id,title,status,category,source_date,source_group,created_by)
    values (p_quote,'GitHub · '||label||' (à vérifier)',
            'review',work_category,d,g,auth.uid())
    on conflict on constraint project_work_items_unique_source do nothing
    returning id into created;
    if created is not null then added := added + 1; end if;
  end loop;
  return jsonb_build_object(
    'added',added,'checked',n,'visibility','private',
    'status','review','client_notified',false
  );
end
$fn$;

create or replace function public.sync_project_github_groups(
  p_quote uuid,p_items jsonb
) returns jsonb language sql security invoker set search_path='' as $fn$
  select private.sync_project_github_groups(p_quote,p_items);
$fn$;

revoke all on function
  private.sync_project_github_groups(uuid,jsonb),
  public.sync_project_github_groups(uuid,jsonb)
  from public,anon;
grant execute on function
  private.sync_project_github_groups(uuid,jsonb),
  public.sync_project_github_groups(uuid,jsonb)
  to authenticated;
