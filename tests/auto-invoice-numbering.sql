-- Synthetic, transactional live-schema regression. Nothing persists after rollback.
begin;
do $test$
declare
  owner_id uuid:=gen_random_uuid();
  outsider uuid:=gen_random_uuid();
  client_id uuid:=gen_random_uuid();
  q_key uuid:=gen_random_uuid();
  cash_id uuid:=gen_random_uuid();
  transfer_id uuid:=gen_random_uuid();
  first_invoice jsonb;
  retry_invoice jsonb;
  second_invoice jsonb;
  before_count integer;
  after_count integer;
  state jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',owner_id,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true)
  )::text,true);
  insert into public.clients(id,nom,email)
  values(client_id,'TEST auto invoice rollback','auto-invoice-test@example.invalid');
  insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,shared,invoices,accepted_data)
  values(q_key,client_id,'TEST-AUTO-INVOICE-ROLLBACK',1500,1500,now(),true,'[]'::jsonb,
    '{"f":{"myaddr":"Test business address, France","cname":"Test client","caddr":"Test customer address, France","novat":true}}'::jsonb
  );
  state:=public.record_project_payment_unbilled(q_key,cash_id,450,current_date,'cash','',false);
  state:=public.record_project_payment_unbilled(q_key,transfer_id,350,current_date,'transfer','',false);
  if (state->>'received')::numeric<>800 or (state->>'remaining')::numeric<>700 then
    raise exception 'Baseline amounts incorrect';
  end if;
  select count(*) into before_count from public.project_events where quote_id=q_key;
  first_invoice:=public.auto_issue_project_receipt_invoice(q_key,cash_id,'deposit');
  if first_invoice->>'number' not like 'F-'||extract(year from now() at time zone 'Europe/Paris')::int||'-%' then
    raise exception 'Wrong first invoice number format';
  end if;
  if not exists(select 1 from public.project_receipts r
    where r.id=cash_id and r.invoice_id=first_invoice->>'invoice_id') then
    raise exception 'First receipt not linked';
  end if;
  retry_invoice:=public.auto_issue_project_receipt_invoice(q_key,cash_id,'deposit');
  if retry_invoice->>'number' <> first_invoice->>'number'
    or retry_invoice->>'already_issued'<>'true' then raise exception 'Retry not idempotent'; end if;
  second_invoice:=public.auto_issue_project_receipt_invoice(q_key,transfer_id,'interim');
  if (split_part(second_invoice->>'number','-',3))::bigint
    <>(split_part(first_invoice->>'number','-',3))::bigint+1 then
    raise exception 'Invoice numbering skipped';
  end if;
  if not exists(select 1 from public.quotes q,
      jsonb_array_elements(q.invoices) i
    where q.id=q_key and i->>'num'=first_invoice->>'number'
      and i->>'paid'='true' and i->>'issuedOn' is not null) then
    raise exception 'Auto invoice not marked paid or dated';
  end if;
  state:=public.project_tracking(q_key);
  if (state->>'received')::numeric<>800 or (state->>'remaining')::numeric<>700
    then raise exception 'Invoice issuance changed received money'; end if;
  if (select count(*) from public.project_receipts where quote_id=q_key)<>2
    then raise exception 'Duplicate payment row inserted'; end if;
  select count(*) into after_count from public.project_events where quote_id=q_key;
  if after_count<>before_count then raise exception 'Issuance created notifications'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',outsider,'role','authenticated')::text,true);
  begin
    perform public.auto_issue_project_receipt_invoice(q_key,cash_id,'deposit');
    raise exception 'FAIL: non-owner issued invoice';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$test$;
rollback;
