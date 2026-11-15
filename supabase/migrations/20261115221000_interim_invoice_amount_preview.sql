-- DZOFT: keep official invoice numbers immutable; allow an owner to choose a
-- PARTIAL, INTERIM invoice amount BEFORE issuance. Nothing is reissued, emailed,
-- altered or renumbered by this migration.
--
-- A normal full-balance "final" invoice still uses issue_accepted_invoice,
-- an approved change keeps the price approved by the customer, and a deposit
-- invoice still equals the confirmed payment. No override of those amounts.
-- Partial invoice numbers are allocated atomically from the existing sequence.
-- A stable request UUID prevents duplicate issue on retry.

alter table private.dzoft_issued_invoice_registry
  add column if not exists request_key uuid;
create unique index if not exists dzoft_issued_invoice_request_key_unique
  on private.dzoft_issued_invoice_registry(request_key)
  where request_key is not null;

alter table private.dzoft_issued_invoice_registry
  drop constraint if exists dzoft_issued_invoice_basis_check;
alter table private.dzoft_issued_invoice_registry
  add constraint dzoft_issued_invoice_basis_check check (
    (basis='receipt' and receipt_id is not null and change_id is null)
    or (basis in ('final','interim') and receipt_id is null and change_id is null)
    or (basis='supplement' and receipt_id is null and change_id is not null)
  );

-- Note: no arbitrary changes to the signed quote or previously issued invoices.
-- All calculations mirror issue_accepted_invoice's existing ceiling logic.
create or replace function public.invoice_draft_amount(p_quote uuid)
returns jsonb
language plpgsql security definer set search_path='' as $fn$
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
  remaining:=greatest(round(q.accepted_total-already-unbilled,2),0);
  select exists(select 1 from private.dzoft_issued_invoice_registry i
    where i.quote_id=p_quote and i.basis='final') into final_exists;
  return jsonb_build_object('remaining',remaining,'has_final',final_exists,
     'base_total',q.accepted_total,'invoiced',already,'unbilled_receipts',unbilled);
end $fn$;

revoke all on function public.invoice_draft_amount(uuid)
  from public,anon,authenticated;
grant execute on function public.invoice_draft_amount(uuid) to authenticated;

-- This function only issues an INTERIM invoice with a positive amount strictly
-- LESS than the remaining contracted balance. If the amount is the whole balance,
-- use issue_accepted_invoice(..., 'final', null), which is idempotent by quote.
create or replace function private.issue_interim_invoice(
    p_quote uuid,p_amount numeric,p_request_key uuid)
returns jsonb
language plpgsql security definer set search_path='' as $fn$
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
            where quote_id=p_quote and basis='final') then
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
  remaining:=round(q.accepted_total-already-unbilled,2);
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
end $fn$;

create or replace function public.issue_interim_invoice(
    p_quote uuid,p_amount numeric,p_request_key uuid)
returns jsonb language sql security invoker set search_path='' as $fn$
  select private.issue_interim_invoice(p_quote,p_amount,p_request_key);
$fn$;
revoke all on function private.issue_interim_invoice(uuid,numeric,uuid),
  public.issue_interim_invoice(uuid,numeric,uuid) from public,anon,authenticated;
grant execute on function private.issue_interim_invoice(uuid,numeric,uuid),
  public.issue_interim_invoice(uuid,numeric,uuid) to authenticated;

-- Official invoices of EVERY basis (including receipt/deposit invoices) must
-- keep their issued number and amount. The earlier guard covered only the
-- final/supplement basis, unintentionally leaving receipt invoices editable.
create or replace function private.guard_issued_invoice_amounts()
returns trigger language plpgsql security definer set search_path='' as $fn$
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
end $fn$;
revoke all on function private.guard_issued_invoice_amounts()
  from public,anon,authenticated;
