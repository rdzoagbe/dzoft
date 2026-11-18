-- Synthetic, transactional regression for credit notes (« avoirs »). Nothing persists after rollback.
begin;
do $test$
declare
  owner_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid();
  q1 uuid:=gen_random_uuid(); q2 uuid:=gen_random_uuid(); cash uuid:=gen_random_uuid(); pay uuid:=gen_random_uuid();
  rk uuid:=gen_random_uuid(); fin jsonb; fin2 jsonb; cn jsonb; again jsonb; st jsonb; draft jsonb; failed boolean;
  yr text:=extract(year from now() at time zone 'Europe/Paris')::int::text;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','app_metadata',jsonb_build_object('dzoft_owner',true))::text,true);
  insert into public.clients(id,nom,email) values(cid,'TEST credit notes','credit-notes@example.invalid');
  insert into public.quotes(id,client_id,numero,total,accepted_total,accepted_at,shared,invoices,accepted_data) values
   (q1,cid,'TEST-CREDIT-1',1000,1000,now(),true,'[]','{"f":{"myaddr":"Test seller, France","cname":"Test client","caddr":"Test buyer, France","novat":true}}'),
   (q2,cid,'TEST-CREDIT-2',1000,1000,now(),true,'[]','{"f":{"myaddr":"Test seller, France","cname":"Test client","caddr":"Test buyer, France","novat":true}}');

  -- 1. Partial credit note (commercial discount) on an unpaid final invoice.
  fin:=public.issue_accepted_invoice(q1,'final');
  if (fin->>'amount')::numeric<>1000 then raise exception 'Final invoice wrong: %',fin; end if;
  cn:=public.issue_credit_note(q1,fin->>'invoice_id',100,'reduce','Geste commercial accordé',rk);
  if cn->>'number' not like 'A-'||yr||'-%' or (cn->>'amount')::numeric<>100 or cn->>'invoice_number'<>fin->>'number'
     or (cn->>'full_cancel')::boolean or cn->>'invoice_issued_on' is null then raise exception 'Credit note wrong: %',cn; end if;
  st:=public.project_tracking(q1);
  if (st->>'total')::numeric<>900 or (st->>'remaining')::numeric<>900 or (st->>'credits')::numeric<>100
     or jsonb_array_length(st->'credit_notes')<>1 then raise exception 'Tracking ignores the credit note: %',st; end if;
  -- The invoice itself is never changed.
  if not exists(select 1 from public.quotes q,jsonb_array_elements(q.invoices) i where q.id=q1 and i->>'id'=fin->>'invoice_id' and (i->>'amt')::numeric=1000) then
    raise exception 'Original invoice was modified'; end if;

  -- 2. Same request key again: same credit note, no new number.
  again:=public.issue_credit_note(q1,fin->>'invoice_id',100,'reduce','Geste commercial accordé',rk);
  if again->>'number'<>cn->>'number' or not (again->>'already_issued')::boolean then raise exception 'Retry made a new credit note: %',again; end if;

  -- 3. Never more than what is still unpaid on the invoice.
  failed:=false; begin perform public.issue_credit_note(q1,fin->>'invoice_id',950,'reduce','Trop grand pour être accepté',gen_random_uuid());
  exception when others then failed:=true; end;
  if not failed then raise exception 'A credit note above the unpaid balance was accepted'; end if;

  -- 4. A payment cannot exceed the invoice minus its credit notes; paying the rest settles it.
  failed:=false; begin perform public.record_project_payment(q1,gen_random_uuid(),fin->>'invoice_id',null,1000,current_date,'transfer','',false);
  exception when others then failed:=true; end;
  if not failed then raise exception 'Payment above invoice minus credit notes was accepted'; end if;
  st:=public.record_project_payment(q1,pay,fin->>'invoice_id',null,800,current_date,'transfer','',false);
  if (st->>'remaining')::numeric<>100 then raise exception 'Remaining after payment wrong: %',st; end if;
  -- 900 owed: 800 paid, 100 still open on the invoice.
  failed:=false; begin perform public.issue_credit_note(q1,fin->>'invoice_id',101,'reduce','Plus que le reste à payer',gen_random_uuid());
  exception when others then failed:=true; end;
  if not failed then raise exception 'Credit note above the open amount after a payment was accepted'; end if;
  -- A partly paid invoice cannot be cancelled for re-issue.
  failed:=false; begin perform public.issue_credit_note(q1,fin->>'invoice_id',null,'reissue','Erreur sur la facture',gen_random_uuid());
  exception when others then failed:=true; end;
  if not failed then raise exception 'A partly paid invoice was cancelled for re-issue'; end if;

  -- 5. Error on the invoice: cancel it whole, then the final invoice can be issued again.
  fin2:=public.issue_accepted_invoice(q2,'final');
  cn:=public.issue_credit_note(q2,fin2->>'invoice_id',null,'reissue','Erreur de montant sur la facture',gen_random_uuid());
  if (cn->>'amount')::numeric<>1000 or not (cn->>'full_cancel')::boolean then raise exception 'Full cancellation wrong: %',cn; end if;
  st:=public.project_tracking(q2);
  if (st->>'total')::numeric<>1000 or (st->>'remaining')::numeric<>1000 then raise exception 'Re-issue changed what is owed: %',st; end if;
  draft:=public.invoice_draft_amount(q2);
  if (draft->>'remaining')::numeric<>1000 or (draft->>'has_final')::boolean then raise exception 'Cancelled final still blocks: %',draft; end if;
  again:=public.issue_final_invoice_checked(q2,1000);
  if again->>'number'=fin2->>'number' or (again->>'already_issued')::boolean then raise exception 'Final invoice not re-issued: %',again; end if;
  -- Nothing left to credit on the cancelled invoice.
  failed:=false; begin perform public.issue_credit_note(q2,fin2->>'invoice_id',10,'reduce','Déjà entièrement annulée',gen_random_uuid());
  exception when others then failed:=true; end;
  if not failed then raise exception 'A fully cancelled invoice was credited again'; end if;

  -- 6. Credit notes are immutable; numbers follow on without gaps.
  failed:=false; begin update public.dzoft_credit_notes set amount=1 where quote_id=q1; exception when others then failed:=true; end;
  if not failed then raise exception 'A credit note was changed'; end if;
  failed:=false; begin delete from public.dzoft_credit_notes where quote_id=q1; exception when others then failed:=true; end;
  if not failed then raise exception 'A credit note was deleted'; end if;
  if (select count(distinct number) from public.dzoft_credit_notes where quote_id in (q1,q2))<>2 then raise exception 'Credit note numbers not unique'; end if;

  -- 7. Only an invoice issued by DZOFT; owner only.
  failed:=false; begin perform public.issue_credit_note(q1,'not-an-invoice',10,'reduce','Facture inconnue ici',gen_random_uuid());
  exception when others then failed:=true; end;
  if not failed then raise exception 'An unknown invoice was credited'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
  failed:=false; begin perform public.issue_credit_note(q1,fin->>'invoice_id',10,'reduce','Tentative non autorisée',gen_random_uuid());
  exception when others then failed:=true; end;
  if not failed then raise exception 'A non-owner issued a credit note'; end if;
  failed:=false; begin perform public.owner_list_credit_notes(); exception when others then failed:=true; end;
  if not failed then raise exception 'A non-owner listed credit notes'; end if;
end
$test$;
rollback;
