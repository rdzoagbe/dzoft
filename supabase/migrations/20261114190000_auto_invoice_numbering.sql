-- DZOFT official invoice numbering for already-confirmed project payments.
-- No receipt or notification is inserted here. A number is committed together
-- with a numbered quote invoice and the existing receipt link in ONE transaction.
create table if not exists private.dzoft_invoice_sequences (
  invoice_year integer primary key check (invoice_year between 2020 and 2200),
  last_number bigint not null check (last_number >= 0)
);
create table if not exists private.dzoft_issued_invoice_registry (
  invoice_number text primary key,
  quote_id uuid not null references public.quotes(id),
  receipt_id uuid not null unique references public.project_receipts(id),
  invoice_id text not null unique,
  issued_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  issued_by uuid not null
);
alter table private.dzoft_invoice_sequences enable row level security;
alter table private.dzoft_issued_invoice_registry enable row level security;
revoke all on private.dzoft_invoice_sequences, private.dzoft_issued_invoice_registry from public, anon, authenticated;

create or replace function private.auto_issue_project_receipt_invoice(
  p_quote uuid, p_receipt uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
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
  where not (i ? 'care');
  if inv_sum+r.amount>q.accepted_total then
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
$fn$;

create or replace function public.auto_issue_project_receipt_invoice(
  p_quote uuid, p_receipt uuid, p_kind text)
returns jsonb language sql security invoker set search_path='' as $fn$
  select private.auto_issue_project_receipt_invoice(p_quote,p_receipt,p_kind);
$fn$;
revoke all on function
  private.auto_issue_project_receipt_invoice(uuid,uuid,text),
  public.auto_issue_project_receipt_invoice(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function
  private.auto_issue_project_receipt_invoice(uuid,uuid,text),
  public.auto_issue_project_receipt_invoice(uuid,uuid,text)
  to authenticated;
