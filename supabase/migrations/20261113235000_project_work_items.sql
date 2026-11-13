-- DZOFT project review workflow. Additive: never rewrites legacy journals, receipts or email jobs.
-- GitHub-origin work items contain ONLY a safe date and a fixed category, never raw commit data.
create table if not exists public.project_work_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id),
  title text not null check (length(btrim(title)) between 3 and 160),
  status text not null default 'todo'
    check(status in ('todo','working','review','done')),
  category text not null default 'other'
    check(category in ('design','accounts','venue','chat','safety','other')),
  source_date date,
  source_group text
    check(source_group in ('administration','qr','evenements','profils','securite',
      'messagerie','interface','donnees','tests','livraison','fonctionnalites','other')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  published_batch uuid,
  constraint project_work_items_source_pair check(
    (source_date is null and source_group is null) or
    (source_date is not null and source_group is not null)
  ),
  constraint project_work_items_publication_pair check(
    (published_at is null and published_batch is null) or
    (published_at is not null and published_batch is not null)
  ),
  constraint project_work_items_unique_source unique(quote_id,source_date,source_group)
);
create index if not exists project_work_items_quote_status_idx
  on public.project_work_items (quote_id,status,created_at desc);
alter table public.project_work_items enable row level security;
revoke all on public.project_work_items from public,anon,authenticated;

create or replace function private.list_project_work_items(p_quote uuid)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; result jsonb;
begin
 if auth.uid() is null or not public.is_owner() then
   raise exception 'Owner access required';
 end if;
 select * into q from public.quotes where id=p_quote and deleted_at is null;
 if not found then raise exception 'Project unavailable'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'title',t.title,'status',t.status,'category',t.category,
  'source_date',t.source_date,'source_group',t.source_group,
  'created_at',t.created_at,'updated_at',t.updated_at,
  'published_at',t.published_at
 ) order by t.created_at desc,t.id desc),'[]'::jsonb)
 into result from public.project_work_items t where t.quote_id=p_quote;
 return result;
end $fn$;

create or replace function public.list_project_work_items(p_quote uuid)
 returns jsonb language sql security invoker set search_path='' as $fn$
 select private.list_project_work_items(p_quote);
$fn$;

create or replace function private.save_project_work_item(
 p_quote uuid,p_id uuid,p_title text,p_status text,p_category text,
 p_source_date date,p_source_group text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; item public.project_work_items; clean text:=btrim(coalesce(p_title,''));
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 if length(clean)<3 or length(clean)>160 or p_status is null
  or p_status not in ('todo','working','review','done')
  or p_category is null or p_category not in ('design','accounts','venue','chat','safety','other') then
  raise exception 'Invalid project task';
 end if;
 if (p_source_date is null)<>(p_source_group is null) then
  raise exception 'Invalid GitHub source metadata';
 end if;
 if p_source_group is not null and (
    p_quote <> 'c8a50cee-3856-4539-98a3-f5df201dbff0'::uuid or
    p_source_group not in ('administration','qr','evenements','profils','securite',
      'messagerie','interface','donnees','tests','livraison','fonctionnalites','other')
 ) then raise exception 'Unapproved GitHub source'; end if;
 select * into q from public.quotes where id=p_quote and deleted_at is null for update;
 if not found or q.accepted_at is null then raise exception 'Accepted project required'; end if;
 if p_id is null then
  insert into public.project_work_items
   (quote_id,title,status,category,source_date,source_group,created_by)
  values(p_quote,clean,p_status,p_category,p_source_date,p_source_group,auth.uid())
  on conflict on constraint project_work_items_unique_source do nothing
  returning * into item;
  if not found then
    select * into item from public.project_work_items
      where quote_id=p_quote and source_date=p_source_date and source_group=p_source_group;
  end if;
 else
  select * into item from public.project_work_items
    where id=p_id and quote_id=p_quote for update;
  if not found then raise exception 'Project task unavailable'; end if;
  if item.published_at is not null then
    raise exception 'Published project task is immutable';
  end if;
  update public.project_work_items
   set title=clean,status=p_status,category=p_category,updated_at=now()
   where id=p_id and quote_id=p_quote returning * into item;
 end if;
 return jsonb_build_object('id',item.id,'title',item.title,
  'status',item.status,'category',item.category,
  'source_date',item.source_date,'source_group',item.source_group,
  'published_at',item.published_at);
end $fn$;

create or replace function public.save_project_work_item(
 p_quote uuid,p_id uuid,p_title text,p_status text,p_category text,
 p_source_date date default null,p_source_group text default null
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.save_project_work_item(p_quote,p_id,p_title,p_status,p_category,
  p_source_date,p_source_group);
$fn$;

create or replace function private.publish_project_work_item(
 p_quote uuid,p_id uuid,p_batch uuid,p_category text,p_summary text,p_tested boolean
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; item public.project_work_items; clean text:=btrim(coalesce(p_summary,''));
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 if p_batch is null or p_category is null or
  p_category not in ('design','accounts','venue','chat','safety','other')
  or length(clean)<5 or length(clean)>220 then
  raise exception 'Invalid publication summary';
 end if;
 select * into q from public.quotes where id=p_quote and deleted_at is null for update;
 if not found or q.accepted_at is null or not q.shared then
  raise exception 'Accepted shared project required';
 end if;
 select * into item from public.project_work_items
   where id=p_id and quote_id=p_quote for update;
 if not found then raise exception 'Project task unavailable'; end if;
 if item.published_at is not null then
  if item.published_batch=p_batch then
   return jsonb_build_object('published',true,'already_published',true,'id',item.id);
  end if;
  raise exception 'Project task already published';
 end if;
 if item.status<>'done' then
  raise exception 'Mark task completed before publishing';
 end if;
 -- The owner explicitly approves a short human-written summary and its actual status.
 -- This invokes the existing audited project publication/outbox process.
 perform private.publish_project_updates(p_quote,p_batch,jsonb_build_array(
  jsonb_build_object('category',p_category,'status',
   case when coalesce(p_tested,false) then 'tested' else 'built' end,
   'summary',clean)));
 update public.project_work_items set published_at=now(),published_batch=p_batch,
   updated_at=now() where id=item.id and quote_id=p_quote;
 return jsonb_build_object('published',true,'already_published',false,'id',item.id,
  'email_queued',true);
end $fn$;

create or replace function public.publish_project_work_item(
 p_quote uuid,p_id uuid,p_batch uuid,p_category text,p_summary text,p_tested boolean
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.publish_project_work_item(p_quote,p_id,p_batch,p_category,p_summary,p_tested);
$fn$;

revoke all on function
 private.list_project_work_items(uuid),
 public.list_project_work_items(uuid),
 private.save_project_work_item(uuid,uuid,text,text,text,date,text),
 public.save_project_work_item(uuid,uuid,text,text,text,date,text),
 private.publish_project_work_item(uuid,uuid,uuid,text,text,boolean),
 public.publish_project_work_item(uuid,uuid,uuid,text,text,boolean)
 from public,anon;
grant execute on function
 private.list_project_work_items(uuid),
 public.list_project_work_items(uuid),
 private.save_project_work_item(uuid,uuid,text,text,text,date,text),
 public.save_project_work_item(uuid,uuid,text,text,text,date,text),
 private.publish_project_work_item(uuid,uuid,uuid,text,text,boolean),
 public.publish_project_work_item(uuid,uuid,uuid,text,text,boolean)
 to authenticated;
