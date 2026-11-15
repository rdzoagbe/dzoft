-- DZOFT: issue an official numbered invoice from what the client accepted,
-- without waiting for a payment:
--   'final'      = balance of the accepted quote, issued once the service is delivered;
--   'supplement' = extra price of an approved change request whose work is completed.
-- Deposit invoices keep their own rule: they are issued when the deposit is received
-- (auto_issue_project_receipt_invoice). CGI art. 289 : la facture est émise dès la
-- réalisation de la prestation ; pour les acomptes, lorsqu'ils sont versés.
-- The accepted quote total never changes. No receipt and no e-mail is created here.

alter table private.dzoft_issued_invoice_registry alter column receipt_id drop not null;
alter table private.dzoft_issued_invoice_registry
  add column if not exists basis text not null default 'receipt',
  add column if not exists change_id uuid unique references public.dzoft_change_requests(id);
alter table private.dzoft_issued_invoice_registry drop constraint if exists dzoft_issued_invoice_basis_check;
alter table private.dzoft_issued_invoice_registry add constraint dzoft_issued_invoice_basis_check check (
  (basis='receipt' and receipt_id is not null and change_id is null)
  or (basis='final' and receipt_id is null and change_id is null)
  or (basis='supplement' and receipt_id is null and change_id is not null));
-- One balance invoice per accepted quote.
create unique index if not exists dzoft_issued_invoice_one_final
  on private.dzoft_issued_invoice_registry(quote_id) where basis='final';

create or replace function private.issue_accepted_invoice(p_quote uuid,p_basis text,p_change uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
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
      where quote_id=p_quote and basis='final';
  else
    select * into prior from private.dzoft_issued_invoice_registry where change_id=p_change;
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
    v_amount:=q.accepted_total-invoiced-unbilled;
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
$fn$;

create or replace function public.issue_accepted_invoice(p_quote uuid,p_basis text,p_change uuid default null)
returns jsonb language sql security invoker set search_path='' as $fn$
  select private.issue_accepted_invoice(p_quote,p_basis,p_change);
$fn$;
revoke all on function private.issue_accepted_invoice(uuid,text,uuid),
  public.issue_accepted_invoice(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.issue_accepted_invoice(uuid,text,uuid),
  public.issue_accepted_invoice(uuid,text,uuid) to authenticated;

-- An issued invoice keeps its amount and number, whether or not a payment is recorded yet.
create or replace function private.guard_issued_invoice_amounts()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare rec record; before_invoice jsonb; after_invoice jsonb;
begin
 if new.invoices is not distinct from old.invoices then return new; end if;
 for rec in select invoice_id from private.dzoft_issued_invoice_registry
    where quote_id=new.id and basis<>'receipt' loop
   select value into before_invoice from jsonb_array_elements(coalesce(old.invoices,'[]'::jsonb)) where value->>'id'=rec.invoice_id;
   select value into after_invoice from jsonb_array_elements(coalesce(new.invoices,'[]'::jsonb)) where value->>'id'=rec.invoice_id;
   if before_invoice is null then continue; end if;
   if after_invoice is null
      or after_invoice->>'amt' is distinct from before_invoice->>'amt'
      or after_invoice->>'num' is distinct from before_invoice->>'num'
      or after_invoice->>'change' is distinct from before_invoice->>'change' then
      raise exception 'An issued invoice cannot be removed or changed';
   end if;
 end loop;
 return new;
end $fn$;
revoke all on function private.guard_issued_invoice_amounts() from public,anon,authenticated;
drop trigger if exists dzoft_issued_invoice_amounts on public.quotes;
create trigger dzoft_issued_invoice_amounts before update of invoices on public.quotes
for each row execute function private.guard_issued_invoice_amounts();

-- Supplementary invoices are billed on top of the accepted quote: they must not
-- use up the room left for the quote's own invoices.
do $do$
declare d text; fn regprocedure; old_text text; new_text text;
begin
 foreach fn in array array[
   'private.record_project_payment(uuid,uuid,text,jsonb,numeric,date,text,text,boolean)'::regprocedure,
   'private.link_project_receipt_invoice(uuid,uuid,text,jsonb)'::regprocedure,
   'private.auto_issue_project_receipt_invoice(uuid,uuid,text)'::regprocedure] loop
  d:=pg_get_functiondef(fn);
  if position('''change''' in d)>0 then continue; end if;
  if fn::text like '%auto_issue_project_receipt_invoice%' then
    old_text:='where not (i ? ''care'');'; new_text:='where not (i ? ''care'') and not (i ? ''change'');';
  else
    old_text:='where not (x ? ''care'');'; new_text:='where not (x ? ''care'') and not (x ? ''change'');';
  end if;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then
    raise exception 'Unexpected invoice cap in %',fn;
  end if;
  execute replace(d,old_text,new_text);
 end loop;
end $do$;

-- Tracking: the amount to receive is the accepted quote plus the supplementary
-- invoices issued for approved changes. The quote's own total stays visible.
create or replace function private.project_tracking(p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; received numeric; legacy numeric; supp numeric; rows jsonb; reports jsonb;
begin
 select * into q from public.quotes where id=p_quote and deleted_at is null;
 if not found or auth.uid() is null or not (public.is_owner() or
   (q.shared and q.accepted_at is not null and exists(
     select 1 from public.clients c where c.id=q.client_id and c.user_id=auth.uid())))
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
  'total',q.accepted_total+supp,'base_total',q.accepted_total,'supplements',supp,
  'received',received+legacy,'legacy',legacy,
  'remaining',greatest(coalesce(q.accepted_total,0)+supp-received-legacy,0),
  'receipts',rows,'payment_statuses',reports,
  'updates',(select coalesce(jsonb_agg(to_jsonb(u)-'created_by' order by u.created_at desc),'[]'::jsonb)
    from public.project_updates u where quote_id=p_quote)
 );
end $fn$;

-- The owner can open the proposal himself (extra work discussed outside the portal).
-- It is only a proposal: nothing is owed until the client approves it in his space.
create or replace function public.owner_create_change_proposal(p_quote uuid,p_title text,p_scope text,p_extra_price numeric,p_timeline text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
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
end $fn$;
revoke all on function public.owner_create_change_proposal(uuid,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.owner_create_change_proposal(uuid,text,text,numeric,text) to authenticated;
