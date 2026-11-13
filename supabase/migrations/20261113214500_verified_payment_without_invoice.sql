-- DZOFT: verified payments can precede an official numbered invoice.
-- Additive change only: no existing receipts, invoices, client records or messages are deleted.
-- Keep receipts RPC-only. The existing invoice-ledger guard ignores pending (NULL) links.
alter table public.project_receipts
  alter column invoice_id drop not null;

create or replace function private.guard_receipt_invoices() returns trigger
language plpgsql security definer set search_path='' as $fn$
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
end $fn$;
revoke all on function private.guard_receipt_invoices() from public,anon,authenticated;

-- A verified receipt can be recorded without a numbered invoice.
-- Cash, bank transfer and card are handled identically and always require owner auth.
create or replace function private.record_project_payment_unbilled(
 p_quote uuid, p_id uuid, p_amount numeric, p_date date,
 p_method text, p_reference text, p_notify boolean)
returns jsonb language plpgsql security definer set search_path='' as $fn$
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
end $fn$;

create or replace function public.record_project_payment_unbilled(
 p_quote uuid, p_id uuid, p_amount numeric, p_date date,
 p_method text, p_reference text default '', p_notify boolean default true)
returns jsonb language sql security invoker set search_path='' as $fn$
 select private.record_project_payment_unbilled(
  p_quote,p_id,p_amount,p_date,p_method,p_reference,p_notify);
$fn$;

revoke all on function
 private.record_project_payment_unbilled(uuid,uuid,numeric,date,text,text,boolean),
 public.record_project_payment_unbilled(uuid,uuid,numeric,date,text,text,boolean)
from public,anon;
grant execute on function
 private.record_project_payment_unbilled(uuid,uuid,numeric,date,text,text,boolean),
 public.record_project_payment_unbilled(uuid,uuid,numeric,date,text,text,boolean)
to authenticated;

-- Later, associate the verified receipt with a numbered existing invoice,
-- or create that invoice and associate the receipt in one atomic transaction.
-- This must not create a second receipt, increase money received or send a new
-- payment-received email. Invoice PDFs can still be sent with the existing UI.
create or replace function private.link_project_receipt_invoice(
 p_quote uuid, p_receipt uuid, p_invoice text, p_new_invoice jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
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
  where not (x ? 'care');
  if total_invoiced+v_amt>q.accepted_total then
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
end $fn$;

create or replace function public.link_project_receipt_invoice(
 p_quote uuid,p_receipt uuid,p_invoice text,p_new_invoice jsonb default null)
returns jsonb language sql security invoker set search_path='' as $fn$
 select private.link_project_receipt_invoice(p_quote,p_receipt,p_invoice,p_new_invoice);
$fn$;
revoke all on function
 private.link_project_receipt_invoice(uuid,uuid,text,jsonb),
 public.link_project_receipt_invoice(uuid,uuid,text,jsonb)
from public,anon;
grant execute on function
 private.link_project_receipt_invoice(uuid,uuid,text,jsonb),
 public.link_project_receipt_invoice(uuid,uuid,text,jsonb)
to authenticated;
