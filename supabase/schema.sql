-- ============================================================================
-- DZOFT · copie de référence du schéma Supabase (projet rzghbvmszbjlqkdjzpxc)
-- Régénérée le 2026-11-17 directement depuis la base réelle (catalogue Postgres),
-- mise à jour le 2026-11-18 (avoirs / credit notes, migration 20261118120000_credit_notes.sql) :
-- tables, contraintes, index, RLS et politiques, déclencheurs, droits, fonctions.
--
-- Ce fichier documente l'état de la base. Ce n'est PAS un script d'installation à
-- exécuter tel quel (ordre des objets et références aux schémas auth/storage/cron non
-- garantis). Les migrations de supabase/migrations font foi pour reconstruire la base.
-- Aucune donnée, aucun secret : les clés restent dans Vault et les secrets des fonctions Edge.
-- À régénérer après toute migration.
-- ============================================================================


-- ---------------------------------------------------------------- tables

create table private.brevo_delivery_events (
  outbox_id uuid not null,
  event_type text not null,
  occurred_at timestamp with time zone not null,
  recorded_at timestamp with time zone not null default now()
);

create table private.brevo_delivery_setup (
  singleton boolean not null default true,
  webhook_id bigint,
  active boolean not null default false,
  configured_at timestamp with time zone,
  backfilled_at timestamp with time zone,
  polling_active boolean not null default false,
  last_polled_at timestamp with time zone
);

create table private.dzoft_invoice_sequences (
  invoice_year integer not null,
  last_number bigint not null
);
alter table private.dzoft_invoice_sequences enable row level security;

create table private.dzoft_issued_invoice_registry (
  invoice_number text not null,
  quote_id uuid not null,
  receipt_id uuid,
  invoice_id text not null,
  issued_on date not null,
  amount numeric(12,2) not null,
  created_at timestamp with time zone not null default now(),
  issued_by uuid not null,
  basis text not null default 'receipt'::text,
  change_id uuid,
  request_key uuid,
  cancelled_for_reissue boolean not null default false
);
alter table private.dzoft_issued_invoice_registry enable row level security;

create table private.notification_settings (
  singleton boolean not null default true,
  owner_user_id uuid,
  owner_email text,
  updated_at timestamp with time zone not null default now()
);

create table private.project_git_sync_state (
  singleton boolean not null default true,
  last_success_at timestamp with time zone,
  last_inserted integer not null default 0,
  last_checked integer not null default 0
);

create table public.clients (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  nom text not null default ''::text,
  entreprise text not null default ''::text,
  adresse text not null default ''::text,
  contact text not null default ''::text,
  notes text not null default ''::text,
  portal_token uuid not null default gen_random_uuid(),
  user_id uuid,
  email text not null default ''::text
);
alter table public.clients enable row level security;

create table public.dzoft_change_events (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  event_type text not null,
  actor_type text not null,
  proposal_version integer not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);
alter table public.dzoft_change_events enable row level security;

create table public.dzoft_change_requests (
  id uuid not null default gen_random_uuid(),
  quote_id uuid not null,
  client_id uuid not null,
  title text not null,
  description text not null,
  status text not null default 'requested'::text,
  proposed_scope text,
  extra_price numeric(12,2),
  timeline_impact text,
  proposal_version integer not null default 0,
  proposed_at timestamp with time zone,
  decision_name text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  lines jsonb,
  proposal_number text,
  already_done boolean not null default false,
  sent_at timestamp with time zone,
  decision_method text,
  decision_target text
);
alter table public.dzoft_change_requests enable row level security;

create table public.email_outbox (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  created_at timestamp with time zone not null default now(),
  client_id uuid,
  quote_id uuid,
  recipient_role text not null,
  recipient text,
  invoice_id text,
  attach_invoice_pdf boolean not null default false,
  status text not null default 'queued'::text,
  attempts integer not null default 0,
  next_attempt_at timestamp with time zone not null default now(),
  lease_until timestamp with time zone,
  sent_at timestamp with time zone,
  provider_message_id text,
  last_error text,
  delivery_status text not null default 'unconfirmed'::text,
  delivery_event_at timestamp with time zone,
  delivered_at timestamp with time zone,
  opened_at timestamp with time zone,
  bounced_at timestamp with time zone,
  delivery_updated_at timestamp with time zone
);
alter table public.email_outbox enable row level security;

create table public.leads (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  prenom text not null,
  activite text not null default ''::text,
  projet text not null default ''::text,
  budget text not null default ''::text,
  contact text not null default ''::text,
  elements text not null default ''::text,
  message text not null default ''::text,
  source text not null default 'site'::text,
  status text not null default 'nouvelle'::text,
  client_id uuid,
  email text not null default ''::text,
  user_id uuid,
  deleted_at timestamp with time zone,
  next_at date,
  archived_at timestamp with time zone,
  archive_previous_status text,
  last_prospect_contact_at timestamp with time zone
);
alter table public.leads enable row level security;

create table public.messages (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  client_id uuid not null,
  quote_id uuid,
  author text not null,
  body text not null,
  read_at timestamp with time zone
);
alter table public.messages enable row level security;

create table public.notifications (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  client_id uuid,
  quote_id uuid,
  kind text not null,
  ref text not null default ''::text,
  recipient text not null default ''::text,
  ok boolean not null default true,
  error text
);
alter table public.notifications enable row level security;

create table public.project_events (
  id uuid not null default gen_random_uuid(),
  event_key text not null,
  created_at timestamp with time zone not null default now(),
  event_type text not null,
  summary text not null,
  client_id uuid,
  quote_id uuid,
  message_id uuid,
  invoice_id text,
  file_name text
);
alter table public.project_events enable row level security;

create table public.project_payment_statuses (
  id uuid not null,
  quote_id uuid not null,
  amount numeric(12,2) not null,
  method text not null,
  status text not null,
  reported_on date,
  reference text not null default ''::text,
  receipt_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  confirmed_at timestamp with time zone,
  created_by uuid not null
);
alter table public.project_payment_statuses enable row level security;

create table public.project_receipt_method_audit (
  id uuid not null default gen_random_uuid(),
  quote_id uuid not null,
  receipt_id uuid not null,
  previous_method text not null,
  corrected_method text not null,
  reason text not null,
  changed_by uuid not null,
  changed_at timestamp with time zone not null default now()
);
alter table public.project_receipt_method_audit enable row level security;

create table public.project_receipts (
  id uuid not null,
  quote_id uuid not null,
  invoice_id text,
  amount numeric(12,2) not null,
  received_on date not null,
  method text not null,
  reference text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  created_by uuid not null
);
alter table public.project_receipts enable row level security;

create table public.project_updates (
  id uuid not null,
  quote_id uuid not null,
  category text not null,
  status text not null,
  summary text not null,
  created_at timestamp with time zone not null default now(),
  created_by uuid not null,
  batch_id uuid not null
);
alter table public.project_updates enable row level security;

create table public.project_work_items (
  id uuid not null default gen_random_uuid(),
  quote_id uuid not null,
  title text not null,
  status text not null default 'todo'::text,
  category text not null default 'other'::text,
  source_date date,
  source_group text,
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  published_at timestamp with time zone,
  published_batch uuid
);
alter table public.project_work_items enable row level security;

create table public.quotes (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  numero text not null default ''::text,
  status text not null default 'brouillon'::text,
  client_id uuid,
  lead_id uuid,
  total numeric not null default 0,
  data jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  sent_at timestamp with time zone,
  accepted_at timestamp with time zone,
  accepted_name text,
  accepted_ip text,
  accepted_data jsonb,
  accepted_total numeric,
  client_note text not null default ''::text,
  steps jsonb not null default '[]'::jsonb,
  docs jsonb not null default '[]'::jsonb,
  env jsonb not null default '[]'::jsonb,
  deleted_at timestamp with time zone,
  accepted_terms text,
  accepted_early_start boolean,
  accepted_method text,
  accepted_target text,
  invoices jsonb not null default '[]'::jsonb,
  care jsonb,
  ext_link text not null default ''::text,
  journal jsonb not null default '[]'::jsonb,
  progress_draft jsonb,
  progress_auto_draft jsonb
);
alter table public.quotes enable row level security;

create table public.reviews (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  client_id uuid not null,
  quote_id uuid not null,
  rating integer not null,
  body text not null,
  name text not null,
  activity text not null default ''::text,
  consent boolean not null default false,
  published boolean not null default false,
  published_at timestamp with time zone,
  reply text not null default ''::text
);
alter table public.reviews enable row level security;

create table public.settings (
  id integer not null default 1,
  payment jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now(),
  price_blocks jsonb not null default '[]'::jsonb,
  default_line_price numeric(12,2),
  price_tiers jsonb not null default '[{"key": "retouche", "rule": "texte, couleur ou taille, sans nouvelle logique", "label": "Retouche", "price": 10}, {"key": "petite", "rule": "un écran ou un comportement, sans nouvelle donnée", "label": "Petite évolution", "price": 25}, {"key": "moyenne", "rule": "nouvelle donnée ou plusieurs écrans, avec tests", "label": "Évolution moyenne", "price": 50}, {"key": "importante", "rule": "donnée protégée côté serveur (confidentialité ou sécurité), plusieurs écrans, tests", "label": "Évolution importante", "price": 100}, {"key": "offert", "rule": "proposé par DZOFT, non facturé", "label": "Offert", "price": 0}]'::jsonb
);
alter table public.settings enable row level security;

create table public.sign_codes (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  quote_id uuid not null,
  client_id uuid not null,
  channel text not null,
  target text not null,
  salt text not null,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  attempts integer not null default 0,
  used_at timestamp with time zone,
  change_id uuid
);
alter table public.sign_codes enable row level security;

-- ---------------------------------------------------------------- contraintes

alter table private.brevo_delivery_events add constraint brevo_delivery_events_event_type_check CHECK ((event_type = ANY (ARRAY['delivered'::text, 'opened'::text, 'proxy_open'::text, 'unique_opened'::text, 'soft_bounce'::text, 'hard_bounce'::text, 'blocked'::text, 'invalid'::text, 'spam'::text, 'deferred'::text, 'error'::text])));
alter table private.brevo_delivery_events add constraint brevo_delivery_events_outbox_id_fkey FOREIGN KEY (outbox_id) REFERENCES email_outbox(id) ON DELETE CASCADE;
alter table private.brevo_delivery_events add constraint brevo_delivery_events_pkey PRIMARY KEY (outbox_id, event_type, occurred_at);
alter table private.brevo_delivery_setup add constraint brevo_delivery_setup_pkey PRIMARY KEY (singleton);
alter table private.brevo_delivery_setup add constraint brevo_delivery_setup_singleton_check CHECK (singleton);
alter table private.dzoft_invoice_sequences add constraint dzoft_invoice_sequences_invoice_year_check CHECK (((invoice_year >= 2020) AND (invoice_year <= 2200)));
alter table private.dzoft_invoice_sequences add constraint dzoft_invoice_sequences_last_number_check CHECK ((last_number >= 0));
alter table private.dzoft_invoice_sequences add constraint dzoft_invoice_sequences_pkey PRIMARY KEY (invoice_year);
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_basis_check CHECK ((((basis = 'receipt'::text) AND (receipt_id IS NOT NULL) AND (change_id IS NULL)) OR ((basis = ANY (ARRAY['final'::text, 'interim'::text])) AND (receipt_id IS NULL) AND (change_id IS NULL)) OR ((basis = 'supplement'::text) AND (receipt_id IS NULL) AND (change_id IS NOT NULL))));
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_registry_amount_check CHECK ((amount > (0)::numeric));
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_registry_change_id_fkey FOREIGN KEY (change_id) REFERENCES dzoft_change_requests(id);
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_registry_invoice_id_key UNIQUE (invoice_id);
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_registry_pkey PRIMARY KEY (invoice_number);
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_registry_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_registry_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES project_receipts(id);
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_registry_receipt_id_key UNIQUE (receipt_id);
alter table private.notification_settings add constraint notification_settings_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table private.notification_settings add constraint notification_settings_pkey PRIMARY KEY (singleton);
alter table private.notification_settings add constraint notification_settings_singleton_check CHECK (singleton);
alter table private.project_git_sync_state add constraint project_git_sync_state_check CHECK (((last_inserted >= 0) AND (last_checked >= 0)));
alter table private.project_git_sync_state add constraint project_git_sync_state_pkey PRIMARY KEY (singleton);
alter table private.project_git_sync_state add constraint project_git_sync_state_singleton_check CHECK (singleton);
alter table public.clients add constraint clients_pkey PRIMARY KEY (id);
alter table public.clients add constraint clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.dzoft_change_events add constraint dzoft_change_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['client'::text, 'owner'::text])));
alter table public.dzoft_change_events add constraint dzoft_change_events_event_type_check CHECK ((event_type = ANY (ARRAY['requested'::text, 'proposed'::text, 'approved'::text, 'declined'::text, 'rejected'::text, 'withdrawn'::text, 'in_progress'::text, 'completed'::text, 'sent'::text])));
alter table public.dzoft_change_events add constraint dzoft_change_events_pkey PRIMARY KEY (id);
alter table public.dzoft_change_events add constraint dzoft_change_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES dzoft_change_requests(id);
alter table public.dzoft_change_requests add constraint dzoft_change_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
alter table public.dzoft_change_requests add constraint dzoft_change_requests_decision_method_check CHECK (((decision_method IS NULL) OR (decision_method = ANY (ARRAY['email'::text, 'checkbox'::text]))));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_description_check CHECK (((char_length(description) >= 10) AND (char_length(description) <= 2000)));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_extra_price_check CHECK (((extra_price IS NULL) OR ((extra_price >= (0)::numeric) AND (extra_price <= (1000000)::numeric))));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_lines_check CHECK (((lines IS NULL) OR ((jsonb_typeof(lines) = 'array'::text) AND ((jsonb_array_length(lines) >= 1) AND (jsonb_array_length(lines) <= 60)))));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_pkey PRIMARY KEY (id);
alter table public.dzoft_change_requests add constraint dzoft_change_requests_proposal_version_check CHECK ((proposal_version >= 0));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_proposed_scope_check CHECK (((proposed_scope IS NULL) OR ((char_length(proposed_scope) >= 10) AND (char_length(proposed_scope) <= 2000))));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.dzoft_change_requests add constraint dzoft_change_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'proposed'::text, 'approved'::text, 'declined'::text, 'rejected'::text, 'withdrawn'::text, 'in_progress'::text, 'completed'::text])));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_timeline_impact_check CHECK (((timeline_impact IS NULL) OR (char_length(timeline_impact) <= 600)));
alter table public.dzoft_change_requests add constraint dzoft_change_requests_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 120)));
alter table public.email_outbox add constraint email_outbox_attempts_check CHECK (((attempts >= 0) AND (attempts <= 6)));
alter table public.email_outbox add constraint email_outbox_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.email_outbox add constraint email_outbox_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['unconfirmed'::text, 'delivered'::text, 'opened'::text, 'deferred'::text, 'soft_bounce'::text, 'hard_bounce'::text, 'blocked'::text, 'invalid'::text, 'spam'::text, 'error'::text])));
alter table public.email_outbox add constraint email_outbox_event_id_fkey FOREIGN KEY (event_id) REFERENCES project_events(id) ON DELETE CASCADE;
alter table public.email_outbox add constraint email_outbox_event_id_recipient_role_key UNIQUE (event_id, recipient_role);
alter table public.email_outbox add constraint email_outbox_pkey PRIMARY KEY (id);
alter table public.email_outbox add constraint email_outbox_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
alter table public.email_outbox add constraint email_outbox_recipient_role_check CHECK ((recipient_role = ANY (ARRAY['owner'::text, 'client'::text])));
alter table public.email_outbox add constraint email_outbox_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text])));
alter table public.leads add constraint leads_activite_check CHECK ((char_length(activite) <= 200));
alter table public.leads add constraint leads_budget_check CHECK ((char_length(budget) <= 100));
alter table public.leads add constraint leads_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.leads add constraint leads_contact_check CHECK ((char_length(contact) <= 200));
alter table public.leads add constraint leads_elements_check CHECK ((char_length(elements) <= 500));
alter table public.leads add constraint leads_message_check CHECK ((char_length(message) <= 5000));
alter table public.leads add constraint leads_pkey PRIMARY KEY (id);
alter table public.leads add constraint leads_prenom_check CHECK (((char_length(prenom) >= 1) AND (char_length(prenom) <= 100)));
alter table public.leads add constraint leads_projet_check CHECK ((char_length(projet) <= 100));
alter table public.leads add constraint leads_source_check CHECK ((char_length(source) <= 30));
alter table public.leads add constraint leads_status_check CHECK ((status = ANY (ARRAY['nouvelle'::text, 'contactée'::text, 'devis envoyé'::text, 'gagnée'::text, 'perdue'::text, 'traitée'::text, 'archivée'::text])));
alter table public.leads add constraint leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.messages add constraint messages_author_check CHECK ((author = ANY (ARRAY['client'::text, 'moi'::text])));
alter table public.messages add constraint messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)));
alter table public.messages add constraint messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
alter table public.notifications add constraint notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
alter table public.project_events add constraint project_events_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.project_events add constraint project_events_event_key_check CHECK (((char_length(event_key) >= 1) AND (char_length(event_key) <= 512)));
alter table public.project_events add constraint project_events_event_key_key UNIQUE (event_key);
alter table public.project_events add constraint project_events_event_type_check CHECK ((event_type = ANY (ARRAY['quote_published'::text, 'quote_accepted'::text, 'client_message'::text, 'owner_message'::text, 'step_validation_requested'::text, 'step_progress'::text, 'client_step_validated'::text, 'invoice_shared'::text, 'client_file_uploaded'::text, 'review_submitted'::text, 'payment_reported'::text, 'progress_digest'::text, 'payment_received'::text, 'payment_reopened'::text, 'change_proposed'::text, 'change_signed'::text])));
alter table public.project_events add constraint project_events_file_name_check CHECK (((file_name IS NULL) OR (char_length(file_name) <= 180)));
alter table public.project_events add constraint project_events_invoice_id_check CHECK (((invoice_id IS NULL) OR (char_length(invoice_id) <= 100)));
alter table public.project_events add constraint project_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;
alter table public.project_events add constraint project_events_pkey PRIMARY KEY (id);
alter table public.project_events add constraint project_events_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
alter table public.project_events add constraint project_events_summary_check CHECK (((char_length(summary) >= 1) AND (char_length(summary) <= 300)));
alter table public.project_payment_statuses add constraint project_payment_statuses_amount_check CHECK ((amount > (0)::numeric));
alter table public.project_payment_statuses add constraint project_payment_statuses_method_check CHECK ((method = ANY (ARRAY['transfer'::text, 'cash'::text, 'card'::text, 'other'::text])));
alter table public.project_payment_statuses add constraint project_payment_statuses_pkey PRIMARY KEY (id);
alter table public.project_payment_statuses add constraint project_payment_statuses_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.project_payment_statuses add constraint project_payment_statuses_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES project_receipts(id);
alter table public.project_payment_statuses add constraint project_payment_statuses_receipt_id_key UNIQUE (receipt_id);
alter table public.project_payment_statuses add constraint project_payment_statuses_reference_check CHECK ((length(reference) <= 100));
alter table public.project_payment_statuses add constraint project_payment_statuses_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent_by_client'::text, 'received'::text, 'cancelled'::text])));
alter table public.project_receipt_method_audit add constraint project_receipt_method_audit_corrected_method_check CHECK ((corrected_method = ANY (ARRAY['transfer'::text, 'card'::text, 'cash'::text, 'other'::text])));
alter table public.project_receipt_method_audit add constraint project_receipt_method_audit_pkey PRIMARY KEY (id);
alter table public.project_receipt_method_audit add constraint project_receipt_method_audit_previous_method_check CHECK ((previous_method = ANY (ARRAY['transfer'::text, 'card'::text, 'cash'::text, 'other'::text])));
alter table public.project_receipt_method_audit add constraint project_receipt_method_audit_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.project_receipt_method_audit add constraint project_receipt_method_audit_reason_check CHECK (((length(btrim(reason)) >= 12) AND (length(btrim(reason)) <= 500)));
alter table public.project_receipt_method_audit add constraint project_receipt_method_audit_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES project_receipts(id);
alter table public.project_receipts add constraint project_receipts_amount_check CHECK ((amount > (0)::numeric));
alter table public.project_receipts add constraint project_receipts_method_check CHECK ((method = ANY (ARRAY['transfer'::text, 'card'::text, 'cash'::text, 'other'::text])));
alter table public.project_receipts add constraint project_receipts_pkey PRIMARY KEY (id);
alter table public.project_receipts add constraint project_receipts_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.project_receipts add constraint project_receipts_reference_check CHECK ((length(reference) <= 100));
alter table public.project_updates add constraint project_updates_category_check CHECK ((category = ANY (ARRAY['design'::text, 'accounts'::text, 'venue'::text, 'chat'::text, 'safety'::text, 'other'::text])));
alter table public.project_updates add constraint project_updates_pkey PRIMARY KEY (id);
alter table public.project_updates add constraint project_updates_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.project_updates add constraint project_updates_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'working'::text, 'built'::text, 'tested'::text])));
alter table public.project_updates add constraint project_updates_summary_check CHECK (((length(summary) >= 1) AND (length(summary) <= 220)));
alter table public.project_work_items add constraint project_work_items_category_check CHECK ((category = ANY (ARRAY['design'::text, 'accounts'::text, 'venue'::text, 'chat'::text, 'safety'::text, 'other'::text])));
alter table public.project_work_items add constraint project_work_items_pkey PRIMARY KEY (id);
alter table public.project_work_items add constraint project_work_items_publication_pair CHECK ((((published_at IS NULL) AND (published_batch IS NULL)) OR ((published_at IS NOT NULL) AND (published_batch IS NOT NULL))));
alter table public.project_work_items add constraint project_work_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.project_work_items add constraint project_work_items_source_group_check CHECK ((source_group = ANY (ARRAY['administration'::text, 'qr'::text, 'evenements'::text, 'profils'::text, 'securite'::text, 'messagerie'::text, 'interface'::text, 'donnees'::text, 'tests'::text, 'livraison'::text, 'fonctionnalites'::text, 'other'::text])));
alter table public.project_work_items add constraint project_work_items_source_pair CHECK ((((source_date IS NULL) AND (source_group IS NULL)) OR ((source_date IS NOT NULL) AND (source_group IS NOT NULL))));
alter table public.project_work_items add constraint project_work_items_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'working'::text, 'review'::text, 'done'::text])));
alter table public.project_work_items add constraint project_work_items_title_check CHECK (((length(btrim(title)) >= 3) AND (length(btrim(title)) <= 160)));
alter table public.project_work_items add constraint project_work_items_unique_source UNIQUE (quote_id, source_date, source_group);
alter table public.quotes add constraint quotes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public.quotes add constraint quotes_ext_link_check CHECK (((ext_link = ''::text) OR (ext_link ~* '^https://'::text)));
alter table public.quotes add constraint quotes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
alter table public.quotes add constraint quotes_pkey PRIMARY KEY (id);
alter table public.quotes add constraint quotes_status_check CHECK ((status = ANY (ARRAY['brouillon'::text, 'envoyé'::text, 'accepté'::text, 'refusé'::text])));
alter table public.reviews add constraint reviews_activity_check CHECK ((char_length(activity) <= 80));
alter table public.reviews add constraint reviews_body_check CHECK (((char_length(body) >= 10) AND (char_length(body) <= 1500)));
alter table public.reviews add constraint reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 60)));
alter table public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table public.reviews add constraint reviews_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_quote_id_key UNIQUE (quote_id);
alter table public.reviews add constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.reviews add constraint reviews_reply_check CHECK ((char_length(reply) <= 1000));
alter table public.settings add constraint settings_default_line_price_check CHECK (((default_line_price IS NULL) OR ((default_line_price >= (0)::numeric) AND (default_line_price <= (1000000)::numeric))));
alter table public.settings add constraint settings_id_check CHECK ((id = 1));
alter table public.settings add constraint settings_pkey PRIMARY KEY (id);
alter table public.settings add constraint settings_price_blocks_check CHECK (((jsonb_typeof(price_blocks) = 'array'::text) AND (jsonb_array_length(price_blocks) <= 200)));
alter table public.settings add constraint settings_price_tiers_check CHECK (((jsonb_typeof(price_tiers) = 'array'::text) AND (jsonb_array_length(price_tiers) <= 12)));
alter table public.sign_codes add constraint sign_codes_change_id_fkey FOREIGN KEY (change_id) REFERENCES dzoft_change_requests(id) ON DELETE CASCADE;
alter table public.sign_codes add constraint sign_codes_channel_check CHECK ((channel = ANY (ARRAY['sms'::text, 'email'::text])));
alter table public.sign_codes add constraint sign_codes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public.sign_codes add constraint sign_codes_pkey PRIMARY KEY (id);
alter table public.sign_codes add constraint sign_codes_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------- index

CREATE UNIQUE INDEX dzoft_issued_invoice_request_key_unique ON private.dzoft_issued_invoice_registry USING btree (request_key) WHERE (request_key IS NOT NULL);
CREATE UNIQUE INDEX dzoft_issued_invoice_one_final ON private.dzoft_issued_invoice_registry USING btree (quote_id) WHERE ((basis = 'final'::text) AND (NOT cancelled_for_reissue));
CREATE UNIQUE INDEX dzoft_issued_invoice_registry_change_id_key ON private.dzoft_issued_invoice_registry USING btree (change_id) WHERE ((change_id IS NOT NULL) AND (NOT cancelled_for_reissue));
CREATE UNIQUE INDEX clients_user_id_key ON public.clients USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX clients_portal_token_key ON public.clients USING btree (portal_token);
CREATE INDEX dzoft_change_events_request ON public.dzoft_change_events USING btree (request_id, created_at, id);
CREATE INDEX dzoft_change_requests_project ON public.dzoft_change_requests USING btree (quote_id, created_at DESC);
CREATE UNIQUE INDEX dzoft_change_requests_number ON public.dzoft_change_requests USING btree (proposal_number) WHERE (proposal_number IS NOT NULL);
CREATE INDEX email_outbox_queue_idx ON public.email_outbox USING btree (status, next_attempt_at, created_at);
CREATE INDEX email_outbox_quote_idx ON public.email_outbox USING btree (quote_id, created_at DESC);
CREATE INDEX leads_created_at_idx ON public.leads USING btree (created_at DESC);
CREATE INDEX leads_client_id_idx ON public.leads USING btree (client_id);
CREATE INDEX leads_email_idx ON public.leads USING btree (lower(email));
CREATE INDEX messages_quote_idx ON public.messages USING btree (quote_id);
CREATE INDEX messages_client_idx ON public.messages USING btree (client_id, created_at);
CREATE INDEX notifications_lookup ON public.notifications USING btree (client_id, kind, ref, created_at DESC);
CREATE INDEX project_events_quote_created_idx ON public.project_events USING btree (quote_id, created_at DESC);
CREATE INDEX project_events_client_created_idx ON public.project_events USING btree (client_id, created_at DESC);
CREATE INDEX project_payment_statuses_quote_idx ON public.project_payment_statuses USING btree (quote_id, created_at DESC);
CREATE INDEX project_receipt_method_audit_quote_id_idx ON public.project_receipt_method_audit USING btree (quote_id, changed_at DESC);
CREATE INDEX project_receipts_quote_idx ON public.project_receipts USING btree (quote_id, invoice_id);
CREATE INDEX project_updates_quote_idx ON public.project_updates USING btree (quote_id, created_at DESC);
CREATE INDEX project_updates_batch_idx ON public.project_updates USING btree (batch_id);
CREATE INDEX project_work_items_quote_status_idx ON public.project_work_items USING btree (quote_id, status, created_at DESC);
CREATE INDEX quotes_lead_id_idx ON public.quotes USING btree (lead_id);
CREATE INDEX quotes_client_id_idx ON public.quotes USING btree (client_id);
CREATE INDEX sign_codes_quote_idx ON public.sign_codes USING btree (quote_id, created_at DESC);
CREATE INDEX sign_codes_change ON public.sign_codes USING btree (change_id, created_at DESC) WHERE (change_id IS NOT NULL);

-- ---------------------------------------------------------------- politiques RLS (public, private, storage)

create policy "owner manages clients" on public.clients as PERMISSIVE for ALL to authenticated using (( SELECT is_owner() AS is_owner)) with check (( SELECT is_owner() AS is_owner));
create policy "owner reads email delivery log" on public.email_outbox as PERMISSIVE for SELECT to authenticated using (( SELECT is_owner() AS is_owner));
create policy "anyone can submit a new lead" on public.leads as PERMISSIVE for INSERT to anon, authenticated with check (((status = 'nouvelle'::text) AND (client_id IS NULL) AND ((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))) AND (archived_at IS NULL) AND (archive_previous_status IS NULL) AND (last_prospect_contact_at IS NULL)));
create policy "owner deletes leads" on public.leads as PERMISSIVE for DELETE to authenticated using (( SELECT is_owner() AS is_owner));
create policy "owner reads leads" on public.leads as PERMISSIVE for SELECT to authenticated using (( SELECT is_owner() AS is_owner));
create policy "owner updates leads" on public.leads as PERMISSIVE for UPDATE to authenticated using (( SELECT is_owner() AS is_owner)) with check (( SELECT is_owner() AS is_owner));
create policy "owner manages messages" on public.messages as PERMISSIVE for ALL to authenticated using (( SELECT is_owner() AS is_owner)) with check (( SELECT is_owner() AS is_owner));
create policy "owner reads notifications" on public.notifications as PERMISSIVE for SELECT to authenticated using (( SELECT is_owner() AS is_owner));
create policy "owner reads project events" on public.project_events as PERMISSIVE for SELECT to authenticated using (( SELECT is_owner() AS is_owner));
create policy "owner manages quotes" on public.quotes as PERMISSIVE for ALL to authenticated using (( SELECT is_owner() AS is_owner)) with check (( SELECT is_owner() AS is_owner));
create policy "owner manages reviews" on public.reviews as PERMISSIVE for ALL to authenticated using (( SELECT is_owner() AS is_owner)) with check (( SELECT is_owner() AS is_owner));
create policy "owner manages settings" on public.settings as PERMISSIVE for ALL to authenticated using (( SELECT is_owner() AS is_owner)) with check (( SELECT is_owner() AS is_owner));
create policy "client files: delete own" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'client-files'::text) AND (((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid)) OR ( SELECT is_owner() AS is_owner))));
create policy "client files: read own" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'client-files'::text) AND (((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid)) OR ( SELECT is_owner() AS is_owner))));
create policy "client files: upload own" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'client-files'::text) AND ((storage.foldername(name))[1] = 'u'::text) AND (((storage.foldername(name))[2] = ( SELECT (auth.uid())::text AS uid)) OR ( SELECT is_owner() AS is_owner))));

-- ---------------------------------------------------------------- déclencheurs

CREATE TRIGGER clients_requeue_email_notifications AFTER UPDATE OF email, contact ON public.clients FOR EACH ROW EXECUTE FUNCTION private.requeue_client_notifications();
CREATE TRIGGER dzoft_change_event_no_mutation BEFORE DELETE OR UPDATE ON public.dzoft_change_events FOR EACH ROW EXECUTE FUNCTION private.dzoft_change_event_immutable();
CREATE TRIGGER messages_notify_project_event AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION private.capture_message_event();
CREATE TRIGGER dzoft_progress_auto_insert AFTER INSERT ON public.project_work_items REFERENCING NEW TABLE AS new_github_items FOR EACH STATEMENT EXECUTE FUNCTION private.dzoft_refresh_github_insert_trigger();
CREATE TRIGGER a_guard_receipt_invoices BEFORE UPDATE OF invoices ON public.quotes FOR EACH ROW EXECUTE FUNCTION private.guard_receipt_invoices();
CREATE TRIGGER dzoft_auto_invoice_pdf_immutable BEFORE UPDATE OF invoices ON public.quotes FOR EACH ROW EXECUTE FUNCTION private.guard_auto_invoice_pdf_immutability();
CREATE TRIGGER dzoft_issued_invoice_amounts BEFORE UPDATE OF invoices ON public.quotes FOR EACH ROW EXECUTE FUNCTION private.guard_issued_invoice_amounts();
CREATE TRIGGER quotes_notify_project_events AFTER UPDATE OF shared, accepted_at, steps, invoices ON public.quotes FOR EACH ROW EXECUTE FUNCTION private.capture_quote_events();
CREATE TRIGGER quotes_payment_confirmation BEFORE UPDATE OF invoices ON public.quotes FOR EACH ROW EXECUTE FUNCTION private.payment_confirmation_events();
CREATE TRIGGER quotes_touch BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER reviews_notify_project_event AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION private.capture_review_event();

-- ---------------------------------------------------------------- droits sur les tables (anon, authenticated)

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.clients to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.clients to authenticated;
grant SELECT on public.email_outbox to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.leads to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.leads to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.messages to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.messages to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.notifications to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.notifications to authenticated;
grant SELECT on public.project_events to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.quotes to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.quotes to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.reviews to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.settings to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.settings to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sign_codes to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sign_codes to authenticated;

-- ---------------------------------------------------------------- stockage et tâches planifiées (pg_cron)

-- bucket client-files : public=f, size_limit=20971520, mime=image/png,image/jpeg,image/webp,image/gif,image/heic,application/pdf,application/zip,application/x-zip-compressed,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation
-- cron dzoft_brevo_delivery_reconcile : 25 * * * *
-- cron dzoft_project_background_git : 17,47 * * * *
-- cron dzoft-email-outbox : * * * * *
-- cron dzoft-prune-email-history : 35 3 * * *

-- ---------------------------------------------------------------- fonctions

create or replace function private.attach_generated_invoice_pdf(p_quote uuid, p_invoice text, p_path text, p_size bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; uid uuid; idx int; inv jsonb; n text; expected_path text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 if p_quote is null or p_invoice is null or p_size is null or p_size<100 or p_size>2097152 then
   raise exception 'Invalid PDF attachment request';
 end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null then raise exception 'Project not found'; end if;
 select c.user_id into uid from public.clients c where c.id=q.client_id;
 if uid is null then raise exception 'Client account required for private PDF access'; end if;
 select r.invoice_number into n
 from private.dzoft_issued_invoice_registry r
 where r.quote_id=p_quote and r.invoice_id=p_invoice;
 if n is null then raise exception 'Invoice was not issued by DZOFT'; end if;
 expected_path:='u/'||uid::text||'/factures/'||p_quote::text||'/'||n||'.pdf';
 if p_path is distinct from expected_path then raise exception 'Invalid invoice PDF path'; end if;
 if not exists (select 1 from storage.objects o
   where o.bucket_id='client-files' and o.name=p_path) then
   raise exception 'Upload PDF to private Storage first';
 end if;
 select value, ordinality::int-1 into inv,idx
 from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) with ordinality
 where value->>'id'=p_invoice;
 if inv is null or inv->>'num'<>n or inv->>'generatedByDzoft'<>'true' then
   raise exception 'Invoice metadata mismatch';
 end if;
 if nullif(inv->>'file','') is not null then
   if inv->>'file'=p_path then
     return jsonb_build_object('path',p_path,'already_archived',true);
   end if;
   raise exception 'Issued invoice PDF cannot be replaced';
 end if;
 perform set_config('dzoft.invoice_archive_write','yes',true);
 update public.quotes set invoices=jsonb_set(invoices,array[idx::text],
   inv||jsonb_build_object('file',p_path,'fileName',n||'.pdf',
          'fileSize',p_size,'fileArchivedAt',now(),'attachPdf',false))
 where id=p_quote;
 perform set_config('dzoft.invoice_archive_write','no',true);
 return jsonb_build_object('path',p_path,'already_archived',false);
end $function$
;

create or replace function private.auto_issue_project_receipt_invoice(p_quote uuid, p_receipt uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q public.quotes;
  r public.project_receipts;
  yr integer;
  n bigint;
  num text;
  key text;
  label text;
  inv_sum numeric;
  today_paris date;
  f jsonb;
  prior private.dzoft_issued_invoice_registry;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  label := case p_kind when 'deposit' then 'Facture d’acompte'
    when 'interim' then 'Facture intermédiaire'
    when 'final' then 'Facture de solde'
    else null end;
  if label is null then raise exception 'Invalid invoice type'; end if;
  select * into q from public.quotes where id=p_quote for update;
  if not found or q.deleted_at is not null or q.accepted_at is null
     or q.accepted_total is null or not q.shared then
    raise exception 'An accepted shared project is required';
  end if;
  select * into r from public.project_receipts
    where id=p_receipt and quote_id=p_quote for update;
  if not found then raise exception 'Receipt not found'; end if;
  if r.invoice_id is not null then
    select * into prior from private.dzoft_issued_invoice_registry
      where receipt_id=r.id and quote_id=q.id and invoice_id=r.invoice_id;
    if found then
      return jsonb_build_object('invoice_id',prior.invoice_id,
        'number',prior.invoice_number,'issued_on',prior.issued_on,
        'already_issued',true);
    end if;
    raise exception 'Receipt already linked to an invoice';
  end if;

  f:=coalesce(q.accepted_data->'f',q.data->'f','{}'::jsonb);
  if nullif(btrim(coalesce(f->>'myaddr','')),'') is null
    or nullif(btrim(coalesce(f->>'cname','')),'') is null
    or nullif(btrim(coalesce(f->>'caddr','')),'') is null then
    raise exception 'Complete seller and buyer invoice addresses first';
  end if;

  select coalesce(sum(case when coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]{1,2})?$'
    then (i->>'amt')::numeric else 0 end),0) into inv_sum
  from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) i
  where not (i ? 'care') and not (i ? 'change');
  if inv_sum-private.dzoft_base_reissue_credits(p_quote)+r.amount>q.accepted_total then
    raise exception 'Invoices would exceed the agreed total';
  end if;

  today_paris:=(now() at time zone 'Europe/Paris')::date;
  yr:=extract(year from today_paris)::integer;
  -- Row lock serializes issuance across ALL projects of the business.
  -- Counter increments and invoice linkage roll back together on failure.
  insert into private.dzoft_invoice_sequences(invoice_year,last_number)
    values(yr,0) on conflict(invoice_year) do nothing;
  select last_number into n from private.dzoft_invoice_sequences
    where invoice_year=yr for update;
  n:=n+1;
  num:='F-'||yr||'-'||lpad(n::text,greatest(4,length(n::text)),'0');
  if exists (
    select 1 from public.quotes priorq
    cross join lateral jsonb_array_elements(coalesce(priorq.invoices,'[]'::jsonb)) x
    where lower(btrim(x->>'num'))=lower(num)
  ) or exists (select 1 from private.dzoft_issued_invoice_registry where invoice_number=num) then
    raise exception 'Generated invoice number conflicts with an existing invoice; reconcile numbering before issuing';
  end if;
  update private.dzoft_invoice_sequences set last_number=n where invoice_year=yr;
  key:=gen_random_uuid()::text;
  update public.quotes set invoices=coalesce(invoices,'[]'::jsonb)||
    jsonb_build_array(jsonb_build_object(
      'id',key,'n',label,'num',num,'amt',r.amount,
      'u','','paid',false,'issuedOn',to_char(today_paris,'YYYY-MM-DD'),
      'issuedAt',now(),'generatedByDzoft',true
    )) where id=p_quote;
  -- Existing RPC changes only invoice_id of this receipt, never the amount.
  perform private.link_project_receipt_invoice(p_quote,p_receipt,key,null);
  insert into private.dzoft_issued_invoice_registry(
    invoice_number,quote_id,receipt_id,invoice_id,issued_on,amount,issued_by
  ) values(num,p_quote,p_receipt,key,today_paris,r.amount,auth.uid());

  return jsonb_build_object('invoice_id',key,'number',num,
    'issued_on',today_paris,'already_issued',false);
end
$function$
;

create or replace function private.background_import_project_groups(p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

create or replace function private.brevo_delivery_candidates(p_setup_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare items jsonb;
begin
 if not private.verify_brevo_delivery_token(p_setup_token,'setup') then
  raise exception 'Invalid delivery provisioning token';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('message_id',x.provider_message_id,
   'email',x.recipient)),'[]'::jsonb) into items
 from (select provider_message_id,recipient from public.email_outbox
   where status='sent' and provider_message_id is not null
     and recipient is not null and created_at>=now()-interval '85 days'
   order by created_at desc limit 60) x;
 return items;
end $function$
;

create or replace function private.brevo_delivery_monitor()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare data private.brevo_delivery_setup%rowtype;
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 select * into data from private.brevo_delivery_setup where singleton=true;
 return jsonb_build_object(
  'webhook_configured',coalesce(data.active,false),
  'poll_enabled',coalesce(data.polling_active,false) and exists(
    select 1 from cron.job where jobname='dzoft_brevo_delivery_reconcile' and active
  ),
  'last_polled_at',data.last_polled_at,
  'backfilled_at',data.backfilled_at,
  'received_events',(select count(*) from private.brevo_delivery_events)
 );
end $function$
;

create or replace function private.brevo_delivery_recent_candidates(p_setup_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare items jsonb;
begin
 if not private.verify_brevo_delivery_token(p_setup_token,'setup') then
  raise exception 'Unauthorized delivery reconciliation';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'message_id',x.provider_message_id,'email',x.recipient)),'[]'::jsonb)
 into items from (
   select provider_message_id,recipient
   from public.email_outbox
   where status='sent' and provider_message_id is not null and recipient is not null
     and created_at>=now()-interval '14 days'
     and delivery_status not in ('hard_bounce','blocked','invalid','spam')
   order by created_at desc limit 18
 ) x;
 return items;
end $function$
;

create or replace function private.brevo_delivery_setup_credential(p_setup_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare secret text;
begin
 if not private.verify_brevo_delivery_token(p_setup_token,'setup') then
  raise exception 'Invalid delivery provisioning token';
 end if;
 select decrypted_secret into secret from vault.decrypted_secrets
 where name='dzoft_brevo_webhook_token' limit 1;
 if secret is null then raise exception 'Webhook secret unavailable'; end if;
 return secret;
end $function$
;

create or replace function private.capture_message_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function private.capture_quote_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function private.capture_review_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.queue_project_event('review:' || new.quote_id::text || ':' || new.updated_at::text,
    'review_submitted', 'Avis reçu · ' || new.rating || '/5',
    new.client_id, new.quote_id, null, null, null, false, true, false);
  return new;
end
$function$
;

create or replace function private.change_lines_total(p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare l jsonb; label text; qty numeric; price numeric; total numeric:=0; positive numeric:=0;
  src text; cleaned jsonb:='[]'::jsonb;
begin
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 60 then
   raise exception 'Add between 1 and 60 lines';
 end if;
 for l in select value from jsonb_array_elements(p_lines) loop
   label:=btrim(coalesce(l->>'label',''));
   qty:=case when coalesce(l->>'qty','') ~ '^[0-9]+([.][0-9]{1,2})?$' then (l->>'qty')::numeric end;
   price:=case when coalesce(l->>'price','') ~ '^-?[0-9]+([.][0-9]{1,2})?$' then (l->>'price')::numeric end;
   src:=nullif(btrim(coalesce(l->>'source','')),'');
   if char_length(label) not between 2 and 160 or qty is null or qty<=0 or qty>1000
      or price is null or abs(price)>1000000 then
     raise exception 'Each line needs a label, a quantity and a price';
   end if;
   if src is not null and src !~ '^journal:[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z0-9]{1,16}$' then
     raise exception 'Invalid line origin';
   end if;
   total:=total+round(qty*price,2);
   if price>0 then positive:=positive+round(qty*price,2); end if;
   cleaned:=cleaned||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('label',label,'qty',qty,'price',price,
     'detail',nullif(left(btrim(coalesce(l->>'detail','')),300),''),'source',src,
     'level',nullif(left(btrim(coalesce(l->>'level','')),20),''))));
 end loop;
 if positive<=0 or total<=0 then raise exception 'The total must be positive after the discount'; end if;
 if total>1000000 then raise exception 'Total too high'; end if;
 return jsonb_build_object('lines',cleaned,'total',round(total,2));
end $function$
;

create or replace function private.confirm_project_payment_status(p_quote uuid, p_id uuid, p_received_on date, p_notify boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; x public.project_payment_statuses; result jsonb;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or q.accepted_total is null or not q.shared
 then raise exception 'An accepted shared project is required'; end if;
 select * into x from public.project_payment_statuses where id=p_id and quote_id=p_quote for update;
 if not found then raise exception 'Payment status not found'; end if;
 if x.status='received' then return private.project_tracking(p_quote); end if;
 if x.status='cancelled' then raise exception 'Cancelled payments cannot be confirmed'; end if;
 if p_received_on is null or p_received_on>current_date or p_received_on<date '2000-01-01'
  or p_notify is null then raise exception 'Invalid confirmation date'; end if;
 -- Reuse the existing validated owner-only receipt path. The operation is atomic:
 -- if it fails, the claim remains pending and does not enter confirmed totals.
 result:=private.record_project_payment_unbilled(
   p_quote,p_id,x.amount,p_received_on,x.method,x.reference,p_notify
 );
 update public.project_payment_statuses set
 status='received',receipt_id=p_id,confirmed_at=now(),updated_at=now()
 where id=p_id;
 return private.project_tracking(p_quote);
end $function$
;

create or replace function private.correct_project_receipt_method(p_quote uuid, p_receipt uuid, p_method text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 q public.quotes;
 r public.project_receipts;
 why text:=btrim(coalesce(p_reason,''));
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 if p_quote is null or p_receipt is null or p_method not in ('transfer','card','cash','other')
    or p_method is null or length(why) not between 12 and 500 then
  raise exception 'Invalid correction details';
 end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null then
  raise exception 'Project unavailable';
 end if;
 select * into r from public.project_receipts
 where quote_id=p_quote and id=p_receipt for update;
 if not found then raise exception 'Receipt not found'; end if;
 if r.method=p_method then raise exception 'Payment method unchanged'; end if;

 update public.project_receipts set method=p_method where id=p_receipt;
 -- Keep linked claims consistent without changing their status or value.
 update public.project_payment_statuses set method=p_method,updated_at=now()
  where receipt_id=p_receipt and quote_id=p_quote and status='received';
 insert into public.project_receipt_method_audit
  (quote_id,receipt_id,previous_method,corrected_method,reason,changed_by)
 values (p_quote,p_receipt,r.method,p_method,why,auth.uid());
 -- No payment-created event or client email: this is metadata correction only.
 return private.project_tracking(p_quote);
end $function$
;

create or replace function private.create_project_payment_status(p_quote uuid, p_id uuid, p_amount numeric, p_method text, p_status text, p_reported_on date, p_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; x public.project_payment_statuses;
 state jsonb; already_pending numeric;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or q.accepted_total is null or not q.shared
 then raise exception 'An accepted shared project is required'; end if;
 select * into x from public.project_payment_statuses where id=p_id;
 if found then
  if x.quote_id is distinct from p_quote or x.amount is distinct from p_amount
  or x.method is distinct from p_method or x.reference is distinct from coalesce(p_reference,'')
  then raise exception 'Payment status key already used'; end if;
  return private.project_tracking(p_quote);
 end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2)
  or p_amount>9999999999.99 or p_method not in ('transfer','cash','card','other')
  or p_status not in ('pending','sent_by_client') or p_method is null or p_status is null
  or p_reported_on>current_date or p_reported_on<date '2000-01-01'
  or p_reference is null or length(p_reference)>100
  or (p_status='sent_by_client' and p_reported_on is null)
 then raise exception 'Invalid payment status details'; end if;
 state:=private.project_tracking(p_quote);
 select coalesce(sum(amount),0) into already_pending from public.project_payment_statuses
 where quote_id=p_quote and status in ('pending','sent_by_client');
 if p_amount+already_pending>(state->>'remaining')::numeric
 then raise exception 'Pending payments exceed remaining balance'; end if;
 insert into public.project_payment_statuses
 (id,quote_id,amount,method,status,reported_on,reference,created_by)
 values(p_id,p_quote,p_amount,p_method,p_status,p_reported_on,p_reference,auth.uid());
 return private.project_tracking(p_quote);
end $function$
;

create or replace function private.dzoft_change_event_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin raise exception 'Change request audit events cannot be modified'; end $function$
;

create or replace function private.dzoft_changes_for_project(p_client uuid, p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not exists (select 1 from public.quotes q
   where q.id=p_quote and q.client_id=p_client and q.shared and q.deleted_at is null and q.accepted_at is not null)
 then raise exception 'Accepted project not found'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)||
   jsonb_build_object('history',coalesce((select jsonb_agg(jsonb_build_object(
    'event_type',e.event_type,'actor_type',e.actor_type,'at',e.created_at,
    'proposal_version',e.proposal_version) order by e.created_at,e.id)
    from public.dzoft_change_events e where e.request_id=c.id),'[]'::jsonb))
   order by c.created_at desc,c.id)
   from public.dzoft_change_requests c where c.quote_id=p_quote and c.client_id=p_client),'[]'::jsonb);
end $function$
;

create or replace function private.dzoft_changes_for_client(p_client uuid, p_quote uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
 if not exists (select 1 from public.quotes q
   where q.id=p_quote and q.client_id=p_client and q.shared and q.deleted_at is null and q.accepted_at is not null)
 then raise exception 'Accepted project not found'; end if;
 return coalesce((select jsonb_agg(
   case when c.sent_at is null and c.proposal_version>0 then
     to_jsonb(c)||jsonb_build_object(
       'status',case when c.status='proposed' then 'requested' else c.status end,
       'proposed_scope',null,'extra_price',null,'timeline_impact',null,'lines',null,'proposal_number',null,
       'proposal_version',coalesce(s.last_sent,0),'proposed_at',null,'already_done',false)
   else to_jsonb(c) end
   ||jsonb_build_object('history',coalesce((select jsonb_agg(jsonb_build_object('event_type',e.event_type,
       'actor_type',e.actor_type,'at',e.created_at,
       'proposal_version',case when c.sent_at is null then least(e.proposal_version,coalesce(s.last_sent,0)) else e.proposal_version end)
       order by e.created_at,e.id)
     from public.dzoft_change_events e where e.request_id=c.id
       and (c.sent_at is not null or e.event_type<>'proposed' or e.proposal_version<=coalesce(s.last_sent,0))),'[]'::jsonb))
   order by c.created_at desc,c.id)
   from public.dzoft_change_requests c
   cross join lateral (select max(e.proposal_version) last_sent from public.dzoft_change_events e
     where e.request_id=c.id and e.event_type='sent') s
   where c.quote_id=p_quote and c.client_id=p_client
     -- Opened by DZOFT and never sent: it does not exist for the client, whatever its status.
     and not (c.sent_at is null and s.last_sent is null and c.proposal_version>0 and exists(select 1 from public.dzoft_change_events e
       where e.request_id=c.id and e.event_type='requested' and e.actor_type='owner'))),'[]'::jsonb);
end $function$
;

create or replace function private.dzoft_client_for_change(p_token uuid, p_use_token boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cid uuid;
begin
 if p_use_token then
   select id into cid from public.clients where portal_token=p_token and user_id is null;
 else
   if auth.uid() is null then raise exception 'Client sign-in required'; end if;
   select id into cid from public.clients where user_id=auth.uid();
 end if;
 if cid is null then raise exception 'Client access denied'; end if;
 return cid;
end $function$
;

create or replace function private.dzoft_create_change(p_client uuid, p_quote uuid, p_title text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests;
begin
 if not exists(select 1 from public.quotes q where q.id=p_quote and q.client_id=p_client
   and q.accepted_at is not null and q.shared and q.deleted_at is null)
 then raise exception 'Accepted project not found'; end if;
 p_title:=btrim(coalesce(p_title,''));p_description:=btrim(coalesce(p_description,''));
 if char_length(p_title) not between 3 and 120 or char_length(p_description) not between 10 and 2000
 then raise exception 'Request title or description length is invalid';end if;
 if (select count(*) from public.dzoft_change_requests where quote_id=p_quote and client_id=p_client
      and status in ('requested','proposed'))>=5 then raise exception 'Please resolve an existing open change request first'; end if;
 if exists(select 1 from public.dzoft_change_requests where quote_id=p_quote and client_id=p_client
      and created_at>now()-interval '60 seconds') then raise exception 'Please wait before submitting another request'; end if;
 insert into public.dzoft_change_requests(quote_id,client_id,title,description)
 values(p_quote,p_client,p_title,p_description) returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'requested','client',0,jsonb_build_object('title',c.title,'description',c.description));
 return to_jsonb(c);
end $function$
;

create or replace function private.dzoft_decide_change(p_client uuid, p_request uuid, p_version integer, p_approve boolean, p_name text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare c public.dzoft_change_requests;
begin
 select * into c from public.dzoft_change_requests where id=p_request and client_id=p_client for update;
 if not found then raise exception 'Request not found';end if;
 if not exists(select 1 from public.quotes q where q.id=c.quote_id and q.client_id=p_client
  and q.deleted_at is null and q.shared and q.accepted_at is not null) then raise exception 'Project not available';end if;
 if c.status<>'proposed' or c.proposal_version<>p_version or p_version<1
 then raise exception 'Proposal changed or is no longer awaiting approval';end if;
 if c.sent_at is null then raise exception 'Proposal changed or is no longer awaiting approval';end if;
 if p_approve and coalesce(current_setting('dzoft.change_signed',true),'')<>'yes' then
   raise exception 'Approval requires the code sent by e-mail';
 end if;
 p_name:=btrim(coalesce(p_name,''));
 if char_length(p_name) not between 2 and 120 then raise exception 'Your name is required to confirm this decision';end if;
 update public.dzoft_change_requests
 set status=case when p_approve then 'approved' else 'declined' end,
  decision_name=p_name,decided_at=now(),updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,c.status,'client',c.proposal_version,
   jsonb_build_object('name',p_name,'scope',c.proposed_scope,'extra_price',c.extra_price,
    'timeline_impact',c.timeline_impact,'original_quote',c.quote_id));
 return to_jsonb(c);
end $function$
;

create or replace function private.dzoft_refresh_github_insert_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

create or replace function private.dzoft_refresh_github_progress_draft(p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   select category,min(area) as area,max(source_date) as last_day from (
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
   group by category
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
end $function$
;

create or replace function private.dzoft_sign_change(p_client uuid, p_request uuid, p_version integer, p_name text, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sc public.sign_codes; r jsonb; c public.dzoft_change_requests;
begin
 select * into sc from public.sign_codes
  where change_id=p_request and client_id=p_client and used_at is null
  order by created_at desc limit 1 for update;
 if not found then raise exception 'Request your code first'; end if;
 if sc.expires_at<now() then raise exception 'Code expired: request a new one'; end if;
 if sc.attempts>=5 then raise exception 'Too many attempts: request a new code'; end if;
 if encode(extensions.digest(sc.salt||btrim(coalesce(p_code,'')),'sha256'),'hex')<>sc.code_hash then
   update public.sign_codes set attempts=attempts+1 where id=sc.id;
   raise exception 'Incorrect code';
 end if;
 perform set_config('dzoft.change_signed','yes',true);
 r:=private.dzoft_decide_change(p_client,p_request,p_version,true,p_name);
 perform set_config('dzoft.change_signed','no',true);
 update public.sign_codes set used_at=now() where id=sc.id;
 update public.dzoft_change_requests set decision_method='email',decision_target=sc.target
  where id=p_request returning * into c;
 perform private.queue_project_event('change-signed:'||c.id||':v'||c.proposal_version,'change_signed',
   left('Proposition '||coalesce(c.proposal_number,'complémentaire')||' signée par '||c.decision_name||
     ' · '||private.format_eur(coalesce(c.extra_price,0)),300),
   c.client_id,c.quote_id,null,null,null,false,true,false);
 return to_jsonb(c);
end $function$
;

create or replace function private.dzoft_withdraw_change(p_client uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests;
begin
 select * into c from public.dzoft_change_requests where id=p_request and client_id=p_client for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'This request cannot be withdrawn';end if;
 update public.dzoft_change_requests set status='withdrawn',updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version)
 values(c.id,'withdrawn','client',c.proposal_version);
 return to_jsonb(c);
end $function$
;

create or replace function private.format_eur(p numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select replace(replace(to_char(round(p,2),'FM999G999G990D00'),',',' '),'.',',')||' €';
$function$
;

create or replace function private.guard_auto_invoice_pdf_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rec record; before_invoice jsonb; after_invoice jsonb;
begin
 if new.invoices is not distinct from old.invoices then return new; end if;
 for rec in select invoice_id from private.dzoft_issued_invoice_registry
    where quote_id=new.id loop
   select value into before_invoice from jsonb_array_elements(coalesce(old.invoices,'[]'::jsonb)) where value->>'id'=rec.invoice_id;
   select value into after_invoice from jsonb_array_elements(coalesce(new.invoices,'[]'::jsonb)) where value->>'id'=rec.invoice_id;
   if before_invoice is null or after_invoice is null then
      raise exception 'Issued invoices cannot be deleted';
   end if;
   if after_invoice->>'file' is distinct from before_invoice->>'file' then
      if nullif(before_invoice->>'file','') is not null or coalesce(current_setting('dzoft.invoice_archive_write',true),'')<>'yes' then
        raise exception 'Issued invoice PDF is immutable';
      end if;
   end if;
   if after_invoice->>'n' is distinct from before_invoice->>'n'
      or after_invoice->>'issuedOn' is distinct from before_invoice->>'issuedOn'
      or after_invoice->>'generatedByDzoft' is distinct from before_invoice->>'generatedByDzoft' then
      raise exception 'Issued invoice metadata is immutable';
   end if;
 end loop;
 return new;
end $function$
;

create or replace function private.guard_issued_invoice_amounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  rec record;
  before_invoice jsonb;
  after_invoice jsonb;
begin
  if new.invoices is not distinct from old.invoices then return new; end if;
  for rec in
    select invoice_id from private.dzoft_issued_invoice_registry where quote_id=new.id
  loop
    select value into before_invoice
      from jsonb_array_elements(coalesce(old.invoices,'[]'::jsonb)) value
      where value->>'id'=rec.invoice_id;
    select value into after_invoice
      from jsonb_array_elements(coalesce(new.invoices,'[]'::jsonb)) value
      where value->>'id'=rec.invoice_id;
    if before_invoice is null or after_invoice is null
       or before_invoice->>'amt' is distinct from after_invoice->>'amt'
       or before_invoice->>'num' is distinct from after_invoice->>'num'
       or before_invoice->>'change' is distinct from after_invoice->>'change' then
      raise exception 'Issued invoice number and amount cannot be changed or deleted';
    end if;
  end loop;
  return new;
end $function$
;

create or replace function private.guard_receipt_invoices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; i jsonb; prev jsonb;
begin
 for r in
  select distinct invoice_id
  from public.project_receipts
  where quote_id=new.id and invoice_id is not null
 loop
  select value into i from jsonb_array_elements(coalesce(new.invoices,'[]'::jsonb))
   where value->>'id'=r.invoice_id;
  select value into prev from jsonb_array_elements(coalesce(old.invoices,'[]'::jsonb))
   where value->>'id'=r.invoice_id;
  if i is null or i->>'amt' is distinct from prev->>'amt'
   or i->>'num' is distinct from prev->>'num'
  then raise exception 'An invoice with recorded receipts cannot be removed or changed'; end if;
  if coalesce(current_setting('dzoft.receipt_write',true),'')<>'yes'
   and i->>'paid' is distinct from prev->>'paid'
  then raise exception 'Payment status is calculated from recorded receipts'; end if;
 end loop;
 return new;
end $function$
;

create or replace function private.issue_accepted_invoice(p_quote uuid, p_basis text, p_change uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q public.quotes;
  c public.dzoft_change_requests;
  prior private.dzoft_issued_invoice_registry;
  f jsonb;
  v_amount numeric;
  label text;
  invoiced numeric;
  unbilled numeric;
  today_paris date;
  yr integer;
  n bigint;
  num text;
  key text;
  extra jsonb:='{}'::jsonb;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  if p_quote is null or p_basis is null or p_basis not in ('final','supplement')
     or (p_basis='final' and p_change is not null)
     or (p_basis='supplement' and p_change is null) then
    raise exception 'Invalid invoice request';
  end if;
  select * into q from public.quotes where id=p_quote for update;
  if not found or q.deleted_at is not null or q.accepted_at is null
     or q.accepted_total is null or not q.shared then
    raise exception 'An accepted shared project is required';
  end if;

  -- Same request again (double click, retry): return the invoice already issued.
  if p_basis='final' then
    select * into prior from private.dzoft_issued_invoice_registry
      where quote_id=p_quote and basis='final' and not cancelled_for_reissue;
  else
    select * into prior from private.dzoft_issued_invoice_registry where change_id=p_change and not cancelled_for_reissue;
  end if;
  if found then
    if prior.quote_id<>p_quote then raise exception 'Invalid invoice request'; end if;
    return jsonb_build_object('invoice_id',prior.invoice_id,'number',prior.invoice_number,
      'issued_on',prior.issued_on,'amount',prior.amount,'already_issued',true);
  end if;

  f:=coalesce(q.accepted_data->'f',q.data->'f','{}'::jsonb);
  if nullif(btrim(coalesce(f->>'myaddr','')),'') is null
    or nullif(btrim(coalesce(f->>'cname','')),'') is null
    or nullif(btrim(coalesce(f->>'caddr','')),'') is null then
    raise exception 'Complete seller and buyer invoice addresses first';
  end if;

  if p_basis='final' then
    -- Balance = accepted total - what is already invoiced on the quote
    --           - verified payments that still wait for their own invoice.
    select coalesce(sum(case when coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]{1,2})?$'
      then (i->>'amt')::numeric else 0 end),0) into invoiced
    from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) i
    where not (i ? 'care') and not (i ? 'change');
    select coalesce(sum(r.amount),0) into unbilled from public.project_receipts r
      where r.quote_id=p_quote and r.invoice_id is null;
    v_amount:=q.accepted_total-(invoiced-private.dzoft_base_reissue_credits(p_quote))-unbilled;
    if v_amount<=0 then raise exception 'Nothing left to invoice on the accepted quote'; end if;
    label:='Facture de solde';
    extra:=jsonb_build_object('basis','final');
  else
    select * into c from public.dzoft_change_requests
      where id=p_change and quote_id=p_quote and client_id=q.client_id for update;
    if not found or c.status<>'completed' or c.decided_at is null or c.proposal_version<1 then
      raise exception 'Only an approved change whose work is completed can be invoiced';
    end if;
    if coalesce(c.extra_price,0)<=0 then
      raise exception 'This change has no extra charge to invoice';
    end if;
    v_amount:=c.extra_price;
    label:=left('Facture complémentaire · '||c.title,80);
    extra:=jsonb_build_object('basis','supplement','change',c.id,'changeVersion',c.proposal_version);
  end if;
  v_amount:=round(v_amount,2);

  today_paris:=(now() at time zone 'Europe/Paris')::date;
  yr:=extract(year from today_paris)::integer;
  -- Same business-wide sequence as invoices issued for received payments.
  insert into private.dzoft_invoice_sequences(invoice_year,last_number)
    values(yr,0) on conflict(invoice_year) do nothing;
  select last_number into n from private.dzoft_invoice_sequences
    where invoice_year=yr for update;
  n:=n+1;
  num:='F-'||yr||'-'||lpad(n::text,greatest(4,length(n::text)),'0');
  if exists (
    select 1 from public.quotes priorq
    cross join lateral jsonb_array_elements(coalesce(priorq.invoices,'[]'::jsonb)) x
    where lower(btrim(x->>'num'))=lower(num)
  ) or exists (select 1 from private.dzoft_issued_invoice_registry where invoice_number=num) then
    raise exception 'Generated invoice number conflicts with an existing invoice; reconcile numbering before issuing';
  end if;
  update private.dzoft_invoice_sequences set last_number=n where invoice_year=yr;
  key:=gen_random_uuid()::text;
  update public.quotes set invoices=coalesce(invoices,'[]'::jsonb)||
    jsonb_build_array(jsonb_build_object(
      'id',key,'n',label,'num',num,'amt',v_amount,
      'u','','paid',false,'issuedOn',to_char(today_paris,'YYYY-MM-DD'),
      'issuedAt',now(),'generatedByDzoft',true
    )||extra) where id=p_quote;
  insert into private.dzoft_issued_invoice_registry(
    invoice_number,quote_id,receipt_id,invoice_id,issued_on,amount,issued_by,basis,change_id
  ) values(num,p_quote,null,key,today_paris,v_amount,auth.uid(),p_basis,p_change);

  return jsonb_build_object('invoice_id',key,'number',num,'issued_on',today_paris,
    'amount',v_amount,'label',label,'already_issued',false);
end
$function$
;

create or replace function private.issue_interim_invoice(p_quote uuid, p_amount numeric, p_request_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q public.quotes;
  prior private.dzoft_issued_invoice_registry;
  f jsonb;
  already numeric;
  unbilled numeric;
  remaining numeric;
  today_paris date;
  yr integer;
  n bigint;
  num text;
  key text;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  if p_quote is null or p_request_key is null or p_amount is null
     or p_amount <= 0 or p_amount > 1000000
     or p_amount <> round(p_amount,2) then
    raise exception 'Invalid partial invoice amount or request key';
  end if;

  select * into q from public.quotes where id=p_quote for update;
  if not found or q.deleted_at is not null or not q.shared or
     q.accepted_at is null or q.accepted_total is null then
    raise exception 'Accepted shared project required';
  end if;

  select * into prior from private.dzoft_issued_invoice_registry
    where request_key=p_request_key;
  if found then
    if prior.quote_id<>p_quote or prior.basis<>'interim' or prior.amount<>p_amount then
      raise exception 'Request key already used for another invoice';
    end if;
    return jsonb_build_object('invoice_id',prior.invoice_id,
      'number',prior.invoice_number,'issued_on',prior.issued_on,
      'amount',prior.amount,'already_issued',true);
  end if;
  if exists(select 1 from private.dzoft_issued_invoice_registry
            where quote_id=p_quote and basis='final' and not cancelled_for_reissue) then
    raise exception 'Final invoice already issued for this quote';
  end if;

  f:=coalesce(q.accepted_data->'f',q.data->'f','{}'::jsonb);
  if nullif(btrim(coalesce(f->>'myaddr','')),'') is null
     or nullif(btrim(coalesce(f->>'cname','')),'') is null
     or nullif(btrim(coalesce(f->>'caddr','')),'') is null then
    raise exception 'Complete seller and buyer addresses before invoicing';
  end if;

  select coalesce(sum(case
    when coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]{1,2})?$'
    then (i->>'amt')::numeric else 0 end),0)
    into already
    from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) i
    where not (i ? 'care') and not (i ? 'change');
  select coalesce(sum(r.amount),0) into unbilled
    from public.project_receipts r
    where r.quote_id=p_quote and r.invoice_id is null;
  remaining:=round(q.accepted_total-(already-private.dzoft_base_reissue_credits(p_quote))-unbilled,2);
  if remaining <= 0 then raise exception 'Nothing left to invoice'; end if;
  if p_amount >= remaining then
    raise exception 'For the full balance use the final invoice action';
  end if;

  today_paris:=(now() at time zone 'Europe/Paris')::date;
  yr:=extract(year from today_paris)::integer;
  insert into private.dzoft_invoice_sequences(invoice_year,last_number)
    values(yr,0) on conflict(invoice_year) do nothing;
  select last_number into n from private.dzoft_invoice_sequences
    where invoice_year=yr for update;
  n:=n+1;
  num:='F-'||yr||'-'||lpad(n::text,greatest(4,length(n::text)),'0');
  if exists (
    select 1 from public.quotes priorq
    cross join lateral jsonb_array_elements(coalesce(priorq.invoices,'[]'::jsonb)) x
    where lower(btrim(x->>'num'))=lower(num)
  ) or exists (
    select 1 from private.dzoft_issued_invoice_registry where invoice_number=num
  ) then
    raise exception 'Invoice number conflict; reconcile numbering before issuing';
  end if;
  update private.dzoft_invoice_sequences
     set last_number=n where invoice_year=yr;

  key:=gen_random_uuid()::text;
  update public.quotes
    set invoices=coalesce(invoices,'[]'::jsonb)||jsonb_build_array(
      jsonb_build_object(
        'id',key,'n','Facture intermédiaire','num',num,'amt',p_amount,
        'u','','paid',false,'issuedOn',to_char(today_paris,'YYYY-MM-DD'),
        'issuedAt',now(),'generatedByDzoft',true,'basis','interim'
      )
    ) where id=p_quote;
  insert into private.dzoft_issued_invoice_registry(
    invoice_number,quote_id,receipt_id,invoice_id,issued_on,amount,
    issued_by,basis,change_id,request_key
  ) values(num,p_quote,null,key,today_paris,p_amount,
    auth.uid(),'interim',null,p_request_key);

  return jsonb_build_object('invoice_id',key,'number',num,'issued_on',today_paris,
    'amount',p_amount,'already_issued',false,'basis','interim');
end $function$
;

create or replace function private.link_project_receipt_invoice(p_quote uuid, p_receipt uuid, p_invoice text, p_new_invoice jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; r public.project_receipts; i jsonb;
 pos integer; v_num text; v_label text; v_amt numeric; total_invoiced numeric;
 used numeric; v_state jsonb;
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null
  or q.accepted_total is null or not q.shared then
  raise exception 'An accepted shared project is required';
 end if;
 if p_receipt is null or p_invoice is null or length(p_invoice) not between 1 and 80 then
  raise exception 'Invalid invoice link';
 end if;
 select * into r from public.project_receipts
  where id=p_receipt and quote_id=p_quote for update;
 if not found then raise exception 'Receipt not found'; end if;
 if r.invoice_id is not null then
  if r.invoice_id=p_invoice and p_new_invoice is null then
   return private.project_tracking(p_quote);
  end if;
  raise exception 'Receipt already linked to an invoice';
 end if;

 if p_new_invoice is not null then
  v_num:=btrim(coalesce(p_new_invoice->>'num',''));
  v_label:=btrim(coalesce(p_new_invoice->>'n',''));
  v_amt:=case when coalesce(p_new_invoice->>'amt','') ~ '^[0-9]+([.][0-9]{1,2})?$'
    then (p_new_invoice->>'amt')::numeric end;
  if length(v_num) not between 1 and 40 or length(v_label) not between 1 and 80
    or v_amt is null or v_amt<=0 or v_amt<r.amount then
    raise exception 'Invalid invoice details';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) x
    where x->>'id'=p_invoice) then
    raise exception 'Invoice key already used';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) x
    where lower(btrim(x->>'num'))=lower(v_num)) then
    raise exception 'Invoice number already used';
  end if;
  select coalesce(sum(
    case when coalesce(x->>'amt','') ~ '^[0-9]+([.][0-9]+)?$'
      then (x->>'amt')::numeric else 0 end
  ),0) into total_invoiced
  from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) x
  where not (x ? 'care') and not (x ? 'change');
  if total_invoiced-private.dzoft_base_reissue_credits(p_quote)+v_amt>q.accepted_total then
   raise exception 'Invoices would exceed the agreed total';
  end if;
  update public.quotes set invoices=coalesce(invoices,'[]'::jsonb)||
    jsonb_build_array(jsonb_build_object(
      'id',p_invoice,'n',v_label,'num',v_num,'amt',v_amt,'u','','paid',false
    )) where id=p_quote returning * into q;
 end if;

 select value,ordinality::integer-1 into i,pos
  from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb))
  with ordinality where value->>'id'=p_invoice;
 if i is null or i ? 'care' or coalesce(i->>'num','')=''
   or i->>'paid'='true'
   or coalesce(i->>'amt','') !~ '^[0-9]+([.][0-9]{1,2})?$' then
  raise exception 'Choose an unpaid numbered invoice';
 end if;
 select coalesce(sum(amount),0) into used from public.project_receipts
  where quote_id=p_quote and invoice_id=p_invoice;
 used:=used+coalesce((select sum(amount) from public.dzoft_credit_notes where quote_id=p_quote and invoice_id=p_invoice),0);
 if used+r.amount>(i->>'amt')::numeric then
  raise exception 'Amount exceeds invoice balance';
 end if;
 -- The money is ALREADY counted in project_tracking; only attach its document.
 update public.project_receipts set invoice_id=p_invoice where id=p_receipt;
 if used+r.amount=(i->>'amt')::numeric then
  perform set_config('dzoft.receipt_write','yes',true);
  update public.quotes
    set invoices=jsonb_set(invoices,array[pos::text],
      i||jsonb_build_object('paid',true,'payment_confirmed_at',now()))
    where id=p_quote;
  perform set_config('dzoft.receipt_write','no',true);
 end if;
 v_state:=private.project_tracking(p_quote);
 return v_state;
end $function$
;

create or replace function private.list_project_work_items(p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

create or replace function private.mark_brevo_delivery_polling(p_backfill boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 insert into private.brevo_delivery_setup(singleton,polling_active,last_polled_at,backfilled_at)
 values(true,true,now(),case when p_backfill then now() else null end)
 on conflict(singleton) do update
 set polling_active=true,
     last_polled_at=now(),
     backfilled_at=coalesce(excluded.backfilled_at,private.brevo_delivery_setup.backfilled_at);
 return true;
end $function$
;

create or replace function private.mark_brevo_delivery_setup(p_webhook_id bigint, p_backfill boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if p_webhook_id is null or p_webhook_id<1 then raise exception 'Bad webhook id'; end if;
 insert into private.brevo_delivery_setup(singleton,webhook_id,active,configured_at,backfilled_at)
 values(true,p_webhook_id,true,now(),case when p_backfill then now() else null end)
 on conflict(singleton) do update set
  webhook_id=excluded.webhook_id,active=true,configured_at=excluded.configured_at,
  backfilled_at=coalesce(excluded.backfilled_at,private.brevo_delivery_setup.backfilled_at);
 return true;
end $function$
;

create or replace function private.payment_confirmation_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare inv jsonb; prev jsonb; result jsonb := '[]'; was_paid boolean; paid boolean; stamp text := clock_timestamp()::text; label text;
begin
 if current_setting('dzoft.receipt_write',true) = 'yes' then return new; end if;
 for inv in select value from jsonb_array_elements(coalesce(new.invoices,'[]'::jsonb)) loop
  select value into prev from jsonb_array_elements(coalesce(old.invoices,'[]'::jsonb)) where value->>'id'=inv->>'id';
  if prev->>'payment_reported_at' is not null then inv:=inv||jsonb_build_object('payment_reported_at',prev->>'payment_reported_at'); end if;
  paid:=coalesce((inv->>'paid')::boolean,false); was_paid:=coalesce((prev->>'paid')::boolean,false);
  label:=left(coalesce(inv->>'n','Facture')||' · '||coalesce(inv->>'num','')||' · '||coalesce(inv->>'amt','0')||' €',200);
  if new.accepted_at is not null and coalesce(inv->>'id','')<>'' and coalesce(inv->>'num','')<>'' then
   if not paid and inv->>'payment_reported_at' is not null and prev->>'payment_reported_at' is null then
    perform private.queue_project_event('payment-reported:'||new.id||':'||(inv->>'id'),'payment_reported','Paiement déclaré envoyé par le client · '||label,new.client_id,new.id,p_invoice_id=>inv->>'id',p_notify_owner=>true);
   end if;
   if paid and not was_paid then
    if not public.is_owner() then raise exception 'Confirmation réservée à l’administrateur.'; end if;
    inv:=inv||jsonb_build_object('payment_confirmed_at',now());
    perform private.queue_project_event('payment-received:'||new.id||':'||(inv->>'id')||':'||stamp,'payment_received','Paiement reçu et confirmé par Roland · '||label,new.client_id,new.id,p_invoice_id=>inv->>'id',p_notify_client=>true,p_notify_owner=>true);
   elsif paid then
    inv:=(inv-'payment_confirmed_at')||case when prev ? 'payment_confirmed_at' then jsonb_build_object('payment_confirmed_at',prev->>'payment_confirmed_at') else '{}'::jsonb end;
   elsif was_paid then
    inv:=inv-'payment_confirmed_at';
    perform private.queue_project_event('payment-reopened:'||new.id||':'||(inv->>'id')||':'||stamp,'payment_reopened','Confirmation de paiement corrigée : vérification en cours · '||label,new.client_id,new.id,p_invoice_id=>inv->>'id',p_notify_client=>true,p_notify_owner=>true);
   else inv:=inv-'payment_confirmed_at';
   end if;
  end if;
  result:=result||jsonb_build_array(inv);
 end loop;
 new.invoices:=result;
 return new;
end $function$
;

create or replace function private.project_payment_admin_meta(p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; notices jsonb; corrections jsonb;
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 select * into q from public.quotes where id=p_quote and deleted_at is null;
 if not found then raise exception 'Project unavailable'; end if;

 select coalesce(jsonb_agg(jsonb_build_object(
  'receipt_id',r.id,
  'email_status',coalesce(mail.email_status,'not_queued'),
  'sent_at',mail.sent_at
 ) order by r.created_at desc),'[]'::jsonb)
 into notices
 from public.project_receipts r
 left join lateral (
  select case
   when bool_or(o.status='sent') then 'sent'
   when bool_or(o.status='failed') then 'failed'
   when count(o.id)>0 then 'queued'
   else 'not_queued' end as email_status,
   max(o.sent_at) filter (where o.status='sent') as sent_at
  from public.project_events e
  join public.email_outbox o on o.event_id=e.id and o.recipient_role='client'
  where e.quote_id=p_quote and e.event_key='receipt:'||r.id::text
 ) mail on true
 where r.quote_id=p_quote;

 select coalesce(jsonb_agg(jsonb_build_object(
  'receipt_id',a.receipt_id,
  'old_method',a.previous_method,
  'new_method',a.corrected_method,
  'reason',a.reason,
  'changed_at',a.changed_at
 ) order by a.changed_at desc),'[]'::jsonb)
 into corrections
 from public.project_receipt_method_audit a where a.quote_id=p_quote;

 return jsonb_build_object('notifications',notices,'corrections',corrections);
end $function$
;

create or replace function private.project_tracking(p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; cred_reduce numeric; cred_supp_reissue numeric; received numeric; legacy numeric; supp numeric; rows jsonb; reports jsonb;
begin
 select * into q from public.quotes where id=p_quote and deleted_at is null;
 if not found or not ((auth.uid() is not null and (public.is_owner() or
   (q.shared and q.accepted_at is not null and exists(
     select 1 from public.clients c where c.id=q.client_id and c.user_id=auth.uid()))))
   or (q.shared and q.accepted_at is not null
       and coalesce(current_setting('dzoft.portal_client', true), '') = q.client_id::text))
 then raise exception 'Project unavailable'; end if;
 select coalesce(sum(amount),0) into received
 from public.project_receipts where quote_id=p_quote;
 select coalesce(sum((i->>'amt')::numeric),0) into legacy
 from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) i
 where not (i ? 'care') and i->>'paid'='true'
 and coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]+)?$'
 and not exists(select 1 from public.project_receipts r
   where r.quote_id=p_quote and r.invoice_id=i->>'id');
 select coalesce(sum((i->>'amt')::numeric),0) into supp
 from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) i
 where i ? 'change' and coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]+)?$';
 select coalesce(sum(amount) filter (where effect='reduce'),0), coalesce(sum(amount) filter (where effect='reissue' and invoice_kind='supplement'),0) into cred_reduce, cred_supp_reissue from public.dzoft_credit_notes where quote_id=p_quote;
 select coalesce(jsonb_agg(to_jsonb(r)-'created_by' order by r.received_on desc,r.created_at desc),'[]'::jsonb)
 into rows from public.project_receipts r where quote_id=p_quote;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'amount',s.amount,'method',s.method,'status',s.status,
  'reported_on',s.reported_on,'reference',s.reference,
  'receipt_id',s.receipt_id,'confirmed_at',s.confirmed_at,
  'created_at',s.created_at
 ) order by s.created_at desc),'[]'::jsonb)
 into reports from public.project_payment_statuses s where quote_id=p_quote;
 return jsonb_build_object(
  'total',q.accepted_total+supp-cred_supp_reissue-cred_reduce,'base_total',q.accepted_total,'supplements',supp-cred_supp_reissue,'credits',cred_reduce,
  'received',received+legacy,'legacy',legacy,
  'remaining',greatest(coalesce(q.accepted_total,0)+supp-cred_supp_reissue-cred_reduce-received-legacy,0),
  'credit_notes',(select coalesce(jsonb_agg(to_jsonb(cn)-'issued_by'-'request_key' order by cn.issued_at),'[]'::jsonb) from public.dzoft_credit_notes cn where cn.quote_id=p_quote),
  'receipts',rows,'payment_statuses',reports,
  'updates',(select coalesce(jsonb_agg(to_jsonb(u)-'created_by' order by u.created_at desc),'[]'::jsonb)
    from public.project_updates u where quote_id=p_quote)
 );
end $function$
;

create or replace function private.publish_project_update(p_quote uuid, p_id uuid, p_category text, p_status text, p_summary text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return private.publish_project_updates(p_quote, p_id,
  jsonb_build_array(jsonb_build_object('category',p_category,'status',p_status,'summary',p_summary)));
end $function$
;

create or replace function private.publish_project_updates(p_quote uuid, p_batch uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; it jsonb; n integer; existing integer; cat text; st text; sm text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or not q.shared or q.accepted_at is null then raise exception 'Accepted shared project required'; end if;
 if p_batch is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid publication'; end if;
 n := jsonb_array_length(p_items);
 if n<1 or n>6 then raise exception 'Publish between 1 and 6 summaries'; end if;
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
end $function$
;

create or replace function private.publish_project_work_item(p_quote uuid, p_id uuid, p_batch uuid, p_category text, p_summary text, p_tested boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; item public.project_work_items; clean text:=btrim(coalesce(p_summary,'')); email_state text;
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
 select coalesce((
  select o.status from public.project_events e
  join public.email_outbox o on o.event_id=e.id and o.recipient_role='client'
  where e.event_key='digest:'||p_batch::text
  order by o.created_at desc limit 1
 ),'not_queued') into email_state;
 return jsonb_build_object('published',true,'already_published',false,'id',item.id,
  'client_email_status',email_state);
end $function$
;

create or replace function private.queue_project_event(p_event_key text, p_event_type text, p_summary text, p_client_id uuid, p_quote_id uuid, p_message_id uuid DEFAULT NULL::uuid, p_invoice_id text DEFAULT NULL::text, p_file_name text DEFAULT NULL::text, p_notify_client boolean DEFAULT false, p_notify_owner boolean DEFAULT false, p_attach_invoice_pdf boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function private.record_brevo_delivery_event(p_message_id text, p_recipient text, p_event text, p_occurred_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 normalized_id text:=lower(btrim(coalesce(p_message_id,''),' <>'));
 normalized_email text:=lower(btrim(coalesce(p_recipient,'')));
 normalized_event text:=lower(btrim(coalesce(p_event,'')));
 job public.email_outbox%rowtype;
 target text;
 applied boolean:=false;
 existing_rank int;
 incoming_rank int;
 other_match boolean;
begin
 if length(normalized_id)<10 or length(normalized_id)>250
    or length(normalized_email)<5 or length(normalized_email)>320
    or position('@' in normalized_email)=0
    or p_occurred_at is null
    or p_occurred_at>now()+interval '1 day'
    or p_occurred_at<now()-interval '180 days' then
  raise exception 'Invalid delivery event';
 end if;
 if normalized_event in ('request','sent','click','unsubscribed') then
  return jsonb_build_object('matched',false,'ignored',true);
 end if;
 if normalized_event not in (
    'delivered','opened','open','proxy_open','unique_opened','unique_proxy_open',
    'soft_bounce','hard_bounce','blocked','invalid','invalid_email','spam','deferred','error'
 ) then return jsonb_build_object('matched',false,'ignored',true); end if;

 select * into job from public.email_outbox o
  where lower(btrim(coalesce(o.provider_message_id,''),' <>'))=normalized_id
    and lower(btrim(coalesce(o.recipient,'')))=normalized_email
    and o.status='sent'
  order by o.created_at desc limit 1 for update;
 if not found then return jsonb_build_object('matched',false,'ignored',false); end if;
 select exists(
   select 1 from public.email_outbox o where o.id<>job.id
     and lower(btrim(coalesce(o.provider_message_id,''),' <>'))=normalized_id
     and lower(btrim(coalesce(o.recipient,'')))=normalized_email and o.status='sent'
 ) into other_match;
 if other_match then raise exception 'Ambiguous provider delivery identifier'; end if;

 normalized_event:=case normalized_event
  when 'open' then 'opened'
  when 'unique_opened' then 'opened'
  when 'unique_proxy_open' then 'proxy_open'
  when 'invalid_email' then 'invalid'
  else normalized_event end;
 target:=case normalized_event when 'proxy_open' then 'opened' else normalized_event end;

 insert into private.brevo_delivery_events(outbox_id,event_type,occurred_at)
 values(job.id,normalized_event,p_occurred_at)
 on conflict do nothing;
 -- Delivery events can arrive out of order. Use the latest event, but avoid
 -- downgrading "opened" to "delivered" from a delayed callback.
 existing_rank:=case job.delivery_status
   when 'opened' then 3 when 'delivered' then 2
   when 'unconfirmed' then 0 else 1 end;
 incoming_rank:=case target
   when 'opened' then 3 when 'delivered' then 2 else 1 end;
 applied:=job.delivery_event_at is null
   or p_occurred_at>job.delivery_event_at
   or (p_occurred_at=job.delivery_event_at and incoming_rank>existing_rank);

 update public.email_outbox
 set
  delivered_at=case when target='delivered' then coalesce(delivered_at,p_occurred_at) else delivered_at end,
  opened_at=case when target='opened' then coalesce(opened_at,p_occurred_at) else opened_at end,
  bounced_at=case when target in ('hard_bounce','soft_bounce','blocked','invalid','spam','error')
                   then coalesce(bounced_at,p_occurred_at) else bounced_at end,
  delivery_status=case
   when not applied then delivery_status
   when delivery_status='opened' and target='delivered' then 'opened'
   else target end,
  delivery_event_at=case when applied then p_occurred_at else delivery_event_at end,
  delivery_updated_at=now()
 where id=job.id;

 return jsonb_build_object('matched',true,'applied',applied);
end $function$
;

create or replace function private.record_project_payment(p_quote uuid, p_id uuid, p_invoice text, p_new_invoice jsonb, p_amount numeric, p_date date, p_method text, p_reference text, p_notify boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; i jsonb; pos integer; already numeric; invoiced numeric; state jsonb; r public.project_receipts;
 v_num text; v_label text; v_amt numeric;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or q.accepted_total is null or not q.shared then raise exception 'An accepted shared project is required'; end if;
 -- Same key sent again (double click, network retry): return the current state, nothing new.
 select * into r from public.project_receipts where id=p_id;
 if found then
  if r.quote_id<>p_quote or r.invoice_id<>p_invoice or r.amount<>p_amount or r.received_on<>p_date or r.method<>p_method or r.reference<>coalesce(p_reference,'') then raise exception 'Receipt key already used'; end if;
  return private.project_tracking(p_quote);
 end if;
 if p_id is null or p_invoice is null or length(p_invoice) not between 1 and 80 or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>9999999999.99
 or p_date is null or p_date>current_date or p_date<date '2000-01-01' or p_method is null or p_method not in ('transfer','card','cash','other')
 or p_reference is null or length(p_reference)>100 or p_notify is null then raise exception 'Invalid payment details'; end if;

 if p_new_invoice is not null then
  v_num:=btrim(coalesce(p_new_invoice->>'num','')); v_label:=btrim(coalesce(p_new_invoice->>'n',''));
  v_amt:=case when coalesce(p_new_invoice->>'amt','') ~ '^[0-9]+([.][0-9]{1,2})?$' then (p_new_invoice->>'amt')::numeric end;
  if length(v_num) not between 1 and 40 or length(v_label) not between 1 and 80 or v_amt is null or v_amt<=0 then raise exception 'Invalid invoice details'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(q.invoices,'[]')) x where x->>'id'=p_invoice) then raise exception 'Invoice key already used'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(q.invoices,'[]')) x where lower(btrim(x->>'num'))=lower(v_num)) then raise exception 'Invoice number already used'; end if;
  select coalesce(sum(case when coalesce(x->>'amt','') ~ '^[0-9]+([.][0-9]+)?$' then (x->>'amt')::numeric else 0 end),0) into invoiced
   from jsonb_array_elements(coalesce(q.invoices,'[]')) x where not (x ? 'care') and not (x ? 'change');
  if invoiced-private.dzoft_base_reissue_credits(p_quote)+v_amt>q.accepted_total then raise exception 'Invoices would exceed the agreed total'; end if;
  perform set_config('dzoft.receipt_write','yes',true);
  update public.quotes set invoices=coalesce(invoices,'[]')||jsonb_build_array(jsonb_build_object('id',p_invoice,'n',v_label,'num',v_num,'amt',v_amt,'u','','paid',false))
   where id=p_quote returning * into q;
  perform set_config('dzoft.receipt_write','no',true);
 end if;

 select value,ordinality::integer-1 into i,pos from jsonb_array_elements(coalesce(q.invoices,'[]')) with ordinality where value->>'id'=p_invoice;
 if i is null or i ? 'care' or coalesce(i->>'num','')='' or i->>'paid'='true' then raise exception 'Choose an unpaid numbered invoice'; end if;
 select coalesce(sum(amount),0) into already from public.project_receipts where quote_id=p_quote and invoice_id=p_invoice;
 -- Credit notes reduce what is left to pay on the invoice.
 already:=already+coalesce((select sum(amount) from public.dzoft_credit_notes where quote_id=p_quote and invoice_id=p_invoice),0);
 state:=private.project_tracking(p_quote);
 if p_amount>(i->>'amt')::numeric-already or p_amount>(state->>'remaining')::numeric then raise exception 'Amount exceeds remaining balance'; end if;
 insert into public.project_receipts values(p_id,p_quote,p_invoice,p_amount,p_date,p_method,p_reference,now(),auth.uid());
 if already+p_amount=(i->>'amt')::numeric then
  perform set_config('dzoft.receipt_write','yes',true);
  update public.quotes set invoices=jsonb_set(invoices,array[pos::text],i||jsonb_build_object('paid',true,'payment_confirmed_at',now())) where id=p_quote;
  perform set_config('dzoft.receipt_write','no',true);
 end if;
 state:=private.project_tracking(p_quote);
 perform private.queue_project_event('receipt:'||p_id,'payment_received',
 'Reçu / Received: '||p_amount||' EUR · Total reçu / Received total: '||(state->>'received')||' EUR · Reste / Remaining: '||(state->>'remaining')||' EUR. Selon échéancier / Per agreed schedule.',
 q.client_id,q.id,p_invoice_id=>p_invoice,p_notify_client=>p_notify,p_notify_owner=>p_notify);
 return state;
end $function$
;

create or replace function private.record_project_payment_unbilled(p_quote uuid, p_id uuid, p_amount numeric, p_date date, p_method text, p_reference text, p_notify boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; r public.project_receipts; state jsonb;
begin
 if auth.uid() is null or not public.is_owner() then
  raise exception 'Owner access required';
 end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null
  or q.accepted_total is null or not q.shared then
  raise exception 'An accepted shared project is required';
 end if;

 -- A retry with the exact same receipt key is harmless.
 select * into r from public.project_receipts where id=p_id;
 if found then
  if r.quote_id is distinct from p_quote or r.amount is distinct from p_amount
   or r.received_on is distinct from p_date or r.method is distinct from p_method
   or r.reference is distinct from coalesce(p_reference,'') then
   raise exception 'Receipt key already used';
  end if;
  return private.project_tracking(p_quote);
 end if;

 if p_id is null or p_amount is null or p_amount<=0
  or p_amount<>round(p_amount,2) or p_amount>9999999999.99
  or p_date is null or p_date>current_date or p_date<date '2000-01-01'
  or p_method not in ('transfer','card','cash','other') or p_method is null
  or p_reference is null or length(p_reference)>100 or p_notify is null then
  raise exception 'Invalid payment details';
 end if;

 state:=private.project_tracking(p_quote);
 if p_amount>(state->>'remaining')::numeric then
  raise exception 'Amount exceeds remaining balance';
 end if;
 insert into public.project_receipts
  (id,quote_id,invoice_id,amount,received_on,method,reference,created_at,created_by)
 values
  (p_id,p_quote,null,p_amount,p_date,p_method,p_reference,now(),auth.uid());

 state:=private.project_tracking(p_quote);
 perform private.queue_project_event(
  'receipt:'||p_id, 'payment_received',
  'Reçu / Received: '||p_amount||' EUR · Total reçu / Received total: '||
   (state->>'received')||' EUR · Reste / Remaining: '||
   (state->>'remaining')||' EUR. Facture à établir / Invoice to be issued.',
  q.client_id,q.id,
  p_invoice_id=>null,
  p_notify_client=>p_notify,p_notify_owner=>p_notify
 );
 return state;
end $function$
;

create or replace function private.record_project_receipt(p_quote uuid, p_id uuid, p_invoice text, p_amount numeric, p_date date, p_method text, p_reference text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.record_project_payment(p_quote,p_id,p_invoice,null,p_amount,p_date,p_method,p_reference,true); $function$
;

create or replace function private.report_payment(p_quote uuid, p_invoice text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; inv jsonb; pos integer;
begin
 if auth.uid() is null then raise exception 'Connectez-vous à votre espace client.'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or not q.shared or q.accepted_at is null
 or not exists(select 1 from public.clients c where c.id=q.client_id and c.user_id=auth.uid())
 then raise exception 'Facture inaccessible.'; end if;
 select value,ordinality::integer-1 into inv,pos from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) with ordinality where value->>'id'=p_invoice;
 if inv is null or coalesce(inv->>'num','')='' or coalesce((inv->>'amt')::numeric,0)<=0 then raise exception 'Facture indisponible.'; end if;
 if coalesce((inv->>'paid')::boolean,false) then return jsonb_build_object('status','received'); end if;
 if inv->>'payment_reported_at' is not null then return jsonb_build_object('status','reported'); end if;
 update public.quotes set invoices=jsonb_set(q.invoices,array[pos::text],inv||jsonb_build_object('payment_reported_at',now())) where id=q.id;
 return jsonb_build_object('status','reported');
end $function$
;

create or replace function private.requeue_client_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function private.project_sync_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

create or replace function private.save_project_work_item(p_quote uuid, p_id uuid, p_title text, p_status text, p_category text, p_source_date date, p_source_group text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

create or replace function private.sync_project_github_groups(p_quote uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function private.update_project_payment_status(p_quote uuid, p_id uuid, p_status text, p_reported_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; x public.project_payment_statuses;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or q.accepted_at is null or not q.shared
 then raise exception 'An accepted shared project is required'; end if;
 select * into x from public.project_payment_statuses where id=p_id and quote_id=p_quote for update;
 if not found then raise exception 'Payment status not found'; end if;
 if x.status in ('received','cancelled') then raise exception 'A finalized payment status cannot be changed'; end if;
 if p_status not in ('pending','sent_by_client','cancelled') or p_status is null
  or p_reported_on>current_date or p_reported_on<date '2000-01-01'
  or (p_status='sent_by_client' and p_reported_on is null)
 then raise exception 'Invalid payment status'; end if;
 update public.project_payment_statuses set
  status=p_status,reported_on=p_reported_on,updated_at=now()
 where id=p_id;
 return private.project_tracking(p_quote);
end $function$
;

create or replace function private.verify_brevo_delivery_token(p_token text, p_kind text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p_token is not null
    and p_token ~ '^[0-9a-f]{64}$'
    and p_kind in ('webhook','setup')
    and coalesce(p_token = (
      select s.decrypted_secret from vault.decrypted_secrets s
      where s.name=case p_kind when 'webhook' then 'dzoft_brevo_webhook_token'
                                     else 'dzoft_brevo_setup_token' end
      limit 1
    ),false);
$function$
;

create or replace function private.verify_project_sync_token(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_token is not null
   and length(p_token)=64
   and coalesce(p_token=(
     select decrypted_secret from vault.decrypted_secrets
     where name='dzoft_project_sync_token' limit 1
   ),false);
$function$
;

create or replace function public.admin_notify_quote(p_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function public.attach_generated_invoice_pdf(p_quote uuid, p_invoice text, p_path text, p_size bigint)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.attach_generated_invoice_pdf(p_quote,p_invoice,p_path,p_size);
$function$
;

create or replace function public.auto_issue_project_receipt_invoice(p_quote uuid, p_receipt uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.auto_issue_project_receipt_invoice(p_quote,p_receipt,p_kind);
$function$
;

create or replace function public.background_import_project_groups(p_items jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.background_import_project_groups(p_items);
$function$
;

create or replace function public.brevo_delivery_candidates(p_setup_token text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.brevo_delivery_candidates(p_setup_token);
$function$
;

create or replace function public.brevo_delivery_monitor()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.brevo_delivery_monitor();
$function$
;

create or replace function public.brevo_delivery_recent_candidates(p_setup_token text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.brevo_delivery_recent_candidates(p_setup_token);
$function$
;

create or replace function public.brevo_delivery_setup_credential(p_setup_token text)
 RETURNS text
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.brevo_delivery_setup_credential(p_setup_token);
$function$
;

create or replace function public.cancel_sign_code_reservation(p_sign_code_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from public.sign_codes where id = p_sign_code_id and used_at is null;
$function$
;

create or replace function public.claim_email_outbox(p_limit integer DEFAULT 10)
 RETURNS SETOF email_outbox
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function public.client_accept(p_client uuid, p_quote uuid, p_name text, p_terms text, p_early boolean)
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
end $function$
;

create or replace function public.client_accept_signed(p_client uuid, p_quote uuid, p_name text, p_terms text, p_early boolean, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare sc public.sign_codes; r jsonb;
begin
  select * into sc from public.sign_codes
   where quote_id = p_quote and client_id = p_client and used_at is null and change_id is null
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
end $function$
;

create or replace function public.client_message(p_client uuid, p_quote uuid, p_body text)
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
end $function$
;

create or replace function public.client_review(p_client uuid, p_quote uuid, p_rating integer, p_body text, p_name text, p_activity text, p_consent boolean)
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
end $function$
;

create or replace function public.client_validate(p_client uuid, p_quote uuid, p_step text, p_name text)
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
end $function$
;

create or replace function public.confirm_project_payment_status(p_quote uuid, p_id uuid, p_received_on date, p_notify boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.confirm_project_payment_status(p_quote,p_id,p_received_on,p_notify);
$function$
;

create or replace function public.correct_project_receipt_method(p_quote uuid, p_receipt uuid, p_method text, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.correct_project_receipt_method(p_quote,p_receipt,p_method,p_reason);
$function$
;

create or replace function public.create_project_payment_status(p_quote uuid, p_id uuid, p_amount numeric, p_method text, p_status text, p_reported_on date DEFAULT NULL::date, p_reference text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.create_project_payment_status(
  p_quote,p_id,p_amount,p_method,p_status,p_reported_on,p_reference);
$function$
;

create or replace function public.finish_email_outbox(p_id uuid, p_success boolean, p_provider_message_id text DEFAULT NULL::text, p_error text DEFAULT NULL::text, p_retryable boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function public.invoice_draft_amount(p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q public.quotes;
  already numeric;
  unbilled numeric;
  remaining numeric;
  final_exists boolean;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  select * into q from public.quotes where id=p_quote;
  if not found or q.deleted_at is not null or not q.shared or
     q.accepted_at is null or q.accepted_total is null then
    raise exception 'Accepted shared project required';
  end if;
  select coalesce(sum(case
    when coalesce(i->>'amt','') ~ '^[0-9]+([.][0-9]{1,2})?$'
    then (i->>'amt')::numeric else 0 end),0)
    into already
    from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) i
    where not(i ? 'care') and not(i ? 'change');
  select coalesce(sum(r.amount),0) into unbilled
    from public.project_receipts r
    where r.quote_id=p_quote and r.invoice_id is null;
  remaining:=greatest(round(q.accepted_total-(already-private.dzoft_base_reissue_credits(p_quote))-unbilled,2),0);
  select exists(select 1 from private.dzoft_issued_invoice_registry i
    where i.quote_id=p_quote and i.basis='final' and not i.cancelled_for_reissue) into final_exists;
  return jsonb_build_object('remaining',remaining,'has_final',final_exists,
     'base_total',q.accepted_total,'invoiced',already,'unbilled_receipts',unbilled);
end $function$
;

create or replace function public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'dzoft_owner'), '') = 'true'
    and (
      not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
      or (
        coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
        and exists (
          select 1
          from jsonb_array_elements(
            case when jsonb_typeof(auth.jwt() -> 'amr') = 'array'
              then auth.jwt() -> 'amr' else '[]'::jsonb end
          ) as amr(entry)
          where amr.entry ->> 'method' in ('totp', 'mfa/totp', 'mfa/webauthn', 'webauthn')
            and case when amr.entry ->> 'timestamp' ~ '^[0-9]{10}$' then
              to_timestamp((amr.entry ->> 'timestamp')::double precision)
                between now() - interval '7 days' and now() + interval '2 minutes'
            else false end
        )
      )
    )
$function$
;

create or replace function public.issue_accepted_invoice(p_quote uuid, p_basis text, p_change uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.issue_accepted_invoice(p_quote,p_basis,p_change);
$function$
;

create or replace function public.issue_final_invoice_checked(p_quote uuid, p_expected_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q public.quotes;
  prior private.dzoft_issued_invoice_registry;
  preview jsonb;
  balance numeric;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Owner access required';
  end if;
  if p_quote is null or p_expected_amount is null or
     p_expected_amount <= 0 or p_expected_amount <> round(p_expected_amount,2) then
    raise exception 'Invalid final invoice amount';
  end if;
  select * into q from public.quotes where id=p_quote for update;
  if not found then raise exception 'Project not found'; end if;
  select * into prior from private.dzoft_issued_invoice_registry
    where quote_id=p_quote and basis='final' and not cancelled_for_reissue;
  if found then
    if prior.amount is distinct from p_expected_amount then
      raise exception 'A different final amount was already issued';
    end if;
    return jsonb_build_object('invoice_id',prior.invoice_id,
      'number',prior.invoice_number,'issued_on',prior.issued_on,
      'amount',prior.amount,'already_issued',true);
  end if;
  preview:=public.invoice_draft_amount(p_quote);
  balance:=(preview->>'remaining')::numeric;
  if (preview->>'has_final')::boolean then
    raise exception 'A final invoice was already issued for this project';
  end if;
  if balance is distinct from p_expected_amount then
    raise exception 'Invoice balance has changed; refresh before issuing';
  end if;
  return private.issue_accepted_invoice(p_quote,'final',null);
end $function$
;

create or replace function public.issue_interim_invoice(p_quote uuid, p_amount numeric, p_request_key uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.issue_interim_invoice(p_quote,p_amount,p_request_key);
$function$
;

create or replace function public.link_project_receipt_invoice(p_quote uuid, p_receipt uuid, p_invoice text, p_new_invoice jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.link_project_receipt_invoice(p_quote,p_receipt,p_invoice,p_new_invoice);
$function$
;

create or replace function public.list_project_work_items(p_quote uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.list_project_work_items(p_quote);
$function$
;

create or replace function public.log_client_upload(p_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function public.mark_brevo_delivery_polling(p_backfill boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.mark_brevo_delivery_polling(p_backfill);
$function$
;

create or replace function public.mark_brevo_delivery_setup(p_webhook_id bigint, p_backfill boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.mark_brevo_delivery_setup(p_webhook_id,p_backfill);
$function$
;

create or replace function public.my_accept(p_quote uuid, p_name text, p_terms text DEFAULT NULL::text, p_early boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_accept(public.my_client(), p_quote, p_name, p_terms, p_early);
end $function$
;

create or replace function public.my_accept_signed(p_quote uuid, p_name text, p_terms text, p_early boolean, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_accept_signed(public.my_client(), p_quote, p_name, p_terms, p_early, p_code);
end $function$
;

create or replace function public.my_client()
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
$function$
;

create or replace function public.my_create_change_request(p_quote uuid, p_title text, p_description text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_create_change(private.dzoft_client_for_change(null,false),p_quote,p_title,p_description);
$function$
;

create or replace function public.my_decide_change_request(p_request uuid, p_version integer, p_approve boolean, p_name text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_decide_change(private.dzoft_client_for_change(null,false),p_request,p_version,p_approve,p_name);
$function$
;

create or replace function public.my_list_change_requests(p_quote uuid)
 returns jsonb language sql security definer set search_path to '' as $function$
 select private.dzoft_changes_for_client(private.dzoft_client_for_change(null,false),p_quote);
$function$
;

create or replace function public.my_message(p_quote uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_message(public.my_client(), p_quote, p_body);
end $function$
;

create or replace function public.my_report_payment(p_quote uuid, p_invoice text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.report_payment(p_quote,p_invoice); $function$
;

create or replace function public.my_review(p_quote uuid, p_rating integer, p_body text, p_name text, p_activity text, p_consent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_review(public.my_client(), p_quote, p_rating, p_body, p_name, p_activity, p_consent);
end $function$
;

create or replace function public.my_sign_change_request(p_request uuid, p_version integer, p_name text, p_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_sign_change(private.dzoft_client_for_change(null,false),p_request,p_version,p_name,p_code);
$function$
;

create or replace function public.my_space()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid := public.my_client(); r jsonb;
begin
  r := public.portal_data(cid);
  return r || jsonb_build_object('email', (select email from auth.users where id = auth.uid()));
end $function$
;

create or replace function public.my_validate(p_quote uuid, p_step text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return public.client_validate(public.my_client(), p_quote, p_step, p_name);
end $function$
;

create or replace function public.my_withdraw_change_request(p_request uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_withdraw_change(private.dzoft_client_for_change(null,false),p_request);
$function$
;

create or replace function public.owner_create_change_proposal(p_quote uuid, p_title text, p_scope text, p_extra_price numeric, p_timeline text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests; q public.quotes;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into q from public.quotes where id=p_quote;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared or q.client_id is null
 then raise exception 'Accepted project required';end if;
 p_title:=btrim(coalesce(p_title,''));p_scope:=btrim(coalesce(p_scope,''));p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_title) not between 3 and 120 or char_length(p_scope) not between 10 and 2000
  or p_extra_price is null or p_extra_price<0 or p_extra_price>1000000 or p_extra_price<>round(p_extra_price,2)
  or char_length(p_timeline)>600 then raise exception 'Invalid change proposal';end if;
 if (select count(*) from public.dzoft_change_requests where quote_id=p_quote
      and status in ('requested','proposed'))>=5 then raise exception 'Please resolve an existing open change request first';end if;
 insert into public.dzoft_change_requests(quote_id,client_id,title,description,status,
   proposed_scope,extra_price,timeline_impact,proposal_version,proposed_at)
 values(p_quote,q.client_id,p_title,'Proposition établie par DZOFT.','proposed',
   p_scope,p_extra_price,p_timeline,1,now()) returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'requested','owner',0,jsonb_build_object('title',c.title,'origin','owner'));
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',1,
  jsonb_build_object('scope',c.proposed_scope,'extra_price',c.extra_price,'timeline_impact',c.timeline_impact));
 return to_jsonb(c);
end $function$
;

create or replace function public.owner_create_priced_proposal(p_quote uuid, p_title text, p_lines jsonb, p_timeline text, p_already_done boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests; q public.quotes; t jsonb; n integer; num text; scope text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared or q.client_id is null
 then raise exception 'Accepted project required';end if;
 p_title:=btrim(coalesce(p_title,''));p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_title) not between 3 and 120 or char_length(p_timeline)>600 then
   raise exception 'Invalid change proposal';end if;
 t:=private.change_lines_total(p_lines);
 if (select count(*) from public.dzoft_change_requests where quote_id=p_quote
      and status in ('requested','proposed'))>=5 then raise exception 'Please resolve an existing open change request first';end if;
 select count(*)+1 into n from public.dzoft_change_requests where quote_id=p_quote and proposal_number is not null;
 num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
 while exists(select 1 from public.dzoft_change_requests where proposal_number=num) loop
   n:=n+1;num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
 end loop;
 select left(string_agg(x->>'label'||' : '||private.format_eur(round((x->>'qty')::numeric*(x->>'price')::numeric,2)),' ; '),2000)
   into scope from jsonb_array_elements(t->'lines') x;
 if char_length(scope)<10 then scope:=rpad(scope,10,'.'); end if;
 insert into public.dzoft_change_requests(quote_id,client_id,title,description,status,
   proposed_scope,extra_price,timeline_impact,proposal_version,proposed_at,lines,proposal_number,already_done)
 values(p_quote,q.client_id,p_title,'Proposition établie par DZOFT.','proposed',
   scope,(t->>'total')::numeric,p_timeline,1,now(),t->'lines',num,coalesce(p_already_done,false)) returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'requested','owner',0,jsonb_build_object('title',c.title,'origin','owner'));
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',1,jsonb_build_object('number',num,'lines',c.lines,'extra_price',c.extra_price,
   'timeline_impact',c.timeline_impact,'already_done',c.already_done));
 return to_jsonb(c);
end $function$
;

create or replace function public.owner_list_change_requests(p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cid uuid;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select q.client_id into cid from public.quotes q where q.id=p_quote and q.deleted_at is null;
 if cid is null then raise exception 'Project not found';end if;
 return private.dzoft_changes_for_project(cid,p_quote);
end $function$
;

create or replace function public.owner_price_change_request(p_request uuid, p_lines jsonb, p_timeline text, p_already_done boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests; q public.quotes; t jsonb; n integer; num text; scope text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'Only open requests can receive a proposal';end if;
 select * into q from public.quotes where id=c.quote_id and client_id=c.client_id for update;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared then raise exception 'Accepted project required';end if;
 p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_timeline)>600 then raise exception 'Invalid change proposal';end if;
 t:=private.change_lines_total(p_lines);
 num:=c.proposal_number;
 if num is null then
   select count(*)+1 into n from public.dzoft_change_requests where quote_id=c.quote_id and proposal_number is not null;
   num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
   while exists(select 1 from public.dzoft_change_requests where proposal_number=num) loop
     n:=n+1;num:=coalesce(nullif(btrim(q.numero),''),'DEVIS')||'-C'||n;
   end loop;
 end if;
 select left(string_agg(x->>'label'||' : '||private.format_eur(round((x->>'qty')::numeric*(x->>'price')::numeric,2)),' ; '),2000)
   into scope from jsonb_array_elements(t->'lines') x;
 if char_length(scope)<10 then scope:=rpad(scope,10,'.'); end if;
 update public.dzoft_change_requests set status='proposed',proposed_scope=scope,extra_price=(t->>'total')::numeric,
   timeline_impact=p_timeline,lines=t->'lines',proposal_number=num,already_done=coalesce(p_already_done,false),
   proposal_version=proposal_version+1,proposed_at=now(),decided_at=null,decision_name=null,
   decision_method=null,decision_target=null,sent_at=null,updated_at=now()
 where id=p_request returning * into c;
 update public.sign_codes set used_at=now() where change_id=c.id and used_at is null;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',c.proposal_version,jsonb_build_object('number',num,'lines',c.lines,
   'extra_price',c.extra_price,'timeline_impact',c.timeline_impact,'already_done',c.already_done));
 return to_jsonb(c);
end $function$
;

create or replace function public.owner_progress_change(p_request uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or not (
   (c.status='approved' and p_status in ('in_progress','completed'))
   or (c.status='in_progress' and p_status='completed')
 ) then raise exception 'Only approved changes may start, then be completed';end if;
 update public.dzoft_change_requests set status=p_status,updated_at=now()
 where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version)
 values(c.id,p_status,'owner',c.proposal_version);
 return to_jsonb(c);
end $function$
;

create or replace function public.owner_propose_change(p_request uuid, p_scope text, p_extra_price numeric, p_timeline text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare c public.dzoft_change_requests; q public.quotes;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'Only open requests can receive a proposal';end if;
 select * into q from public.quotes where id=c.quote_id and client_id=c.client_id;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared then raise exception 'Accepted project required';end if;
 p_scope:=btrim(coalesce(p_scope,''));p_timeline:=btrim(coalesce(p_timeline,''));
 if char_length(p_scope) not between 10 and 2000 or p_extra_price is null or
  p_extra_price<0 or p_extra_price>1000000 or p_extra_price<>round(p_extra_price,2)
  or char_length(p_timeline)>600 then raise exception 'Invalid change proposal';end if;
 update public.dzoft_change_requests set status='proposed',proposed_scope=p_scope,
  extra_price=p_extra_price,timeline_impact=p_timeline,
  proposal_version=proposal_version+1,proposed_at=now(),decided_at=null,decision_name=null,sent_at=null,updated_at=now()
 where id=p_request returning * into c;
 update public.sign_codes set used_at=now() where change_id=c.id and used_at is null;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'proposed','owner',c.proposal_version,
 jsonb_build_object('scope',c.proposed_scope,'extra_price',c.extra_price,'timeline_impact',c.timeline_impact));
 return to_jsonb(c);
end $function$
;

create or replace function public.owner_publish_github_progress_draft(p_quote uuid, p_batch uuid, p_hash text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes; response jsonb;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{32}$' or p_batch is null then raise exception 'Invalid draft identity';end if;
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
end $function$
;

create or replace function public.owner_refresh_github_progress_draft(p_quote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 return private.dzoft_refresh_github_progress_draft(p_quote);
end $function$
;

create or replace function public.owner_reject_change(p_request uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status not in ('requested','proposed') then raise exception 'Request is not open';end if;
 p_reason:=btrim(coalesce(p_reason,''));
 if char_length(p_reason) not between 5 and 600 then raise exception 'Please explain why this change is declined';end if;
 update public.dzoft_change_requests set status='rejected',updated_at=now() where id=p_request returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'rejected','owner',c.proposal_version,jsonb_build_object('reason',p_reason));
 return to_jsonb(c);
end $function$
;

create or replace function public.owner_send_change_proposal(p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.dzoft_change_requests; q public.quotes; ev uuid; label text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required';end if;
 select * into c from public.dzoft_change_requests where id=p_request for update;
 if not found or c.status<>'proposed' or c.proposal_version<1 then
   raise exception 'Only a proposal waiting for the client can be sent';end if;
 select * into q from public.quotes where id=c.quote_id and client_id=c.client_id;
 if not found or q.accepted_at is null or q.deleted_at is not null or not q.shared then
   raise exception 'Accepted project required';end if;
 label:=coalesce(c.proposal_number,'Proposition complémentaire');
 ev:=private.queue_project_event(
   'change:'||c.id||':v'||c.proposal_version||':'||extract(epoch from clock_timestamp())::bigint,
   'change_proposed',
   left('Proposition complémentaire '||label||' · '||private.format_eur(coalesce(c.extra_price,0))||
     ' · à lire et signer dans votre espace client, avec un code reçu par e-mail.',300),
   c.client_id,c.quote_id,null,null,null,true,true,false);
 update public.dzoft_change_requests set sent_at=now(),updated_at=now() where id=c.id returning * into c;
 insert into public.dzoft_change_events(request_id,event_type,actor_type,proposal_version,details)
 values(c.id,'sent','owner',c.proposal_version,jsonb_build_object('event',ev));
 return to_jsonb(c);
end $function$
;

create or replace function public.portal_accept(p_token uuid, p_quote uuid, p_name text, p_terms text DEFAULT NULL::text, p_early boolean DEFAULT false)
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
end
$function$
;

create or replace function public.portal_accept_signed(p_token uuid, p_quote uuid, p_name text, p_terms text, p_early boolean, p_code text)
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
end
$function$
;

create or replace function public.portal_create_change_request(p_token uuid, p_quote uuid, p_title text, p_description text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_create_change(private.dzoft_client_for_change(p_token,true),p_quote,p_title,p_description);
$function$
;

create or replace function public.portal_data(p_client uuid)
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
        'note', q.client_note, 'steps', q.steps, 'docs', q.docs, 'env', q.env,
        'invoices', coalesce((select jsonb_agg(i.value - array['emailAt','attachPdf','fileSize'] order by i.ordinality)
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
$function$
;

create or replace function public.portal_decide_change_request(p_token uuid, p_request uuid, p_version integer, p_approve boolean, p_name text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_decide_change(private.dzoft_client_for_change(p_token,true),p_request,p_version,p_approve,p_name);
$function$
;

create or replace function public.portal_get(p_token uuid)
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
end
$function$
;

create or replace function public.portal_list_change_requests(p_token uuid, p_quote uuid)
 returns jsonb language sql security definer set search_path to '' as $function$
 select private.dzoft_changes_for_client(private.dzoft_client_for_change(p_token,true),p_quote);
$function$
;

create or replace function public.portal_message(p_token uuid, p_quote uuid, p_body text)
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
end
$function$
;

create or replace function public.portal_review(p_token uuid, p_quote uuid, p_rating integer, p_body text, p_name text, p_activity text, p_consent boolean)
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
end
$function$
;

create or replace function public.portal_sign_change_request(p_token uuid, p_request uuid, p_version integer, p_name text, p_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_sign_change(private.dzoft_client_for_change(p_token,true),p_request,p_version,p_name,p_code);
$function$
;

create or replace function public.portal_validate(p_token uuid, p_quote uuid, p_step text, p_name text)
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
end
$function$
;

create or replace function public.portal_withdraw_change_request(p_token uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.dzoft_withdraw_change(private.dzoft_client_for_change(p_token,true),p_request);
$function$
;

create or replace function public.project_payment_admin_meta(p_quote uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.project_payment_admin_meta(p_quote);
$function$
;

create or replace function public.project_tracking(p_quote uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.project_tracking(p_quote); $function$
;

create or replace function public.public_reviews()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'activity', r.activity, 'rating', r.rating, 'body', r.body,
    'at', r.created_at, 'reply', r.reply) order by r.created_at desc), '[]'::jsonb)
  from (select * from public.reviews where published and consent order by created_at desc limit 30) r;
$function$
;

create or replace function public.publish_project_update(p_quote uuid, p_id uuid, p_category text, p_status text, p_summary text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.publish_project_update(p_quote,p_id,p_category,p_status,p_summary); $function$
;

create or replace function public.publish_project_updates(p_quote uuid, p_batch uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.publish_project_updates(p_quote,p_batch,p_items); $function$
;

create or replace function public.publish_project_work_item(p_quote uuid, p_id uuid, p_batch uuid, p_category text, p_summary text, p_tested boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.publish_project_work_item(p_quote,p_id,p_batch,p_category,p_summary,p_tested);
$function$
;

create or replace function public.record_brevo_delivery_event(p_message_id text, p_recipient text, p_event text, p_occurred_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.record_brevo_delivery_event(p_message_id,p_recipient,p_event,p_occurred_at);
$function$
;

create or replace function public.record_project_payment(p_quote uuid, p_id uuid, p_invoice text, p_new_invoice jsonb, p_amount numeric, p_date date, p_method text, p_reference text DEFAULT ''::text, p_notify boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.record_project_payment(p_quote,p_id,p_invoice,p_new_invoice,p_amount,p_date,p_method,p_reference,p_notify); $function$
;

create or replace function public.record_project_payment_unbilled(p_quote uuid, p_id uuid, p_amount numeric, p_date date, p_method text, p_reference text DEFAULT ''::text, p_notify boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.record_project_payment_unbilled(
  p_quote,p_id,p_amount,p_date,p_method,p_reference,p_notify);
$function$
;

create or replace function public.record_project_receipt(p_quote uuid, p_id uuid, p_invoice text, p_amount numeric, p_date date, p_method text, p_reference text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.record_project_receipt(p_quote,p_id,p_invoice,p_amount,p_date,p_method,p_reference); $function$
;

create or replace function public.register_notification_owner()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function public.reserve_change_sign_code(p_change_id uuid, p_client_id uuid, p_salt text, p_code_hash text, p_target text, p_expires_at timestamp with time zone)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare c public.dzoft_change_requests; v_recent integer; v_daily integer; v_id uuid;
begin
 select * into c from public.dzoft_change_requests
  where id=p_change_id and client_id=p_client_id and status='proposed' and sent_at is not null for update;
 if not found then return jsonb_build_object('ok',false,'reason','change'); end if;
 select count(*) into v_recent from public.sign_codes where change_id=p_change_id and created_at>=now()-interval '15 minutes';
 select count(*) into v_daily from public.sign_codes where change_id=p_change_id and created_at>=now()-interval '24 hours';
 if v_recent>=3 or v_daily>=10 then return jsonb_build_object('ok',false,'reason','rate_limit'); end if;
 insert into public.sign_codes(quote_id,client_id,channel,target,salt,code_hash,expires_at,change_id)
 values(c.quote_id,p_client_id,'email',p_target,p_salt,p_code_hash,p_expires_at,p_change_id) returning id into v_id;
 return jsonb_build_object('ok',true,'id',v_id,'number',c.proposal_number,'amount',c.extra_price,'version',c.proposal_version);
end $function$
;

create or replace function public.reserve_sign_code(p_quote_id uuid, p_client_id uuid, p_salt text, p_code_hash text, p_target text, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function public.retry_email_outbox(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

create or replace function public.project_sync_overview()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.project_sync_overview();
$function$
;

create or replace function public.save_project_work_item(p_quote uuid, p_id uuid, p_title text, p_status text, p_category text, p_source_date date DEFAULT NULL::date, p_source_group text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.save_project_work_item(p_quote,p_id,p_title,p_status,p_category,
  p_source_date,p_source_group);
$function$
;

create or replace function public.sync_project_github_groups(p_quote uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.sync_project_github_groups(p_quote,p_items);
$function$
;

create or replace function public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

create or replace function public.update_project_payment_status(p_quote uuid, p_id uuid, p_status text, p_reported_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.update_project_payment_status(p_quote,p_id,p_status,p_reported_on);
$function$
;

create or replace function public.verify_brevo_delivery_token(p_token text, p_kind text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.verify_brevo_delivery_token(p_token,p_kind);
$function$
;

create or replace function public.verify_email_outbox_cron(p_secret text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select decrypted_secret = p_secret from vault.decrypted_secrets
    where name = 'dzoft_email_outbox_cron'), false)
$function$
;

create or replace function public.verify_project_sync_token(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.verify_project_sync_token(p_token);
$function$
;

-- ---------------------------------------------------------------- avoirs (credit notes, migration 20261118120000_credit_notes.sql)
-- Une facture émise ne se modifie ni ne se supprime : elle est annulée ou réduite par un avoir
-- (série A-AAAA-NNNN, immuable). Voir aussi private.dzoft_issued_invoice_registry.cancelled_for_reissue
-- et les index partiels dzoft_issued_invoice_one_final / dzoft_issued_invoice_registry_change_id_key.

create table private.dzoft_credit_note_sequences (
  credit_year integer primary key,
  last_number bigint not null default 0
);
revoke all on private.dzoft_credit_note_sequences from public, anon, authenticated;

create table public.dzoft_credit_notes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  quote_id uuid not null,
  client_id uuid not null,
  invoice_id text not null,
  invoice_number text not null,
  invoice_issued_on date,
  invoice_amount numeric(12,2) not null,
  invoice_kind text not null check (invoice_kind in ('base','supplement')),
  amount numeric(12,2) not null check (amount > 0),
  effect text not null check (effect in ('reduce','reissue')),
  full_cancel boolean not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 600),
  issued_on date not null,
  issued_at timestamptz not null default now(),
  issued_by uuid,
  request_key uuid not null unique
);
create index dzoft_credit_notes_quote on public.dzoft_credit_notes(quote_id);
create index dzoft_credit_notes_invoice on public.dzoft_credit_notes(quote_id, invoice_id);
alter table public.dzoft_credit_notes enable row level security;
-- Aucune politique : lecture seulement par les fonctions SECURITY DEFINER (propriétaire, ou client du projet).
revoke all on public.dzoft_credit_notes from anon, authenticated;

create trigger dzoft_credit_notes_immutable before update or delete on public.dzoft_credit_notes
  for each row execute function private.dzoft_credit_notes_immutable();

create or replace function private.dzoft_credit_notes_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  raise exception 'A credit note cannot be changed or deleted';
end $function$
;

create or replace function private.dzoft_base_reissue_credits(p_quote uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(sum(amount),0) from public.dzoft_credit_notes
   where quote_id = p_quote and effect = 'reissue' and invoice_kind = 'base';
$function$
;

create or replace function private.issue_credit_note(p_quote uuid, p_invoice text, p_amount numeric, p_effect text, p_reason text, p_request_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q public.quotes; i jsonb; reg private.dzoft_issued_invoice_registry; c public.dzoft_credit_notes;
  paid numeric; credited numeric; open_amt numeric; v_amount numeric; today_paris date; yr integer; n bigint; num text;
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  p_reason := btrim(coalesce(p_reason,''));
  if p_quote is null or p_invoice is null or p_request_key is null or p_effect is null
     or p_effect not in ('reduce','reissue') or char_length(p_reason) not between 5 and 600 then
    raise exception 'Invalid credit note request';
  end if;
  -- Same request again (double click, retry): return the credit note already issued.
  select * into c from public.dzoft_credit_notes where request_key = p_request_key;
  if found then
    if c.quote_id <> p_quote or c.invoice_id <> p_invoice then raise exception 'Request key already used'; end if;
    return to_jsonb(c) - 'issued_by' - 'request_key' || jsonb_build_object('already_issued', true);
  end if;
  select * into q from public.quotes where id = p_quote for update;
  if not found or q.deleted_at is not null or q.accepted_at is null then raise exception 'Project not found'; end if;
  -- Only an invoice issued (and numbered) by DZOFT can be credited here.
  select * into reg from private.dzoft_issued_invoice_registry where quote_id = p_quote and invoice_id = p_invoice;
  if not found then raise exception 'Only an invoice issued by DZOFT can be credited'; end if;
  select value into i from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) where value->>'id' = p_invoice;
  if i is null then raise exception 'Invoice not found'; end if;
  select coalesce(sum(amount),0) into paid from public.project_receipts where quote_id = p_quote and invoice_id = p_invoice;
  select coalesce(sum(amount),0) into credited from public.dzoft_credit_notes where quote_id = p_quote and invoice_id = p_invoice;
  open_amt := reg.amount - paid - credited;
  if open_amt <= 0 then raise exception 'Nothing left to credit on this invoice'; end if;
  v_amount := coalesce(p_amount, open_amt);
  if v_amount <= 0 or v_amount <> round(v_amount,2) or v_amount > open_amt then
    raise exception 'Credit note amount must be between 0.01 and the unpaid balance of the invoice';
  end if;
  if p_effect = 'reissue' and (paid > 0 or credited > 0 or v_amount <> reg.amount) then
    raise exception 'To re-issue, cancel the whole unpaid invoice';
  end if;
  today_paris := (now() at time zone 'Europe/Paris')::date;
  yr := extract(year from today_paris)::integer;
  insert into private.dzoft_credit_note_sequences(credit_year,last_number) values(yr,0) on conflict(credit_year) do nothing;
  select last_number into n from private.dzoft_credit_note_sequences where credit_year = yr for update;
  n := n + 1;
  num := 'A-' || yr || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
  if exists(select 1 from public.dzoft_credit_notes where number = num) then
    raise exception 'Credit note number conflict; reconcile numbering before issuing';
  end if;
  update private.dzoft_credit_note_sequences set last_number = n where credit_year = yr;
  insert into public.dzoft_credit_notes(number,quote_id,client_id,invoice_id,invoice_number,invoice_issued_on,
    invoice_amount,invoice_kind,amount,effect,full_cancel,reason,issued_on,issued_by,request_key)
  values(num,p_quote,q.client_id,p_invoice,reg.invoice_number,reg.issued_on,reg.amount,
    case when i ? 'change' then 'supplement' else 'base' end,
    v_amount,p_effect,(credited + v_amount = reg.amount),p_reason,today_paris,auth.uid(),p_request_key)
  returning * into c;
  if p_effect = 'reissue' then
    update private.dzoft_issued_invoice_registry set cancelled_for_reissue = true where invoice_id = p_invoice;
  end if;
  return to_jsonb(c) - 'issued_by' - 'request_key' || jsonb_build_object('already_issued', false);
end $function$
;

create or replace function public.issue_credit_note(p_quote uuid, p_invoice text, p_amount numeric, p_effect text, p_reason text, p_request_key uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.issue_credit_note(p_quote,p_invoice,p_amount,p_effect,p_reason,p_request_key);
$function$
;

create or replace function public.owner_list_credit_notes()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) - 'issued_by' - 'request_key' order by c.issued_at)
    from public.dzoft_credit_notes c), '[]'::jsonb);
end $function$
;

revoke all on function private.dzoft_base_reissue_credits(uuid) from public, anon, authenticated;
revoke all on function private.issue_credit_note(uuid,text,numeric,text,text,uuid) from public, anon, authenticated;
revoke all on function public.issue_credit_note(uuid,text,numeric,text,text,uuid) from public, anon;
revoke all on function public.owner_list_credit_notes() from public, anon;
grant execute on function public.issue_credit_note(uuid,text,numeric,text,text,uuid) to authenticated;
grant execute on function public.owner_list_credit_notes() to authenticated;

-- ---------------------------------------------------------------- droits EXECUTE des fonctions exposées par l'API

grant execute on function admin_notify_quote(uuid) to authenticated;
grant execute on function attach_generated_invoice_pdf(uuid,text,text,bigint) to authenticated;
grant execute on function auto_issue_project_receipt_invoice(uuid,uuid,text) to authenticated;
grant execute on function background_import_project_groups(jsonb) to service_role;
grant execute on function brevo_delivery_candidates(text) to service_role;
grant execute on function brevo_delivery_monitor() to authenticated;
grant execute on function brevo_delivery_recent_candidates(text) to service_role;
grant execute on function brevo_delivery_setup_credential(text) to service_role;
grant execute on function cancel_sign_code_reservation(uuid) to service_role;
grant execute on function claim_email_outbox(integer) to service_role;
grant execute on function client_accept_signed(uuid,uuid,text,text,boolean,text) to service_role;
grant execute on function client_accept(uuid,uuid,text,text,boolean) to service_role;
grant execute on function client_message(uuid,uuid,text) to service_role;
grant execute on function client_review(uuid,uuid,integer,text,text,text,boolean) to service_role;
grant execute on function client_validate(uuid,uuid,text,text) to service_role;
grant execute on function confirm_project_payment_status(uuid,uuid,date,boolean) to authenticated;
grant execute on function correct_project_receipt_method(uuid,uuid,text,text) to authenticated;
grant execute on function create_project_payment_status(uuid,uuid,numeric,text,text,date,text) to authenticated;
grant execute on function finish_email_outbox(uuid,boolean,text,text,boolean) to service_role;
grant execute on function invoice_draft_amount(uuid) to authenticated;
grant execute on function is_owner() to authenticated;
grant execute on function issue_accepted_invoice(uuid,text,uuid) to authenticated;
grant execute on function issue_credit_note(uuid,text,numeric,text,text,uuid) to authenticated;
grant execute on function issue_final_invoice_checked(uuid,numeric) to authenticated;
grant execute on function issue_interim_invoice(uuid,numeric,uuid) to authenticated;
grant execute on function link_project_receipt_invoice(uuid,uuid,text,jsonb) to authenticated;
grant execute on function list_project_work_items(uuid) to authenticated;
grant execute on function log_client_upload(text) to authenticated;
grant execute on function mark_brevo_delivery_polling(boolean) to service_role;
grant execute on function mark_brevo_delivery_setup(bigint,boolean) to service_role;
grant execute on function my_accept_signed(uuid,text,text,boolean,text) to authenticated;
grant execute on function my_accept_signed(uuid,text,text,boolean,text) to service_role;
grant execute on function my_accept(uuid,text,text,boolean) to service_role;
grant execute on function my_create_change_request(uuid,text,text) to authenticated;
grant execute on function my_decide_change_request(uuid,integer,boolean,text) to authenticated;
grant execute on function my_list_change_requests(uuid) to authenticated;
grant execute on function my_message(uuid,text) to authenticated;
grant execute on function my_message(uuid,text) to service_role;
grant execute on function my_report_payment(uuid,text) to authenticated;
grant execute on function my_review(uuid,integer,text,text,text,boolean) to authenticated;
grant execute on function my_review(uuid,integer,text,text,text,boolean) to service_role;
grant execute on function my_sign_change_request(uuid,integer,text,text) to authenticated;
grant execute on function my_space() to authenticated;
grant execute on function my_space() to service_role;
grant execute on function my_validate(uuid,text,text) to authenticated;
grant execute on function my_validate(uuid,text,text) to service_role;
grant execute on function my_withdraw_change_request(uuid) to authenticated;
grant execute on function owner_create_change_proposal(uuid,text,text,numeric,text) to authenticated;
grant execute on function owner_create_priced_proposal(uuid,text,jsonb,text,boolean) to authenticated;
grant execute on function owner_list_change_requests(uuid) to authenticated;
grant execute on function owner_list_credit_notes() to authenticated;
grant execute on function owner_price_change_request(uuid,jsonb,text,boolean) to authenticated;
grant execute on function owner_progress_change(uuid,text) to authenticated;
grant execute on function owner_propose_change(uuid,text,numeric,text) to authenticated;
grant execute on function owner_publish_github_progress_draft(uuid,uuid,text,jsonb) to authenticated;
grant execute on function owner_refresh_github_progress_draft(uuid) to authenticated;
grant execute on function owner_reject_change(uuid,text) to authenticated;
grant execute on function owner_send_change_proposal(uuid) to authenticated;
grant execute on function portal_accept_signed(uuid,uuid,text,text,boolean,text) to anon;
grant execute on function portal_accept_signed(uuid,uuid,text,text,boolean,text) to authenticated;
grant execute on function portal_accept_signed(uuid,uuid,text,text,boolean,text) to service_role;
grant execute on function portal_accept(uuid,uuid,text,text,boolean) to service_role;
grant execute on function portal_create_change_request(uuid,uuid,text,text) to anon;
grant execute on function portal_decide_change_request(uuid,uuid,integer,boolean,text) to anon;
grant execute on function portal_get(uuid) to anon;
grant execute on function portal_get(uuid) to authenticated;
grant execute on function portal_get(uuid) to service_role;
grant execute on function portal_list_change_requests(uuid,uuid) to anon;
grant execute on function portal_message(uuid,uuid,text) to anon;
grant execute on function portal_message(uuid,uuid,text) to authenticated;
grant execute on function portal_message(uuid,uuid,text) to service_role;
grant execute on function portal_review(uuid,uuid,integer,text,text,text,boolean) to anon;
grant execute on function portal_review(uuid,uuid,integer,text,text,text,boolean) to authenticated;
grant execute on function portal_review(uuid,uuid,integer,text,text,text,boolean) to service_role;
grant execute on function portal_sign_change_request(uuid,uuid,integer,text,text) to anon;
grant execute on function portal_validate(uuid,uuid,text,text) to anon;
grant execute on function portal_validate(uuid,uuid,text,text) to authenticated;
grant execute on function portal_validate(uuid,uuid,text,text) to service_role;
grant execute on function portal_withdraw_change_request(uuid,uuid) to anon;
grant execute on function project_payment_admin_meta(uuid) to authenticated;
grant execute on function project_tracking(uuid) to authenticated;
grant execute on function public_reviews() to anon;
grant execute on function public_reviews() to authenticated;
grant execute on function public_reviews() to service_role;
grant execute on function publish_project_update(uuid,uuid,text,text,text) to authenticated;
grant execute on function publish_project_updates(uuid,uuid,jsonb) to authenticated;
grant execute on function publish_project_work_item(uuid,uuid,uuid,text,text,boolean) to authenticated;
grant execute on function record_brevo_delivery_event(text,text,text,timestamp with time zone) to service_role;
grant execute on function record_project_payment_unbilled(uuid,uuid,numeric,date,text,text,boolean) to authenticated;
grant execute on function record_project_payment(uuid,uuid,text,jsonb,numeric,date,text,text,boolean) to authenticated;
grant execute on function record_project_receipt(uuid,uuid,text,numeric,date,text,text) to authenticated;
grant execute on function register_notification_owner() to authenticated;
grant execute on function reserve_change_sign_code(uuid,uuid,text,text,text,timestamp with time zone) to service_role;
grant execute on function reserve_sign_code(uuid,uuid,text,text,text,timestamp with time zone) to service_role;
grant execute on function retry_email_outbox(uuid) to authenticated;
grant execute on function project_sync_overview() to authenticated;
grant execute on function save_project_work_item(uuid,uuid,text,text,text,date,text) to authenticated;
grant execute on function sync_project_github_groups(uuid,jsonb) to authenticated;
grant execute on function touch_updated_at() to service_role;
grant execute on function update_project_payment_status(uuid,uuid,text,date) to authenticated;
grant execute on function verify_brevo_delivery_token(text,text) to service_role;
grant execute on function verify_email_outbox_cron(text) to service_role;
grant execute on function verify_project_sync_token(text) to service_role;

-- ============================================================================
-- Ajouté après la régénération du 2026-11-17 : migration 20261117120000
-- (langue du client pour les e-mails ; chiffres de paiement par lien privé).
-- ============================================================================
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
