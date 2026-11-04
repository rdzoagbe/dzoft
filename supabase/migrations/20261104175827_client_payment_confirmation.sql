alter table public.project_events drop constraint project_events_event_type_check;
alter table public.project_events add constraint project_events_event_type_check check(event_type in ('quote_published','quote_accepted','client_message','owner_message','step_validation_requested','step_progress','client_step_validated','invoice_shared','client_file_uploaded','review_submitted','payment_reported','payment_received','payment_reopened'));

-- Expose stable invoice IDs, but never internal email controls, to the owning client.
do $do$ declare definition text; begin
 definition := pg_get_functiondef('public.portal_data(uuid)'::regprocedure);
 if position('array[''id'',''emailAt'',''attachPdf'',''fileSize'']' in definition)=0 then raise exception 'Unexpected portal invoice projection'; end if;
 execute replace(definition,'array[''id'',''emailAt'',''attachPdf'',''fileSize'']','array[''emailAt'',''attachPdf'',''fileSize'']');
end $do$;

create or replace function private.report_payment(p_quote uuid,p_invoice text) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; inv jsonb; pos integer;
begin
 if auth.uid() is null then raise exception 'Connectez-vous à votre espace client.'; end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null or not q.shared or q.accepted_at is null
 or not exists(select 1 from public.clients c where c.id=q.client_id and c.user_id=auth.uid())
 then raise exception 'Facture inaccessible.'; end if;
 select value,ordinality::integer-1 into inv,pos from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) with ordinality where value->>'id'=p_invoice;
 if inv is null or coalesce(inv->>'num','')='' or coalesce((inv->>'amt')::numeric,0)<=0 then raise exception 'Facture indisponible.'; end if;
 if coalesce((inv->>'paid')::boolean,false) then return jsonb_build_object('status','received'); end if;
 if inv->>'payment_reported_at' is not null then return jsonb_build_object('status','reported'); end if;
 update public.quotes set invoices=jsonb_set(q.invoices,array[pos::text],inv||jsonb_build_object('payment_reported_at',now())) where id=q.id;
 return jsonb_build_object('status','reported');
end $fn$;
revoke all on function private.report_payment(uuid,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.report_payment(uuid,text) to authenticated;
create or replace function public.my_report_payment(p_quote uuid,p_invoice text) returns jsonb
language sql security invoker set search_path='' as $fn$ select private.report_payment(p_quote,p_invoice); $fn$;
revoke all on function public.my_report_payment(uuid,text) from public,anon;
grant execute on function public.my_report_payment(uuid,text) to authenticated;

create or replace function private.payment_confirmation_events() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare inv jsonb; prev jsonb; result jsonb := '[]'; was_paid boolean; paid boolean; stamp text := clock_timestamp()::text; label text;
begin
 for inv in select value from jsonb_array_elements(coalesce(new.invoices,'[]'::jsonb)) loop
  select value into prev from jsonb_array_elements(coalesce(old.invoices,'[]'::jsonb)) where value->>'id'=inv->>'id';
  if prev->>'payment_reported_at' is not null then inv:=inv||jsonb_build_object('payment_reported_at',prev->>'payment_reported_at'); end if;
  paid:=coalesce((inv->>'paid')::boolean,false); was_paid:=coalesce((prev->>'paid')::boolean,false);
  label:=left(coalesce(inv->>'n','Facture')||' · '||coalesce(inv->>'num','')||' · '||coalesce(inv->>'amt','0')||' €',200);
  if new.accepted_at is not null and coalesce(inv->>'id','')<>'' and coalesce(inv->>'num','')<>'' then
   if not paid and inv->>'payment_reported_at' is not null and prev->>'payment_reported_at' is null then
    perform private.queue_project_event('payment-reported:'||new.id||':'||(inv->>'id'),'payment_reported','Paiement déclaré envoyé par le client · '||label,new.client_id,new.id,p_invoice_id=>inv->>'id',p_notify_owner=>true);
   end if;
   if paid and not was_paid then
    if not public.is_owner() then raise exception 'Confirmation réservée à l’administrateur.'; end if;
    inv:=inv||jsonb_build_object('payment_confirmed_at',now());
    perform private.queue_project_event('payment-received:'||new.id||':'||(inv->>'id')||':'||stamp,'payment_received','Paiement reçu et confirmé par Roland · '||label,new.client_id,new.id,p_invoice_id=>inv->>'id',p_notify_client=>true,p_notify_owner=>true);
   elsif paid then
    inv:=(inv-'payment_confirmed_at')||case when prev ? 'payment_confirmed_at' then jsonb_build_object('payment_confirmed_at',prev->>'payment_confirmed_at') else '{}'::jsonb end;
   elsif was_paid then
    inv:=inv-'payment_confirmed_at';
    perform private.queue_project_event('payment-reopened:'||new.id||':'||(inv->>'id')||':'||stamp,'payment_reopened','Confirmation de paiement corrigée : vérification en cours · '||label,new.client_id,new.id,p_invoice_id=>inv->>'id',p_notify_client=>true,p_notify_owner=>true);
   else inv:=inv-'payment_confirmed_at';
   end if;
  end if;
  result:=result||jsonb_build_array(inv);
 end loop;
 new.invoices:=result;
 return new;
end $fn$;
revoke all on function private.payment_confirmation_events() from public,anon,authenticated;
create trigger quotes_payment_confirmation before update of invoices on public.quotes for each row execute function private.payment_confirmation_events();
