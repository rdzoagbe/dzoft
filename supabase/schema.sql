-- ============================================================================
-- DZOFT · copie de référence du schéma Supabase (projet rzghbvmszbjlqkdjzpxc)
-- Générée le 2026-10-28 depuis la base réelle (lecture seule).
--
-- Ce fichier documente l'état de la base : tables, index, RLS, fonctions,
-- stockage et droits. Ce n'est PAS un script d'installation à exécuter tel
-- quel (ordre des objets et références au schéma auth non garantis).
-- À régénérer après toute modification de la base.
-- ============================================================================

-- ---------------------------------------------------------------- tables

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nom           text not null default '',
  entreprise    text not null default '',
  adresse       text not null default '',
  contact       text not null default '',
  notes         text not null default '',
  portal_token  uuid not null default gen_random_uuid() unique,
  user_id       uuid references auth.users (id) on delete set null,
  email         text not null default ''
);
create unique index clients_user_id_key on public.clients (user_id) where user_id is not null;

create table public.leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prenom     text not null check (char_length(prenom) between 1 and 100),
  activite   text not null default '' check (char_length(activite) <= 200),
  projet     text not null default '' check (char_length(projet) <= 100),
  budget     text not null default '' check (char_length(budget) <= 100),
  contact    text not null default '' check (char_length(contact) <= 200),
  elements   text not null default '' check (char_length(elements) <= 500),
  message    text not null default '' check (char_length(message) <= 5000),
  source     text not null default 'site' check (char_length(source) <= 30),
  status     text not null default 'nouvelle' check (status in ('nouvelle', 'traitée', 'archivée')),
  client_id  uuid references public.clients (id) on delete set null,
  email      text not null default '',
  user_id    uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
create index leads_client_id_idx  on public.leads (client_id);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_email_idx      on public.leads (lower(email));

create table public.quotes (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  numero               text not null default '',
  status               text not null default 'brouillon' check (status in ('brouillon', 'envoyé', 'accepté', 'refusé')),
  client_id            uuid references public.clients (id) on delete set null,
  lead_id              uuid references public.leads (id) on delete set null,
  total                numeric not null default 0,
  data                 jsonb not null default '{}',
  shared               boolean not null default false,
  sent_at              timestamptz,
  accepted_at          timestamptz,
  accepted_name        text,
  accepted_ip          text,
  accepted_data        jsonb,
  accepted_total       numeric,
  accepted_terms       text,
  accepted_early_start boolean,
  accepted_method      text,
  accepted_target      text,
  client_note          text not null default '',
  steps                jsonb not null default '[]',
  docs                 jsonb not null default '[]',
  env                  jsonb not null default '[]',
  invoices             jsonb not null default '[]',
  care                 jsonb,
  ext_link             text not null default '' check (ext_link = '' or ext_link ~* '^https://'),
  deleted_at           timestamptz
);
create index quotes_client_id_idx on public.quotes (client_id);
create index quotes_lead_id_idx   on public.quotes (lead_id);
create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  quote_id   uuid references public.quotes (id) on delete set null,
  author     text not null check (author in ('client', 'moi')),
  body       text not null check (char_length(body) between 1 and 2000),
  read_at    timestamptz
);
create index messages_client_idx on public.messages (client_id, created_at);
create index messages_quote_idx  on public.messages (quote_id);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id  uuid references public.clients (id) on delete cascade,
  quote_id   uuid references public.quotes (id) on delete set null,
  kind       text not null,
  ref        text not null default '',
  recipient  text not null default '',
  ok         boolean not null default true,
  error      text
);
create index notifications_lookup on public.notifications (client_id, kind, ref, created_at desc);

create table public.sign_codes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  quote_id   uuid not null references public.quotes (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  channel    text not null check (channel in ('sms', 'email')),
  target     text not null,
  salt       text not null,
  code_hash  text not null,           -- sha256(salt || code) : jamais le code en clair
  expires_at timestamptz not null,    -- 10 minutes après la création
  attempts   integer not null default 0,
  used_at    timestamptz
);
create index sign_codes_quote_idx on public.sign_codes (quote_id, created_at desc);

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  quote_id     uuid not null unique references public.quotes (id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  body         text not null check (char_length(body) between 10 and 1500),
  name         text not null check (char_length(name) between 2 and 60),
  activity     text not null default '' check (char_length(activity) <= 80),
  consent      boolean not null default false,
  published    boolean not null default false,
  published_at timestamptz,
  reply        text not null default '' check (char_length(reply) <= 1000)
);

create table public.settings (
  id         integer primary key default 1 check (id = 1),
  payment    jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
-- RLS activée sur toutes les tables. Les grants Supabase par défaut existent
-- (anon/authenticated ont les privilèges de table, sauf reviews : aucun grant
-- pour anon), mais la RLS est la vraie frontière : sans policy, aucune ligne
-- ne passe. Les clients n'accèdent aux données qu'à travers les fonctions
-- SECURITY DEFINER ci-dessous.

alter table public.clients       enable row level security;
alter table public.leads         enable row level security;
alter table public.quotes        enable row level security;
alter table public.messages      enable row level security;
alter table public.notifications enable row level security;
alter table public.sign_codes    enable row level security;  -- aucune policy : table invisible via l'API
alter table public.reviews       enable row level security;
alter table public.settings      enable row level security;

create policy "owner manages clients" on public.clients for all to authenticated
  using ((select is_owner())) with check ((select is_owner()));

create policy "anyone can submit a new lead" on public.leads for insert to anon, authenticated
  with check (status = 'nouvelle' and client_id is null and (user_id is null or user_id = (select auth.uid())));
create policy "owner reads leads"   on public.leads for select to authenticated using ((select is_owner()));
create policy "owner updates leads" on public.leads for update to authenticated
  using ((select is_owner())) with check ((select is_owner()));
create policy "owner deletes leads" on public.leads for delete to authenticated using ((select is_owner()));

create policy "owner manages quotes" on public.quotes for all to authenticated
  using ((select is_owner())) with check ((select is_owner()));

create policy "owner manages messages" on public.messages for all to authenticated
  using ((select is_owner())) with check ((select is_owner()));

create policy "owner reads notifications" on public.notifications for select to authenticated
  using ((select is_owner()));

create policy "owner manages reviews" on public.reviews for all to authenticated
  using ((select is_owner())) with check ((select is_owner()));

create policy "owner manages settings" on public.settings for all to authenticated
  using ((select is_owner())) with check ((select is_owner()));

-- ---------------------------------------------------------------- stockage
-- Bucket privé « client-files ». Chemins : u/<user_id>/… Les fichiers
-- s'ouvrent par liens temporaires signés, jamais publics.

-- select id, public from storage.buckets → client-files, public = false

create policy "client files: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-files' and (storage.foldername(name))[1] = 'u'
    and ((storage.foldername(name))[2] = (select (auth.uid())::text) or (select is_owner())));
create policy "client files: read own" on storage.objects for select to authenticated
  using (bucket_id = 'client-files'
    and ((storage.foldername(name))[2] = (select (auth.uid())::text) or (select is_owner())));
create policy "client files: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'client-files'
    and ((storage.foldername(name))[2] = (select (auth.uid())::text) or (select is_owner())));

-- ---------------------------------------------------------------- droits d'exécution
-- Par défaut, EXECUTE est retiré à anon et authenticated sur toutes les
-- fonctions, puis rendu au cas par cas :
--   anon + authenticated : is_owner, public_reviews, portal_get,
--     portal_message, portal_validate, portal_review, portal_accept_signed
--   authenticated seulement : my_space, my_message, my_validate, my_review,
--     my_accept_signed
--   personne via l'API : client_* (internes), my_client, portal_data,
--     my_accept, portal_accept → l'acceptation SANS code n'est accessible à
--     personne : la signature par code e-mail est obligatoire.

-- ---------------------------------------------------------------- fonctions

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- L'admin = e-mail propriétaire, avec double authentification (aal2) dès
-- qu'un facteur MFA vérifié existe sur le compte.
CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((select auth.jwt() ->> 'email'), '') = 'roland.dzoagbe@hotmail.com'
    and (coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
         or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'))
$function$;

CREATE OR REPLACE FUNCTION public.my_client()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      update public.clients set user_id = uid, email = case when email = '' then em else email end where id = c.id;
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
end $function$;

CREATE OR REPLACE FUNCTION public.portal_data(p_client uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare c public.clients; has_accepted boolean;
begin
  select * into c from public.clients where id = p_client;
  if not found then return null; end if;
  select exists(select 1 from public.quotes where client_id = c.id and shared and deleted_at is null and accepted_at is not null) into has_accepted;
  return jsonb_build_object(
    'client', jsonb_build_object('nom', c.nom, 'entreprise', c.entreprise, 'phone', case when c.contact ~ '^[+0-9 .()-]{8,}$' then c.contact else '' end),
    'payment', case when has_accepted then (select payment from public.settings where id = 1) else null end,
    'quotes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'numero', q.numero, 'status', q.status, 'sent_at', q.sent_at, 'created_at', q.created_at,
        'accepted_at', q.accepted_at, 'accepted_name', q.accepted_name, 'accepted_terms', q.accepted_terms,
        'accepted_early_start', q.accepted_early_start, 'accepted_method', q.accepted_method, 'accepted_target', q.accepted_target,
        'data', coalesce(q.accepted_data, q.data) - 'lead', 'total', coalesce(q.accepted_total, q.total),
        'note', q.client_note, 'steps', q.steps, 'docs', q.docs, 'env', q.env, 'invoices', q.invoices,
        'ext_link', q.ext_link,
        'care', case when q.accepted_at is not null then q.care end,
        'review', (select jsonb_build_object('rating', r.rating, 'body', r.body, 'name', r.name, 'activity', r.activity,
                     'consent', r.consent, 'published', r.published, 'at', r.updated_at, 'reply', r.reply)
                   from public.reviews r where r.quote_id = q.id)) order by q.created_at desc)
      from public.quotes q where q.client_id = c.id and q.shared and q.deleted_at is null), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'at', l.created_at, 'projet', l.projet, 'budget', l.budget, 'message', l.message, 'status', l.status) order by l.created_at desc)
      from public.leads l where l.client_id = c.id and l.status <> 'archivée' and l.deleted_at is null), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'at', m.created_at, 'author', m.author, 'body', m.body, 'quote_id', m.quote_id) order by m.created_at)
      from public.messages m where m.client_id = c.id), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.my_space()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid := public.my_client(); r jsonb;
begin
  r := public.portal_data(cid);
  return r || jsonb_build_object('email', (select email from auth.users where id = auth.uid()));
end $function$;

CREATE OR REPLACE FUNCTION public.portal_get(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token;
  if cid is null then return null; end if;
  return public.portal_data(cid);
end $function$;

CREATE OR REPLACE FUNCTION public.client_message(p_client uuid, p_quote uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare qid uuid;
begin
  p_body := btrim(coalesce(p_body, ''));
  if char_length(p_body) < 1 or char_length(p_body) > 2000 then raise exception 'message vide ou trop long'; end if;
  if (select count(*) from public.messages where client_id = p_client and author = 'client' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'trop de messages, réessayez plus tard';
  end if;
  select id into qid from public.quotes where id = p_quote and client_id = p_client and shared;
  insert into public.messages (client_id, quote_id, author, body) values (p_client, qid, 'client', p_body);
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.my_message(p_quote uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_message(public.my_client(), p_quote, p_body);
end $function$;

CREATE OR REPLACE FUNCTION public.portal_message(p_token uuid, p_quote uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_message(cid, p_quote, p_body);
end $function$;

CREATE OR REPLACE FUNCTION public.client_validate(p_client uuid, p_quote uuid, p_step text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare q public.quotes;
begin
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) < 2 or char_length(p_name) > 120 then raise exception 'nom invalide'; end if;
  select * into q from public.quotes where id = p_quote and client_id = p_client and shared and deleted_at is null and accepted_at is not null for update;
  if not found then raise exception 'projet introuvable'; end if;
  if not exists (select 1 from jsonb_array_elements(q.steps) s
                 where s ->> 'k' = p_step and coalesce((s ->> 'ask')::boolean, false) and not coalesce((s ->> 'done')::boolean, false)) then
    raise exception 'étape non disponible';
  end if;
  update public.quotes set steps = (
    select jsonb_agg(case when t.s ->> 'k' = p_step
      then t.s || jsonb_build_object('done', true, 'ask', false, 'd', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'), 'vby', p_name, 'vat', now())
      else t.s end order by t.ord)
    from jsonb_array_elements(q.steps) with ordinality as t(s, ord))
  where id = q.id;
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.my_validate(p_quote uuid, p_step text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_validate(public.my_client(), p_quote, p_step, p_name);
end $function$;

CREATE OR REPLACE FUNCTION public.portal_validate(p_token uuid, p_quote uuid, p_step text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_validate(cid, p_quote, p_step, p_name);
end $function$;

CREATE OR REPLACE FUNCTION public.client_accept(p_client uuid, p_quote uuid, p_name text, p_terms text, p_early boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare q public.quotes; v text; ip text;
begin
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) < 2 or char_length(p_name) > 120 then raise exception 'nom invalide'; end if;
  if coalesce(btrim(p_terms), '') = '' or char_length(p_terms) > 40 then raise exception 'conditions générales non acceptées'; end if;
  select * into q from public.quotes where id = p_quote and client_id = p_client and shared and deleted_at is null for update;
  if not found then raise exception 'devis introuvable'; end if;
  if q.accepted_at is not null then raise exception 'devis déjà accepté'; end if;
  v := q.data -> 'f' ->> 'valid';
  if v ~ '^\d{4}-\d{2}-\d{2}$' and v::date < current_date then raise exception 'devis expiré'; end if;
  begin
    ip := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
  exception when others then ip := null;
  end;
  update public.quotes set
    accepted_at = now(), accepted_name = p_name, accepted_ip = nullif(ip, ''),
    accepted_terms = btrim(p_terms), accepted_early_start = coalesce(p_early, false),
    accepted_data = data, accepted_total = total, status = 'accepté',
    steps = coalesce((select jsonb_agg(case when s ->> 'k' = 'accept'
                        then s || jsonb_build_object('done', true, 'd', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'))
                        else s end)
                      from jsonb_array_elements(steps) s), '[]'::jsonb)
  where id = q.id;
  return jsonb_build_object('ok', true, 'accepted_at', now());
end $function$;

CREATE OR REPLACE FUNCTION public.client_accept_signed(p_client uuid, p_quote uuid, p_name text, p_terms text, p_early boolean, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare sc public.sign_codes; r jsonb;
begin
  select * into sc from public.sign_codes
   where quote_id = p_quote and client_id = p_client and used_at is null
   order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'demandez d’abord votre code'); end if;
  if sc.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'code expiré : demandez-en un nouveau'); end if;
  if sc.attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'trop d’essais : demandez un nouveau code'); end if;
  if encode(digest(sc.salt || btrim(coalesce(p_code, '')), 'sha256'), 'hex') <> sc.code_hash then
    update public.sign_codes set attempts = attempts + 1 where id = sc.id;
    return jsonb_build_object('ok', false, 'error', 'code incorrect');
  end if;
  r := public.client_accept(p_client, p_quote, p_name, p_terms, p_early);
  update public.sign_codes set used_at = now() where id = sc.id;
  update public.quotes set accepted_method = sc.channel, accepted_target = sc.target where id = p_quote;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.my_accept(p_quote uuid, p_name text, p_terms text DEFAULT NULL::text, p_early boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_accept(public.my_client(), p_quote, p_name, p_terms, p_early);
end $function$;

CREATE OR REPLACE FUNCTION public.my_accept_signed(p_quote uuid, p_name text, p_terms text, p_early boolean, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_accept_signed(public.my_client(), p_quote, p_name, p_terms, p_early, p_code);
end $function$;

CREATE OR REPLACE FUNCTION public.portal_accept(p_token uuid, p_quote uuid, p_name text, p_terms text DEFAULT NULL::text, p_early boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_accept(cid, p_quote, p_name, p_terms, p_early);
end $function$;

CREATE OR REPLACE FUNCTION public.portal_accept_signed(p_token uuid, p_quote uuid, p_name text, p_terms text, p_early boolean, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_accept_signed(cid, p_quote, p_name, p_terms, p_early, p_code);
end $function$;

CREATE OR REPLACE FUNCTION public.client_review(p_client uuid, p_quote uuid, p_rating integer, p_body text, p_name text, p_activity text, p_consent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare q public.quotes;
begin
  p_body := btrim(coalesce(p_body, '')); p_name := btrim(coalesce(p_name, '')); p_activity := btrim(coalesce(p_activity, ''));
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'note invalide'; end if;
  if char_length(p_body) < 10 or char_length(p_body) > 1500 then raise exception 'avis trop court ou trop long'; end if;
  if char_length(p_name) < 2 or char_length(p_name) > 60 then raise exception 'nom invalide'; end if;
  if char_length(p_activity) > 80 then raise exception 'activité trop longue'; end if;
  select * into q from public.quotes where id = p_quote and client_id = p_client and shared and deleted_at is null and accepted_at is not null;
  if not found then raise exception 'projet introuvable'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(q.steps, '[]'::jsonb)) s
                 where s ->> 'k' = 'live' and coalesce((s ->> 'done')::boolean, false)) then
    raise exception 'avis possible après la mise en ligne';
  end if;
  insert into public.reviews (client_id, quote_id, rating, body, name, activity, consent)
    values (p_client, p_quote, p_rating, p_body, p_name, p_activity, coalesce(p_consent, false))
  on conflict (quote_id) do update set rating = excluded.rating, body = excluded.body, name = excluded.name,
    activity = excluded.activity, consent = excluded.consent, updated_at = now(), published = false, published_at = null;
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.my_review(p_quote uuid, p_rating integer, p_body text, p_name text, p_activity text, p_consent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_review(public.my_client(), p_quote, p_rating, p_body, p_name, p_activity, p_consent);
end $function$;

CREATE OR REPLACE FUNCTION public.portal_review(p_token uuid, p_quote uuid, p_rating integer, p_body text, p_name text, p_activity text, p_consent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid;
begin
  select id into cid from public.clients where portal_token = p_token;
  if cid is null then raise exception 'lien invalide'; end if;
  return public.client_review(cid, p_quote, p_rating, p_body, p_name, p_activity, p_consent);
end $function$;

CREATE OR REPLACE FUNCTION public.public_reviews()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'activity', r.activity, 'rating', r.rating, 'body', r.body,
    'at', r.created_at, 'reply', r.reply) order by r.created_at desc), '[]'::jsonb)
  from (select * from public.reviews where published and consent order by created_at desc limit 30) r;
$function$;
