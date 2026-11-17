-- Client area, 17 Nov 2026.
-- 1) The client's interface language (fr | en) is kept on the client record so that e-mails sent
--    later by the server (project events, payment reminders) use it. Set by the client only.
-- 2) Clients using their private link (no account) can read their own payment figures and
--    published updates, through the same calculation as signed-in clients.

alter table public.clients add column if not exists lang text not null default 'fr';
do $do$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_lang_check') then
    alter table public.clients add constraint clients_lang_check check (lang in ('fr', 'en'));
  end if;
end $do$;

-- Signed-in client: saves the language of their own record.
create or replace function public.my_set_language(p_lang text) returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $fn$
declare cid uuid := public.my_client();
begin
  if p_lang is null or p_lang not in ('fr', 'en') then raise exception 'langue invalide'; end if;
  update public.clients set lang = p_lang where id = cid and lang is distinct from p_lang;
end $fn$;
revoke all on function public.my_set_language(text) from public, anon;
grant execute on function public.my_set_language(text) to authenticated;

-- Private link: only for a client without an account (same rule as the other portal_* functions).
create or replace function public.portal_set_language(p_token uuid, p_lang text) returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $fn$
declare cid uuid;
begin
  if p_lang is null or p_lang not in ('fr', 'en') then raise exception 'langue invalide'; end if;
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then raise exception 'lien invalide'; end if;
  update public.clients set lang = p_lang where id = cid and lang is distinct from p_lang;
end $fn$;
revoke all on function public.portal_set_language(uuid, text) from public;
grant execute on function public.portal_set_language(uuid, text) to anon, authenticated;

-- The client's data now carries their saved language.
create or replace function public.my_space() returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $fn$
declare cid uuid := public.my_client(); r jsonb;
begin
  r := public.portal_data(cid);
  return r || jsonb_build_object('email', (select email from auth.users where id = auth.uid()),
                                 'lang', (select lang from public.clients where id = cid));
end $fn$;

create or replace function public.portal_get(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $fn$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then return null; end if;
  return public.portal_data(cid) || jsonb_build_object('lang', (select lang from public.clients where id = cid));
end $fn$;

-- private.project_tracking also accepts a project of the client checked by portal_project_tracking
-- (transaction-local marker, never readable or writable by API callers).
do $do$ declare d text; old text; new text; begin
  d := pg_get_functiondef('private.project_tracking(uuid)'::regprocedure);
  old := $o$ if not found or auth.uid() is null or not (public.is_owner() or$o$;
  new := $n$ if not found or not ((auth.uid() is not null and (public.is_owner() or$n$;
  if position(old in d) = 0 then raise exception 'Unexpected project_tracking definition'; end if;
  d := replace(d, old, new);
  old := $o$c.id=q.client_id and c.user_id=auth.uid())))$o$;
  new := $n$c.id=q.client_id and c.user_id=auth.uid()))))
   or (q.shared and q.accepted_at is not null
       and coalesce(current_setting('dzoft.portal_client', true), '') = q.client_id::text))$n$;
  if position(old in d) = 0 then raise exception 'Unexpected project_tracking access rule'; end if;
  d := replace(d, old, new);
  execute d;
end $do$;

create or replace function public.portal_project_tracking(p_token uuid, p_quote uuid) returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $fn$
declare cid uuid; r jsonb;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then raise exception 'lien invalide'; end if;
  perform set_config('dzoft.portal_client', cid::text, true);
  r := private.project_tracking(p_quote);
  perform set_config('dzoft.portal_client', '', true);
  return r;
end $fn$;
revoke all on function public.portal_project_tracking(uuid, uuid) from public;
grant execute on function public.portal_project_tracking(uuid, uuid) to anon, authenticated;
