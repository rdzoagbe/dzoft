-- Synthetic, transactional regression for invoices issued from what the client accepted.
-- Nothing persists after rollback.
begin;
do $test$
declare
  owner_id uuid:=gen_random_uuid();
  outsider uuid:=gen_random_uuid();
  client_id uuid:=gen_random_uuid();
  q_key uuid:=gen_random_uuid();
  cash_id uuid:=gen_random_uuid();
  transfer_id uuid:=gen_random_uuid();
  pay_id uuid:=gen_random_uuid();
  open_change uuid:=gen_random_uuid();
  done_change uuid:=gen_random_uuid();
  free_change uuid:=gen_random_uuid();
  final_invoice jsonb;
  again jsonb;
  supp_invoice jsonb;
  dep jsonb;
  state jsonb;
  failed boolean;
  flow_change uuid;
  yr text:=extract(year from now() at time zone 'Europe/Paris')::int::text;
begin
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',owner_id,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true)
  )::text,true);
  insert into public.clients(id,nom,email)
  values(client_id,'TEST accepted invoice rollback','accepted-invoice-test@example.invalid');
  insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,shared,invoices,accepted_data)
  values(q_key,client_id,'TEST-ACCEPTED-INVOICE-ROLLBACK',1500,1500,now(),true,'[]'::jsonb,
    '{"f":{"myaddr":"Test business address, France","cname":"Test client","caddr":"Test customer address, France","novat":true}}'::jsonb
  );
  state:=public.record_project_payment_unbilled(q_key,cash_id,450,current_date,'cash','',false);
  state:=public.record_project_payment_unbilled(q_key,transfer_id,350,current_date,'transfer','',false);

  -- 1. Balance invoice = accepted total - payments that still wait for their own invoice.
  final_invoice:=public.issue_accepted_invoice(q_key,'final');
  if (final_invoice->>'amount')::numeric<>700 or final_invoice->>'number' not like 'F-'||yr||'-%'
     or final_invoice->>'already_issued'<>'false' then
    raise exception 'Balance invoice wrong: %',final_invoice; end if;
  again:=public.issue_accepted_invoice(q_key,'final');
  if again->>'number'<>final_invoice->>'number' or again->>'already_issued'<>'true' then
    raise exception 'Balance invoice not idempotent'; end if;
  if not exists(select 1 from public.quotes q,jsonb_array_elements(q.invoices) i
    where q.id=q_key and i->>'id'=final_invoice->>'invoice_id' and i->>'paid'='false'
      and i->>'generatedByDzoft'='true' and i->>'n'='Facture de solde' and not (i ? 'change')) then
    raise exception 'Balance invoice not stored as an unpaid issued invoice'; end if;
  state:=public.project_tracking(q_key);
  if (state->>'total')::numeric<>1500 or (state->>'received')::numeric<>800
     or (state->>'remaining')::numeric<>700 then
    raise exception 'Issuing an invoice changed the money ledger: %',state; end if;

  -- 2. A deposit invoice for an already received payment still fits under the accepted total.
  dep:=public.auto_issue_project_receipt_invoice(q_key,cash_id,'deposit');
  if (split_part(dep->>'number','-',3))::bigint<>(split_part(final_invoice->>'number','-',3))::bigint+1 then
    raise exception 'Numbering is not one shared sequence'; end if;

  -- 3. Supplement: only an approved change whose work is completed, with a price.
  insert into public.dzoft_change_requests(id,quote_id,client_id,title,description,status,
    proposed_scope,extra_price,proposal_version,proposed_at,decision_name,decided_at)
  values
   (open_change,q_key,client_id,'Ajout en attente','Description de test assez longue','approved',
    'Périmètre de test assez long',200,1,now(),'Test client',now()),
   (done_change,q_key,client_id,'Ajouts réalisés','Description de test assez longue','completed',
    'Périmètre de test assez long',500,1,now(),'Test client',now()),
   (free_change,q_key,client_id,'Ajout offert','Description de test assez longue','completed',
    'Périmètre de test assez long',0,1,now(),'Test client',now());
  failed:=false;
  begin perform public.issue_accepted_invoice(q_key,'supplement',open_change);
  exception when others then failed:=true; end;
  if not failed then raise exception 'A change not yet completed was invoiced'; end if;
  failed:=false;
  begin perform public.issue_accepted_invoice(q_key,'supplement',free_change);
  exception when others then failed:=true; end;
  if not failed then raise exception 'A change without extra price was invoiced'; end if;

  supp_invoice:=public.issue_accepted_invoice(q_key,'supplement',done_change);
  if (supp_invoice->>'amount')::numeric<>500 or supp_invoice->>'already_issued'<>'false' then
    raise exception 'Supplementary invoice wrong: %',supp_invoice; end if;
  again:=public.issue_accepted_invoice(q_key,'supplement',done_change);
  if again->>'number'<>supp_invoice->>'number' or again->>'already_issued'<>'true' then
    raise exception 'Supplementary invoice not idempotent'; end if;
  if not exists(select 1 from public.quotes q,jsonb_array_elements(q.invoices) i
    where q.id=q_key and i->>'id'=supp_invoice->>'invoice_id' and i->>'change'=done_change::text
      and i->>'paid'='false' and i->>'n' like 'Facture complémentaire · %') then
    raise exception 'Supplementary invoice not linked to its approved change'; end if;
  if (select accepted_total from public.quotes where id=q_key)<>1500 then
    raise exception 'The accepted quote total changed'; end if;
  state:=public.project_tracking(q_key);
  if (state->>'total')::numeric<>2000 or (state->>'base_total')::numeric<>1500
     or (state->>'supplements')::numeric<>500 or (state->>'received')::numeric<>800
     or (state->>'remaining')::numeric<>1200 then
    raise exception 'Tracking does not add the supplement on top of the quote: %',state; end if;

  -- 4. The supplement does not use up the quote's own invoicing room.
  dep:=public.auto_issue_project_receipt_invoice(q_key,transfer_id,'interim');

  -- 5. A payment on the supplementary invoice settles it.
  state:=public.record_project_payment(q_key,pay_id,supp_invoice->>'invoice_id',null,500,current_date,'transfer','',false);
  if (state->>'received')::numeric<>1300 or (state->>'remaining')::numeric<>700 then
    raise exception 'Payment on the supplementary invoice miscounted: %',state; end if;
  if not exists(select 1 from public.quotes q,jsonb_array_elements(q.invoices) i
    where q.id=q_key and i->>'id'=supp_invoice->>'invoice_id' and i->>'paid'='true') then
    raise exception 'Supplementary invoice not marked paid'; end if;

  -- 6. An issued invoice cannot be removed or changed by a later save.
  failed:=false;
  begin update public.quotes set invoices=(select jsonb_agg(i) from jsonb_array_elements(invoices) i
      where i->>'id'<>final_invoice->>'invoice_id') where id=q_key;
  exception when others then failed:=true; end;
  if not failed then raise exception 'An issued balance invoice was removed'; end if;
  failed:=false;
  begin update public.quotes set invoices=(select jsonb_agg(case when i->>'id'=final_invoice->>'invoice_id'
      then i||'{"amt":1}'::jsonb else i end) from jsonb_array_elements(invoices) i) where id=q_key;
  exception when others then failed:=true; end;
  if not failed then raise exception 'An issued balance invoice amount was changed'; end if;

  -- 7. Whole path from an owner proposal: nothing can be invoiced before the client approves and the work is done.
  state:=public.owner_create_change_proposal(q_key,'Complément proposé','Périmètre proposé par le prestataire',120,'Aucun');
  if state->>'status'<>'proposed' or (state->>'proposal_version')::int<>1 then
    raise exception 'Owner proposal not created as a proposal: %',state; end if;
  flow_change:=(state->>'id')::uuid;
  failed:=false;
  begin perform public.issue_accepted_invoice(q_key,'supplement',flow_change);
  exception when others then failed:=true; end;
  if not failed then raise exception 'A proposal the client has not approved was invoiced'; end if;
  perform private.dzoft_decide_change(client_id,flow_change,1,true,'Test client');
  perform public.owner_progress_change(flow_change,'in_progress');
  failed:=false;
  begin perform public.issue_accepted_invoice(q_key,'supplement',flow_change);
  exception when others then failed:=true; end;
  if not failed then raise exception 'Work still in progress was invoiced'; end if;
  perform public.owner_progress_change(flow_change,'completed');
  again:=public.issue_accepted_invoice(q_key,'supplement',flow_change);
  if (again->>'amount')::numeric<>120 then raise exception 'Approved amount not used: %',again; end if;

  -- 8. Owner only.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
  failed:=false;
  begin perform public.issue_accepted_invoice(q_key,'final');
  exception when others then failed:=true; end;
  if not failed then raise exception 'A non-owner issued an invoice'; end if;
  failed:=false;
  begin perform public.owner_create_change_proposal(q_key,'Complément','Périmètre proposé assez long',10,'');
  exception when others then failed:=true; end;
  if not failed then raise exception 'A non-owner created a proposal'; end if;
  raise notice 'issue-accepted-invoices: PASS';
end
$test$;
rollback;
