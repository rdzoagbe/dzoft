-- ============================================================================
-- DZOFT · copie de référence du schéma Supabase (projet rzghbvmszbjlqkdjzpxc)
-- Générée le 2026-10-28, mise à jour le 2026-10-30 (leads : statuts de suivi + next_at, droits RPC et notifications outbox) depuis la base réelle et les migrations associées.
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
  status     text not null default 'nouvelle'
    check (status in ('nouvelle', 'contactée', 'devis envoyé', 'gagnée', 'perdue', 'traitée', 'archivée')),
    -- 'traitée' : ancien statut conservé pour les lignes existantes
  client_id  uuid references public.clients (id) on delete set null,
  email      text not null default '',
  user_id    uuid references auth.users (id) on delete set null,
  next_at    date,            -- date de relance prévue (suivi admin, migration 2026-10-29)
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

-- SECURITY FOLLOW-UP: public intake still needs server-side abuse limiting and a challenge.
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
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'dzoft_owner'), '') = 'true'
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
      update public.clients set user_id = uid, email = case when email = '' then em else email end,
        portal_token = gen_random_uuid() where id = c.id;
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
  select id into cid from public.clients where portal_token = p_token and user_id is null;
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
  select id into cid from public.clients where portal_token = p_token and user_id is null;
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
  select id into cid from public.clients where portal_token = p_token and user_id is null;
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
  select id into cid from public.clients where portal_token = p_token and user_id is null;
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
  select id into cid from public.clients where portal_token = p_token and user_id is null;
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
  select id into cid from public.clients where portal_token = p_token and user_id is null;
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

-- ---------------------------------------------------------------- droits EXECUTE des fonctions exposées par l'API
-- Révocation générale pour éviter qu'une nouvelle fonction SECURITY DEFINER
-- soit appelable par défaut. Seules les fonctions utilisées par le portail
-- reçoivent ensuite un droit explicite. Les helpers client_* et portal_data,
-- ainsi que my_client/my_accept/portal_accept, restent inaccessibles via l'API.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_reviews() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_message(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_validate(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_accept_signed(uuid, uuid, text, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_review(uuid, uuid, integer, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_space() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_validate(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_accept_signed(uuid, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_review(uuid, integer, text, text, text, boolean) TO authenticated;

-- Activity logging and transactional mail outbox; canonical migration follows.
-- DZOFT project activity and transactional email outbox.
-- Events are inserted in the same transaction as the action that created them.
-- The outbox contains references only; message bodies and documents stay in
-- their existing protected tables/storage until the worker sends an email.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.notification_settings (
  singleton boolean primary key default true check (singleton),
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_email text,
  updated_at timestamptz not null default now()
);
revoke all on private.notification_settings from public, anon, authenticated, service_role;

-- Keep internal invoice-email controls and attachment metadata out of the
-- client-facing JSON returned by the private portal RPCs.
create or replace function public.portal_data(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
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
        'note', q.client_note, 'steps', q.steps, 'docs', q.docs, 'env', q.env,
        'invoices', coalesce((select jsonb_agg(i.value - array['id','emailAt','attachPdf','fileSize'] order by i.ordinality)
          from jsonb_array_elements(coalesce(q.invoices, '[]'::jsonb)) with ordinality as i(value, ordinality)), '[]'::jsonb),
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
end
$function$;
revoke all on function public.portal_data(uuid) from public, anon, authenticated, service_role;

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 1 and 512),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in (
    'quote_published', 'quote_accepted', 'client_message', 'owner_message',
    'step_validation_requested', 'step_progress', 'client_step_validated',
    'invoice_shared', 'client_file_uploaded', 'review_submitted'
  )),
  summary text not null check (char_length(summary) between 1 and 300),
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  invoice_id text check (invoice_id is null or char_length(invoice_id) <= 100),
  file_name text check (file_name is null or char_length(file_name) <= 180)
);
create index project_events_quote_created_idx on public.project_events (quote_id, created_at desc);
create index project_events_client_created_idx on public.project_events (client_id, created_at desc);
alter table public.project_events enable row level security;
revoke all on public.project_events from anon, authenticated;
grant select on public.project_events to authenticated;
create policy "owner reads project events" on public.project_events for select to authenticated
  using ((select public.is_owner()));

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.project_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  recipient_role text not null check (recipient_role in ('owner', 'client')),
  recipient text,
  invoice_id text,
  attach_invoice_pdf boolean not null default false,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  unique (event_id, recipient_role)
);
create index email_outbox_queue_idx on public.email_outbox (status, next_attempt_at, created_at);
create index email_outbox_quote_idx on public.email_outbox (quote_id, created_at desc);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;
create policy "owner reads email delivery log" on public.email_outbox for select to authenticated
  using ((select public.is_owner()));

create or replace function private.queue_project_event(
  p_event_key text,
  p_event_type text,
  p_summary text,
  p_client_id uuid,
  p_quote_id uuid,
  p_message_id uuid default null,
  p_invoice_id text default null,
  p_file_name text default null,
  p_notify_client boolean default false,
  p_notify_owner boolean default false,
  p_attach_invoice_pdf boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_owner_email text;
  v_client_email text;
begin
  insert into public.project_events (
    event_key, event_type, summary, client_id, quote_id, message_id, invoice_id, file_name
  ) values (
    left(p_event_key, 512), p_event_type, left(p_summary, 300), p_client_id, p_quote_id,
    p_message_id, p_invoice_id, left(p_file_name, 180)
  ) on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.project_events where event_key = left(p_event_key, 512);
    return v_event_id;
  end if;

  if p_notify_client then
    select nullif(btrim(email), '')
      into v_client_email
      from public.clients where id = p_client_id;
    if coalesce(v_client_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      select nullif(btrim(contact), '') into v_client_email from public.clients where id = p_client_id;
    end if;
    if coalesce(v_client_email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, recipient, invoice_id, attach_invoice_pdf
      ) values (
        v_event_id, p_client_id, p_quote_id, 'client', v_client_email, p_invoice_id, p_attach_invoice_pdf
      ) on conflict (event_id, recipient_role) do nothing;
    else
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, invoice_id, attach_invoice_pdf, status, next_attempt_at, last_error
      ) values (
        v_event_id, p_client_id, p_quote_id, 'client', p_invoice_id, p_attach_invoice_pdf,
        'failed', now(), 'Client email address is missing or invalid.'
      ) on conflict (event_id, recipient_role) do nothing;
    end if;
  end if;

  if p_notify_owner then
    select owner_email into v_owner_email from private.notification_settings where singleton;
    if coalesce(v_owner_email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, recipient, invoice_id, attach_invoice_pdf
      ) values (
        v_event_id, p_client_id, p_quote_id, 'owner', v_owner_email, p_invoice_id, p_attach_invoice_pdf
      ) on conflict (event_id, recipient_role) do nothing;
    else
      insert into public.email_outbox (
        event_id, client_id, quote_id, recipient_role, invoice_id, attach_invoice_pdf, status, next_attempt_at, last_error
      ) values (
        v_event_id, p_client_id, p_quote_id, 'owner', p_invoice_id, p_attach_invoice_pdf,
        'failed', now(), 'Owner notification address has not been registered.'
      ) on conflict (event_id, recipient_role) do nothing;
    end if;
  end if;

  return v_event_id;
end
$function$;
revoke all on function private.queue_project_event(text, text, text, uuid, uuid, uuid, text, text, boolean, boolean, boolean) from public, anon, authenticated, service_role;

create or replace function public.register_notification_owner()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_email text;
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if coalesce(v_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'owner email address unavailable';
  end if;
  insert into private.notification_settings (singleton, owner_user_id, owner_email, updated_at)
    values (true, auth.uid(), v_email, now())
    on conflict (singleton) do update set owner_user_id = excluded.owner_user_id,
      owner_email = excluded.owner_email, updated_at = excluded.updated_at;
  update public.email_outbox set recipient = v_email, status = 'queued', attempts = 0,
      next_attempt_at = now(), lease_until = null, last_error = null
    where recipient_role = 'owner' and status = 'failed'
      and last_error = 'Owner notification address has not been registered.';
  return jsonb_build_object('ok', true);
end
$function$;
revoke all on function public.register_notification_owner() from public, anon, authenticated, service_role;
grant execute on function public.register_notification_owner() to authenticated;

create or replace function public.admin_notify_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare q public.quotes; v_event_id uuid; v_key text;
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  select * into q from public.quotes where id = p_quote_id and shared and deleted_at is null;
  if not found then raise exception 'quote is not visible to the client'; end if;
  if q.accepted_at is not null then raise exception 'quote has already been accepted'; end if;
  if exists (
    select 1 from public.email_outbox o join public.project_events e on e.id = o.event_id
    where o.quote_id = q.id and e.event_type = 'quote_published'
      and o.status in ('queued', 'processing', 'sent') and o.created_at > now() - interval '30 minutes'
  ) then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;
  v_key := 'quote:' || q.id::text || ':manual:' || gen_random_uuid()::text;
  v_event_id := private.queue_project_event(v_key, 'quote_published', 'E-mail du devis renvoyé · ' || q.numero,
    q.client_id, q.id, null, null, null, true, true, false);
  return jsonb_build_object('ok', true, 'event_id', v_event_id);
end
$function$;
revoke all on function public.admin_notify_quote(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_notify_quote(uuid) to authenticated;

create or replace function public.log_client_upload(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_client_id uuid; v_uid uuid := auth.uid(); v_name text; v_quote_id uuid; v_notify_owner boolean;
begin
  if v_uid is null or public.is_owner() then raise exception 'not authorized'; end if;
  v_client_id := public.my_client();
  if p_path is null or char_length(p_path) > 500
     or p_path !~ ('^u/' || v_uid::text || '/[^/].*$')
     or p_path ~* '/factures/' then raise exception 'invalid client file path'; end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'client-files' and o.name = p_path
  ) then raise exception 'uploaded file not found'; end if;
  if (select count(*) from public.project_events where client_id = v_client_id
        and event_type = 'client_file_uploaded' and created_at > now() - interval '1 day') >= 100 then
    raise exception 'too many file notifications';
  end if;
  v_name := regexp_replace(p_path, '^.*/', '');
  select id into v_quote_id from public.quotes where client_id = v_client_id and shared and deleted_at is null
    order by created_at desc limit 1;
  v_notify_owner := not exists (
    select 1 from public.project_events e where e.client_id = v_client_id
      and e.event_type = 'client_file_uploaded' and e.created_at > now() - interval '10 minutes'
  );
  perform private.queue_project_event('upload:' || p_path, 'client_file_uploaded', 'Fichier déposé par le client · ' || v_name,
    v_client_id, v_quote_id, null, null, v_name, false, v_notify_owner, false);
  return jsonb_build_object('ok', true);
end
$function$;
revoke all on function public.log_client_upload(text) from public, anon, authenticated, service_role;
grant execute on function public.log_client_upload(text) to authenticated;

create or replace function private.capture_message_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_type text; v_summary text; v_to_client boolean; v_to_owner boolean; v_quote_id uuid;
begin
  v_type := case when new.author = 'client' then 'client_message' else 'owner_message' end;
  v_summary := case when new.author = 'client' then 'Nouveau message du client' else 'Réponse envoyée au client' end;
  v_to_client := new.author = 'moi';
  v_to_owner := new.author = 'client' and not exists (
    select 1 from public.project_events e where e.client_id = new.client_id
      and e.event_type = 'client_message' and e.created_at > now() - interval '10 minutes'
  );
  v_quote_id := new.quote_id;
  perform private.queue_project_event('message:' || new.id::text, v_type, v_summary,
    new.client_id, v_quote_id, new.id, null, null, v_to_client, v_to_owner, false);
  return new;
end
$function$;
revoke all on function private.capture_message_event() from public, anon, authenticated, service_role;
create trigger messages_notify_project_event after insert on public.messages
  for each row execute function private.capture_message_event();

create or replace function private.capture_quote_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s jsonb;
  old_s jsonb;
  inv jsonb;
  old_inv jsonb;
  v_step_key text;
  v_step_title text;
  v_stamp text;
  v_file_name text;
begin
  if new.shared and not old.shared and new.client_id is not null and new.deleted_at is null then
    perform private.queue_project_event('quote:' || new.id::text || ':published', 'quote_published',
      'Devis rendu visible · ' || new.numero, new.client_id, new.id, null, null, null, true, true, false);
  end if;
  if old.accepted_at is null and new.accepted_at is not null and new.client_id is not null then
    perform private.queue_project_event('quote:' || new.id::text || ':accepted:' || new.accepted_at::text,
      'quote_accepted', 'Devis accepté · ' || new.numero, new.client_id, new.id, null, null, null, true, true, false);
  end if;

  for s in select value from jsonb_array_elements(coalesce(new.steps, '[]'::jsonb)) loop
    select value into old_s from jsonb_array_elements(coalesce(old.steps, '[]'::jsonb))
      where value ->> 'k' = s ->> 'k' limit 1;
    v_step_key := left(coalesce(s ->> 'k', 'step'), 80);
    v_step_title := left(coalesce(nullif(btrim(s ->> 't'), ''), v_step_key), 120);

    if nullif(s ->> 'emailValidateAt', '') is not null
       and s ->> 'emailValidateAt' is distinct from old_s ->> 'emailValidateAt' then
      v_stamp := s ->> 'emailValidateAt';
      perform private.queue_project_event('step:' || new.id::text || ':' || v_step_key || ':validate:' || v_stamp,
        'step_validation_requested', 'Validation demandée au client · ' || v_step_title,
        new.client_id, new.id, null, null, null, true, true, false);
    end if;

    if nullif(s ->> 'emailProgressAt', '') is not null
       and s ->> 'emailProgressAt' is distinct from old_s ->> 'emailProgressAt' then
      v_stamp := s ->> 'emailProgressAt';
      perform private.queue_project_event('step:' || new.id::text || ':' || v_step_key || ':progress:' || v_stamp,
        'step_progress', 'Étape terminée · ' || v_step_title,
        new.client_id, new.id, null, null, null, true, true, false);
    end if;

    if nullif(s ->> 'vby', '') is not null and s ->> 'vby' is distinct from old_s ->> 'vby' then
      v_stamp := coalesce(nullif(s ->> 'vat', ''), now()::text);
      perform private.queue_project_event('step:' || new.id::text || ':' || v_step_key || ':validated:' || v_stamp,
        'client_step_validated', 'Étape validée par le client · ' || v_step_title,
        new.client_id, new.id, null, null, null, true, true, false);
    end if;
  end loop;

  for inv in select value from jsonb_array_elements(coalesce(new.invoices, '[]'::jsonb)) loop
    if nullif(inv ->> 'id', '') is null then continue; end if;
    select value into old_inv from jsonb_array_elements(coalesce(old.invoices, '[]'::jsonb))
      where value ->> 'id' = inv ->> 'id' limit 1;
    if nullif(inv ->> 'emailAt', '') is not null
       and inv ->> 'emailAt' is distinct from old_inv ->> 'emailAt' then
      v_stamp := inv ->> 'emailAt';
      v_file_name := case when coalesce((inv ->> 'attachPdf')::boolean, false)
          and nullif(inv ->> 'file', '') is not null then coalesce(nullif(inv ->> 'fileName', ''), 'facture.pdf') else null end;
      perform private.queue_project_event('invoice:' || new.id::text || ':' || (inv ->> 'id') || ':' || v_stamp,
        'invoice_shared', 'Facture envoyée · ' || left(coalesce(nullif(inv ->> 'n', ''), inv ->> 'num', 'facture'), 100),
        new.client_id, new.id, null, inv ->> 'id', v_file_name, true, true,
        coalesce((inv ->> 'attachPdf')::boolean, false) and nullif(inv ->> 'file', '') is not null);
    end if;
  end loop;
  return new;
end
$function$;
revoke all on function private.capture_quote_events() from public, anon, authenticated, service_role;
create trigger quotes_notify_project_events after update of shared, accepted_at, steps, invoices on public.quotes
  for each row execute function private.capture_quote_events();

create or replace function private.capture_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.queue_project_event('review:' || new.quote_id::text || ':' || new.updated_at::text,
    'review_submitted', 'Avis reçu · ' || new.rating || '/5',
    new.client_id, new.quote_id, null, null, null, false, true, false);
  return new;
end
$function$;
revoke all on function private.capture_review_event() from public, anon, authenticated, service_role;
create trigger reviews_notify_project_event after insert on public.reviews
  for each row execute function private.capture_review_event();

create or replace function private.requeue_client_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_email text;
begin
  if new.email is not distinct from old.email and new.contact is not distinct from old.contact then return new; end if;
  v_email := coalesce(nullif(btrim(new.email), ''), nullif(btrim(new.contact), ''));
  if coalesce(v_email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    update public.email_outbox set recipient = v_email, status = 'queued', attempts = 0,
        next_attempt_at = now(), lease_until = null, last_error = null
      where client_id = new.id and recipient_role = 'client' and status = 'failed'
        and last_error = 'Client email address is missing or invalid.';
  end if;
  return new;
end
$function$;
revoke all on function private.requeue_client_notifications() from public, anon, authenticated, service_role;
create trigger clients_requeue_email_notifications after update of email, contact on public.clients
  for each row execute function private.requeue_client_notifications();

create or replace function public.claim_email_outbox(p_limit integer default 10)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $function$
  with picked as (
    select o.id from public.email_outbox o
    where (o.status = 'queued' and o.next_attempt_at <= now())
       or (o.status = 'processing' and o.lease_until < now())
    order by o.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 10), 1), 20)
  )
  update public.email_outbox o
    set status = 'processing', attempts = least(o.attempts + 1, 6), lease_until = now() + interval '5 minutes'
    from picked where o.id = picked.id
  returning o.*;
$function$;
revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_email_outbox(integer) to service_role;

create or replace function public.finish_email_outbox(
  p_id uuid, p_success boolean, p_provider_message_id text default null, p_error text default null,
  p_retryable boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_attempts integer; v_status text; v_delay interval;
begin
  select attempts into v_attempts from public.email_outbox where id = p_id for update;
  if not found then raise exception 'email job not found'; end if;
  if p_success then
    v_status := 'sent'; v_delay := null;
  elsif not coalesce(p_retryable, true) or v_attempts >= 6 then
    v_status := 'failed'; v_delay := null;
  else
    v_status := 'queued';
    v_delay := case v_attempts
      when 1 then interval '1 minute'
      when 2 then interval '5 minutes'
      when 3 then interval '30 minutes'
      when 4 then interval '2 hours'
      else interval '12 hours'
    end;
  end if;
  update public.email_outbox set status = v_status,
    sent_at = case when p_success then now() else sent_at end,
    provider_message_id = case when p_success then left(p_provider_message_id, 250) else provider_message_id end,
    next_attempt_at = case when v_status = 'queued' then now() + v_delay else next_attempt_at end,
    lease_until = null,
    last_error = case when p_success then null else left(coalesce(p_error, 'Email delivery failed.'), 500) end
  where id = p_id;
  return jsonb_build_object('ok', true, 'status', v_status);
end
$function$;
revoke all on function public.finish_email_outbox(uuid, boolean, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.finish_email_outbox(uuid, boolean, text, text, boolean) to service_role;

create or replace function public.retry_email_outbox(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare o public.email_outbox; v_email text;
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  select * into o from public.email_outbox where id = p_id for update;
  if not found or o.status <> 'failed' then raise exception 'email is not failed'; end if;
  if o.recipient_role = 'owner' then
    select owner_email into v_email from private.notification_settings where singleton;
  elsif o.client_id is not null then
    select coalesce(nullif(btrim(email), ''), nullif(btrim(contact), '')) into v_email
      from public.clients where id = o.client_id;
  end if;
  if coalesce(v_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid recipient email is required before retrying';
  end if;
  update public.email_outbox set recipient = v_email, status = 'queued', attempts = 0,
    next_attempt_at = now(), lease_until = null, last_error = null where id = p_id;
  return jsonb_build_object('ok', true);
end
$function$;
revoke all on function public.retry_email_outbox(uuid) from public, anon, authenticated, service_role;
grant execute on function public.retry_email_outbox(uuid) to authenticated;

create or replace function public.verify_email_outbox_cron(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select coalesce((select decrypted_secret = p_secret from vault.decrypted_secrets
    where name = 'dzoft_email_outbox_cron'), false)
$function$;
revoke all on function public.verify_email_outbox_cron(text) from public, anon, authenticated, service_role;
grant execute on function public.verify_email_outbox_cron(text) to service_role;

-- The secret is generated directly inside Vault and is never committed or
-- returned by this migration. pg_cron wakes the worker once per minute.
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'dzoft_email_outbox_cron', 'Authentication for the DZOFT email worker cron job');
select vault.create_secret('https://rzghbvmszbjlqkdjzpxc.supabase.co', 'dzoft_email_project_url', 'DZOFT Supabase project URL');
select vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z2hidm1zemJqbHFrZGp6cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDQ0MTEsImV4cCI6MjEwODU4MDQxMX0.LtN4aeyRY8Xf7s6vmoLU1QfRl_aCXOdtyAGSYdgHkZM', 'dzoft_email_publishable_key', 'Public project key used by pg_net to call the email worker');

select cron.schedule(
  'dzoft-email-outbox',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_project_url') || '/functions/v1/process-notification-outbox',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_publishable_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_publishable_key'),
        'x-dzoft-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dzoft_email_outbox_cron')
      ),
      body := jsonb_build_object('source', 'scheduled-worker')
    );
  $cron$
);

select cron.schedule(
  'dzoft-prune-email-history',
  '35 3 * * *',
  $prune$
    delete from public.project_events where created_at < now() - interval '24 months';
    delete from public.notifications where created_at < now() - interval '24 months';
  $prune$
);

commit;

-- Migration source: 20261030140000_security_hardening.sql
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

-- Migration source: 20261030143000_secure_pg_net_schema.sql
begin;

-- pg_net cannot be relocated; Supabase recommends recreating it in extensions.
-- The async request queue was confirmed empty before applying this migration.
create schema if not exists extensions;
drop extension pg_net;
create extension pg_net with schema extensions;

commit;

