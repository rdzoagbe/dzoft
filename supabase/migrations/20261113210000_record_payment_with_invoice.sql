-- Record a verified payment in one step: optionally create its invoice, then the receipt.
-- Also allows re-entering an earlier payment without emailing the client (p_notify=false).
create or replace function private.record_project_payment(
 p_quote uuid, p_id uuid, p_invoice text, p_new_invoice jsonb,
 p_amount numeric, p_date date, p_method text, p_reference text, p_notify boolean)
returns jsonb language plpgsql security definer set search_path='' as $fn$
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
   from jsonb_array_elements(coalesce(q.invoices,'[]')) x where not (x ? 'care');
  if invoiced+v_amt>q.accepted_total then raise exception 'Invoices would exceed the agreed total'; end if;
  perform set_config('dzoft.receipt_write','yes',true);
  update public.quotes set invoices=coalesce(invoices,'[]')||jsonb_build_array(jsonb_build_object('id',p_invoice,'n',v_label,'num',v_num,'amt',v_amt,'u','','paid',false))
   where id=p_quote returning * into q;
  perform set_config('dzoft.receipt_write','no',true);
 end if;

 select value,ordinality::integer-1 into i,pos from jsonb_array_elements(coalesce(q.invoices,'[]')) with ordinality where value->>'id'=p_invoice;
 if i is null or i ? 'care' or coalesce(i->>'num','')='' or i->>'paid'='true' then raise exception 'Choose an unpaid numbered invoice'; end if;
 select coalesce(sum(amount),0) into already from public.project_receipts where quote_id=p_quote and invoice_id=p_invoice;
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
end $fn$;

create or replace function public.record_project_payment(
 p_quote uuid, p_id uuid, p_invoice text, p_new_invoice jsonb,
 p_amount numeric, p_date date, p_method text, p_reference text default '', p_notify boolean default true)
returns jsonb language sql security invoker set search_path='' as $fn$
 select private.record_project_payment(p_quote,p_id,p_invoice,p_new_invoice,p_amount,p_date,p_method,p_reference,p_notify); $fn$;

-- The earlier one-step RPC keeps working, now through the same code path.
create or replace function private.record_project_receipt(p_quote uuid,p_id uuid,p_invoice text,p_amount numeric,p_date date,p_method text,p_reference text) returns jsonb
language sql security definer set search_path='' as $fn$
 select private.record_project_payment(p_quote,p_id,p_invoice,null,p_amount,p_date,p_method,p_reference,true); $fn$;

revoke all on function private.record_project_payment(uuid,uuid,text,jsonb,numeric,date,text,text,boolean),
 public.record_project_payment(uuid,uuid,text,jsonb,numeric,date,text,text,boolean) from public,anon;
grant execute on function private.record_project_payment(uuid,uuid,text,jsonb,numeric,date,text,text,boolean),
 public.record_project_payment(uuid,uuid,text,jsonb,numeric,date,text,text,boolean) to authenticated;
revoke all on function private.record_project_receipt(uuid,uuid,text,numeric,date,text,text) from public,anon;
grant execute on function private.record_project_receipt(uuid,uuid,text,numeric,date,text,text) to authenticated;
