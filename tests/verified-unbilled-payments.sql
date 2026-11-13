-- Run on a disposable database, OR as one BEGIN/ROLLBACK transaction.
-- No test clients, payments or email jobs must survive this test.
begin;
do $test$
declare
 owner_id uuid:=gen_random_uuid();
 other_id uuid:=gen_random_uuid();
 client_id uuid:=gen_random_uuid();
 quote_id uuid:=gen_random_uuid();
 cash_id uuid:=gen_random_uuid();
 card_id uuid:=gen_random_uuid();
 state jsonb; n integer; invoice_key text;
begin
 insert into public.clients(id,nom,email)
 values(client_id,'Unbilled payment SQL test','test-only@example.invalid');
 perform set_config(
  'request.jwt.claims',
  jsonb_build_object(
   'sub',owner_id,'role','authenticated',
   'app_metadata',jsonb_build_object('dzoft_owner',true)
  )::text,true
 );
 insert into public.quotes
  (id,client_id,numero,total,accepted_total,accepted_at,shared,invoices)
 values(quote_id,client_id,'SQL-UNBILLED-TEST',1500,1500,now(),true,'[]');

 state:=public.record_project_payment_unbilled(
   quote_id,cash_id,450,current_date,'cash','',true
 );
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050
 then raise exception 'Cash deposit calculation incorrect'; end if;
 if not exists(select 1 from public.project_receipts
    where id=cash_id and invoice_id is null)
 then raise exception 'Cash deposit was not left awaiting invoice'; end if;
 if not exists(select 1 from public.project_events
    where event_key='receipt:'||cash_id and event_type='payment_received')
 then raise exception 'Confirmed cash receipt event missing'; end if;

 -- Retry is idempotent and adds no second payment or notification event.
 perform public.record_project_payment_unbilled(
   quote_id,cash_id,450,current_date,'cash','',true
 );
 select count(*) into n from public.project_receipts where quote_id=quote_id;
 if n<>1 then raise exception 'Duplicate receipt on retry'; end if;

 -- Existing ordinary invoice edits must still work while a receipt is awaiting an invoice.
 update public.quotes
 set invoices='[{"id":"cash-inv","num":"TEST-CASH-001","n":"Facture d’acompte","amt":450,"paid":false}]'::jsonb
 where id=quote_id;
 state:=public.link_project_receipt_invoice(quote_id,cash_id,'cash-inv',null);
 if (state->>'received')::numeric<>450 or (state->>'remaining')::numeric<>1050
 then raise exception 'Linking invoice incorrectly changed money totals'; end if;
 if not exists(select 1 from public.quotes q,
   jsonb_array_elements(q.invoices) i
   where q.id=quote_id and i->>'id'='cash-inv' and i->>'paid'='true')
 then raise exception 'Paid invoice not marked settled'; end if;
 select count(*) into n from public.project_events
 where event_key='receipt:'||cash_id;
 if n<>1 then raise exception 'Linking generated duplicate receipt event'; end if;

 -- Later another payment can be linked to a freshly issued, partly paid invoice.
 state:=public.record_project_payment_unbilled(
   quote_id,card_id,200,current_date,'card','POS',false
 );
 if (state->>'received')::numeric<>650 or (state->>'remaining')::numeric<>850
 then raise exception 'Second receipt calculation incorrect'; end if;
 state:=public.link_project_receipt_invoice(quote_id,card_id,'balance-inv',
   '{"n":"Facture de solde","num":"TEST-CASH-002","amt":1050}'::jsonb);
 if (state->>'received')::numeric<>650 or (state->>'remaining')::numeric<>850
 then raise exception 'Link created a duplicate payment'; end if;
 if not exists(select 1 from public.project_receipts
   where id=card_id and invoice_id='balance-inv')
 then raise exception 'Second receipt was not linked'; end if;

 begin
  perform public.link_project_receipt_invoice(quote_id,card_id,'different',null);
  raise exception 'FAIL: a receipt was reassigned to another invoice';
 exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
 end;

 begin
  perform public.record_project_payment_unbilled(
    quote_id,gen_random_uuid(),851,current_date,'cash','',false);
  raise exception 'FAIL: overpayment recorded';
 exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
 end;

 perform set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',other_id,'role','authenticated')::text,true
 );
 begin
  perform public.record_project_payment_unbilled(
    quote_id,gen_random_uuid(),50,current_date,'cash','',false);
  raise exception 'FAIL: non-owner recorded a payment';
 exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
 end;
end $test$;
rollback;
