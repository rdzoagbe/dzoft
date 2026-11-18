-- DZOFT (18 Nov 2026): credit notes (« avoirs ») to cancel all or part of an issued invoice.
-- French rule (CGI art. 289-I-5; BOI-TVA-DECLA-30-20-20-20 § V; service-public.fr F23208):
-- an issued invoice is never changed or deleted; it is cancelled or reduced by a credit note that refers
-- explicitly to the original invoice (number and date), with its own number in a continuous series.
-- Roland's choices: own series A-AAAA-NNNN, full and partial credit notes.
--
-- Two effects, chosen when the credit note is issued:
--   reduce  : commercial discount / work not done. The client owes less; nothing new is invoiced.
--   reissue : error on the invoice. The whole unpaid invoice is cancelled and the amount can be invoiced again
--             (the final or extra-work invoice may then be issued anew).
-- A credit note never exceeds what is still unpaid on the invoice (no refund is created here).
-- Credit notes are immutable: no update, no delete.

create table if not exists private.dzoft_credit_note_sequences(
  credit_year integer primary key,
  last_number bigint not null default 0
);
revoke all on private.dzoft_credit_note_sequences from public, anon, authenticated;

create table if not exists public.dzoft_credit_notes(
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
create index if not exists dzoft_credit_notes_quote on public.dzoft_credit_notes(quote_id);
create index if not exists dzoft_credit_notes_invoice on public.dzoft_credit_notes(quote_id, invoice_id);
alter table public.dzoft_credit_notes enable row level security;
-- No policy: read only through the SECURITY DEFINER functions below (owner, or the client of the project).
revoke all on public.dzoft_credit_notes from anon, authenticated;

create or replace function private.dzoft_credit_notes_immutable()
 returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  raise exception 'A credit note cannot be changed or deleted';
end $f$;
drop trigger if exists dzoft_credit_notes_immutable on public.dzoft_credit_notes;
create trigger dzoft_credit_notes_immutable before update or delete on public.dzoft_credit_notes
  for each row execute function private.dzoft_credit_notes_immutable();

-- An invoice cancelled for re-issue frees its "one final invoice" / "one invoice per extra" place.
alter table private.dzoft_issued_invoice_registry
  add column if not exists cancelled_for_reissue boolean not null default false;
drop index if exists private.dzoft_issued_invoice_one_final;
create unique index dzoft_issued_invoice_one_final on private.dzoft_issued_invoice_registry(quote_id)
  where basis = 'final' and not cancelled_for_reissue;
alter table private.dzoft_issued_invoice_registry drop constraint if exists dzoft_issued_invoice_registry_change_id_key;
drop index if exists private.dzoft_issued_invoice_registry_change_id_key;
create unique index dzoft_issued_invoice_registry_change_id_key on private.dzoft_issued_invoice_registry(change_id)
  where change_id is not null and not cancelled_for_reissue;

-- Amount of the base (non-extra) invoices cancelled for re-issue: that amount can be invoiced again.
create or replace function private.dzoft_base_reissue_credits(p_quote uuid)
 returns numeric language sql stable security definer set search_path to '' as $f$
  select coalesce(sum(amount),0) from public.dzoft_credit_notes
   where quote_id = p_quote and effect = 'reissue' and invoice_kind = 'base';
$f$;
revoke all on function private.dzoft_base_reissue_credits(uuid) from public, anon, authenticated;

create or replace function private.issue_credit_note(p_quote uuid, p_invoice text, p_amount numeric,
  p_effect text, p_reason text, p_request_key uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
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
end $f$;
revoke all on function private.issue_credit_note(uuid,text,numeric,text,text,uuid) from public, anon, authenticated;

create or replace function public.issue_credit_note(p_quote uuid, p_invoice text, p_amount numeric,
  p_effect text, p_reason text, p_request_key uuid)
 returns jsonb language sql set search_path to '' as $f$
  select private.issue_credit_note(p_quote,p_invoice,p_amount,p_effect,p_reason,p_request_key);
$f$;
revoke all on function public.issue_credit_note(uuid,text,numeric,text,text,uuid) from public, anon;
grant execute on function public.issue_credit_note(uuid,text,numeric,text,text,uuid) to authenticated;

-- All credit notes, for the accounting page (owner only).
create or replace function public.owner_list_credit_notes()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) - 'issued_by' - 'request_key' order by c.issued_at)
    from public.dzoft_credit_notes c), '[]'::jsonb);
end $f$;
revoke all on function public.owner_list_credit_notes() from public, anon;
grant execute on function public.owner_list_credit_notes() to authenticated;

-- Existing invoice and payment functions take credit notes into account. Each change is an exact text
-- replacement on the live definition and must apply exactly once, or the whole migration is rolled back.
do $m$
declare
  fn text; def text; pairs text[]; k integer;
  edits jsonb := jsonb_build_object(
   'private.project_tracking(uuid)', jsonb_build_array(
     jsonb_build_array('declare q public.quotes; received numeric;',
                       'declare q public.quotes; cred_reduce numeric; cred_supp_reissue numeric; received numeric;'),
     jsonb_build_array('select coalesce(jsonb_agg(to_jsonb(r)-''created_by'' order by r.received_on desc,r.created_at desc),''[]''::jsonb)',
                       'select coalesce(sum(amount) filter (where effect=''reduce''),0), coalesce(sum(amount) filter (where effect=''reissue'' and invoice_kind=''supplement''),0) into cred_reduce, cred_supp_reissue from public.dzoft_credit_notes where quote_id=p_quote;
 select coalesce(jsonb_agg(to_jsonb(r)-''created_by'' order by r.received_on desc,r.created_at desc),''[]''::jsonb)'),
     jsonb_build_array('''total'',q.accepted_total+supp,''base_total'',q.accepted_total,''supplements'',supp,',
                       '''total'',q.accepted_total+supp-cred_supp_reissue-cred_reduce,''base_total'',q.accepted_total,''supplements'',supp-cred_supp_reissue,''credits'',cred_reduce,'),
     jsonb_build_array('''remaining'',greatest(coalesce(q.accepted_total,0)+supp-received-legacy,0),',
                       '''remaining'',greatest(coalesce(q.accepted_total,0)+supp-cred_supp_reissue-cred_reduce-received-legacy,0),
  ''credit_notes'',(select coalesce(jsonb_agg(to_jsonb(cn)-''issued_by''-''request_key'' order by cn.issued_at),''[]''::jsonb) from public.dzoft_credit_notes cn where cn.quote_id=p_quote),')),
   'private.record_project_payment(uuid,uuid,text,jsonb,numeric,date,text,text,boolean)', jsonb_build_array(
     jsonb_build_array('if invoiced+v_amt>q.accepted_total then',
                       'if invoiced-private.dzoft_base_reissue_credits(p_quote)+v_amt>q.accepted_total then'),
     jsonb_build_array('select coalesce(sum(amount),0) into already from public.project_receipts where quote_id=p_quote and invoice_id=p_invoice;',
                       'select coalesce(sum(amount),0) into already from public.project_receipts where quote_id=p_quote and invoice_id=p_invoice;
 -- Credit notes reduce what is left to pay on the invoice.
 already:=already+coalesce((select sum(amount) from public.dzoft_credit_notes where quote_id=p_quote and invoice_id=p_invoice),0);')),
   'private.link_project_receipt_invoice(uuid,uuid,text,jsonb)', jsonb_build_array(
     jsonb_build_array('if total_invoiced+v_amt>q.accepted_total then',
                       'if total_invoiced-private.dzoft_base_reissue_credits(p_quote)+v_amt>q.accepted_total then'),
     jsonb_build_array('where quote_id=p_quote and invoice_id=p_invoice;',
                       'where quote_id=p_quote and invoice_id=p_invoice;
 used:=used+coalesce((select sum(amount) from public.dzoft_credit_notes where quote_id=p_quote and invoice_id=p_invoice),0);')),
   'private.auto_issue_project_receipt_invoice(uuid,uuid,text)', jsonb_build_array(
     jsonb_build_array('if inv_sum+r.amount>q.accepted_total then',
                       'if inv_sum-private.dzoft_base_reissue_credits(p_quote)+r.amount>q.accepted_total then')),
   'private.issue_interim_invoice(uuid,numeric,uuid)', jsonb_build_array(
     jsonb_build_array('remaining:=round(q.accepted_total-already-unbilled,2);',
                       'remaining:=round(q.accepted_total-(already-private.dzoft_base_reissue_credits(p_quote))-unbilled,2);'),
     jsonb_build_array('where quote_id=p_quote and basis=''final'') then',
                       'where quote_id=p_quote and basis=''final'' and not cancelled_for_reissue) then')),
   'public.invoice_draft_amount(uuid)', jsonb_build_array(
     jsonb_build_array('remaining:=greatest(round(q.accepted_total-already-unbilled,2),0);',
                       'remaining:=greatest(round(q.accepted_total-(already-private.dzoft_base_reissue_credits(p_quote))-unbilled,2),0);'),
     jsonb_build_array('where i.quote_id=p_quote and i.basis=''final'') into final_exists;',
                       'where i.quote_id=p_quote and i.basis=''final'' and not i.cancelled_for_reissue) into final_exists;')),
   'private.issue_accepted_invoice(uuid,text,uuid)', jsonb_build_array(
     jsonb_build_array('where quote_id=p_quote and basis=''final'';',
                       'where quote_id=p_quote and basis=''final'' and not cancelled_for_reissue;'),
     jsonb_build_array('select * into prior from private.dzoft_issued_invoice_registry where change_id=p_change;',
                       'select * into prior from private.dzoft_issued_invoice_registry where change_id=p_change and not cancelled_for_reissue;'),
     jsonb_build_array('v_amount:=q.accepted_total-invoiced-unbilled;',
                       'v_amount:=q.accepted_total-(invoiced-private.dzoft_base_reissue_credits(p_quote))-unbilled;')),
   'public.issue_final_invoice_checked(uuid,numeric)', jsonb_build_array(
     jsonb_build_array('where quote_id=p_quote and basis=''final'';',
                       'where quote_id=p_quote and basis=''final'' and not cancelled_for_reissue;'))
  );
  e jsonb;
begin
  for fn in select jsonb_object_keys(edits) loop
    def := pg_get_functiondef(fn::regprocedure);
    for e in select value from jsonb_array_elements(edits->fn) loop
      k := (length(def) - length(replace(def, e->>0, ''))) / length(e->>0);
      if k <> 1 then raise exception 'Credit notes migration: % expected once in %, found %', e->>0, fn, k; end if;
      def := replace(def, e->>0, e->>1);
    end loop;
    execute def;
  end loop;
end $m$;
