begin;

-- The owner marker is set once in Auth app_metadata outside this migration.
-- User-editable user_metadata must never be used for authorization.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'dzoft_owner'), '') = 'true'
    and (coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
         or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'))
$function$;
revoke all on function public.is_owner() from public, anon, authenticated, service_role;
grant execute on function public.is_owner() to authenticated;

-- Linking a confirmed account revokes the secret-link capability immediately.
create or replace function public.my_client()
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare uid uuid := auth.uid(); em text; ok timestamptz; c public.clients; l public.leads;
begin
  if uid is null then raise exception 'non connecté'; end if;
  if public.is_owner() then raise exception 'compte administrateur'; end if;
  select lower(email), email_confirmed_at into em, ok from auth.users where id = uid;
  if ok is null or em is null then raise exception 'adresse non confirmée'; end if;
  select * into c from public.clients where user_id = uid;
  if not found then
    select * into c from public.clients
      where user_id is null and (lower(btrim(email)) = em or lower(btrim(contact)) = em)
      order by created_at limit 1 for update;
    if found then
      update public.clients set user_id = uid, email = case when email = '' then em else email end,
        portal_token = gen_random_uuid() where id = c.id returning * into c;
    else
      select * into l from public.leads where user_id = uid or lower(btrim(email)) = em order by created_at desc limit 1;
      insert into public.clients (nom, entreprise, contact, email, user_id)
        values (coalesce(nullif(btrim(l.prenom), ''), split_part(em, '@', 1)), coalesce(l.activite, ''),
                coalesce(nullif(btrim(l.contact), ''), em), em, uid)
        returning * into c;
    end if;
  end if;
  update public.leads set user_id = uid, client_id = c.id
    where client_id is null and (user_id = uid or lower(btrim(email)) = em);
  return c.id;
end
$function$;
revoke all on function public.my_client() from public, anon, authenticated, service_role;

-- Defense in depth: a secret link is valid only while the client is unlinked.
create or replace function public.portal_get(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = 'public', 'pg_temp'
as $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then return null; end if;
  return public.portal_data(cid);
end
$function$;

create or replace function public.portal_message(p_token uuid, p_quote uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp'
as $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_message(cid, p_quote, p_body);
end
$function$;

create or replace function public.portal_validate(p_token uuid, p_quote uuid, p_step text, p_name text)
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp'
as $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_validate(cid, p_quote, p_step, p_name);
end
$function$;

create or replace function public.portal_accept(p_token uuid, p_quote uuid, p_name text, p_terms text default null, p_early boolean default false)
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp'
as $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_accept(cid, p_quote, p_name, p_terms, p_early);
end
$function$;

create or replace function public.portal_accept_signed(p_token uuid, p_quote uuid, p_name text, p_terms text, p_early boolean, p_code text)
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp'
as $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_accept_signed(cid, p_quote, p_name, p_terms, p_early, p_code);
end
$function$;

create or replace function public.portal_review(p_token uuid, p_quote uuid, p_rating integer, p_body text, p_name text, p_activity text, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = 'public', 'pg_temp'
as $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token and user_id is null;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_review(cid, p_quote, p_rating, p_body, p_name, p_activity, p_consent);
end
$function$;

-- A quote-row lock makes quota checks and reservation one atomic operation.
create or replace function public.reserve_sign_code(
  p_quote_id uuid, p_client_id uuid, p_salt text, p_code_hash text, p_target text, p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_quote_id uuid; v_recent integer; v_daily integer; v_code_id uuid;
begin
  select q.id into v_quote_id from public.quotes q
    where q.id = p_quote_id and q.client_id = p_client_id and q.shared
      and q.deleted_at is null and q.accepted_at is null
    for update;
  if v_quote_id is null then return jsonb_build_object('ok', false, 'reason', 'quote'); end if;

  select count(*) into v_recent from public.sign_codes
    where quote_id = p_quote_id and created_at >= now() - interval '15 minutes';
  select count(*) into v_daily from public.sign_codes
    where quote_id = p_quote_id and created_at >= now() - interval '24 hours';
  if v_recent >= 3 or v_daily >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limit');
  end if;

  insert into public.sign_codes (quote_id, client_id, channel, target, salt, code_hash, expires_at)
    values (p_quote_id, p_client_id, 'email', p_target, p_salt, p_code_hash, p_expires_at)
    returning id into v_code_id;
  return jsonb_build_object('ok', true, 'id', v_code_id);
end
$function$;
revoke all on function public.reserve_sign_code(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.reserve_sign_code(uuid, uuid, text, text, text, timestamptz) to service_role;

create or replace function public.cancel_sign_code_reservation(p_sign_code_id uuid)
returns void
language sql
security definer
set search_path = ''
as $function$
  delete from public.sign_codes where id = p_sign_code_id and used_at is null;
$function$;
revoke all on function public.cancel_sign_code_reservation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_sign_code_reservation(uuid) to service_role;

commit;

