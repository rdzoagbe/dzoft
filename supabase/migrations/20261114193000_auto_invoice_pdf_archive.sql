-- The issuer is owner-only. A PDF may be linked only after it is present
-- in the existing private client-files bucket, under the actual client UID.
-- Never changes a receipt, invoice total, issued number or notification.
create or replace function private.guard_auto_invoice_pdf_immutability()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare rec record; before_invoice jsonb; after_invoice jsonb;
begin
 if new.invoices is not distinct from old.invoices then return new; end if;
 for rec in select invoice_id from private.dzoft_issued_invoice_registry
    where quote_id=new.id loop
   select value into before_invoice from jsonb_array_elements(coalesce(old.invoices,'[]'::jsonb)) where value->>'id'=rec.invoice_id;
   select value into after_invoice from jsonb_array_elements(coalesce(new.invoices,'[]'::jsonb)) where value->>'id'=rec.invoice_id;
   if before_invoice is null or after_invoice is null then
      raise exception 'Issued invoices cannot be deleted';
   end if;
   if after_invoice->>'file' is distinct from before_invoice->>'file' then
      if nullif(before_invoice->>'file','') is not null or coalesce(current_setting('dzoft.invoice_archive_write',true),'')<>'yes' then
        raise exception 'Issued invoice PDF is immutable';
      end if;
   end if;
   if after_invoice->>'n' is distinct from before_invoice->>'n'
      or after_invoice->>'issuedOn' is distinct from before_invoice->>'issuedOn'
      or after_invoice->>'generatedByDzoft' is distinct from before_invoice->>'generatedByDzoft' then
      raise exception 'Issued invoice metadata is immutable';
   end if;
 end loop;
 return new;
end $fn$;
revoke all on function private.guard_auto_invoice_pdf_immutability() from public,anon,authenticated;
drop trigger if exists dzoft_auto_invoice_pdf_immutable on public.quotes;
create trigger dzoft_auto_invoice_pdf_immutable before update of invoices on public.quotes
for each row execute function private.guard_auto_invoice_pdf_immutability();

create or replace function private.attach_generated_invoice_pdf(
 p_quote uuid,p_invoice text,p_path text,p_size bigint)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare q public.quotes; uid uuid; idx int; inv jsonb; n text; expected_path text;
begin
 if auth.uid() is null or not public.is_owner() then raise exception 'Owner access required'; end if;
 if p_quote is null or p_invoice is null or p_size is null or p_size<100 or p_size>2097152 then
   raise exception 'Invalid PDF attachment request';
 end if;
 select * into q from public.quotes where id=p_quote for update;
 if not found or q.deleted_at is not null then raise exception 'Project not found'; end if;
 select c.user_id into uid from public.clients c where c.id=q.client_id;
 if uid is null then raise exception 'Client account required for private PDF access'; end if;
 select r.invoice_number into n
 from private.dzoft_issued_invoice_registry r
 where r.quote_id=p_quote and r.invoice_id=p_invoice;
 if n is null then raise exception 'Invoice was not issued by DZOFT'; end if;
 expected_path:='u/'||uid::text||'/factures/'||p_quote::text||'/'||n||'.pdf';
 if p_path is distinct from expected_path then raise exception 'Invalid invoice PDF path'; end if;
 if not exists (select 1 from storage.objects o
   where o.bucket_id='client-files' and o.name=p_path) then
   raise exception 'Upload PDF to private Storage first';
 end if;
 select value, ordinality::int-1 into inv,idx
 from jsonb_array_elements(coalesce(q.invoices,'[]'::jsonb)) with ordinality
 where value->>'id'=p_invoice;
 if inv is null or inv->>'num'<>n or inv->>'generatedByDzoft'<>'true' then
   raise exception 'Invoice metadata mismatch';
 end if;
 if nullif(inv->>'file','') is not null then
   if inv->>'file'=p_path then
     return jsonb_build_object('path',p_path,'already_archived',true);
   end if;
   raise exception 'Issued invoice PDF cannot be replaced';
 end if;
 perform set_config('dzoft.invoice_archive_write','yes',true);
 update public.quotes set invoices=jsonb_set(invoices,array[idx::text],
   inv||jsonb_build_object('file',p_path,'fileName',n||'.pdf',
          'fileSize',p_size,'fileArchivedAt',now(),'attachPdf',false))
 where id=p_quote;
 perform set_config('dzoft.invoice_archive_write','no',true);
 return jsonb_build_object('path',p_path,'already_archived',false);
end $fn$;
create or replace function public.attach_generated_invoice_pdf(
 p_quote uuid,p_invoice text,p_path text,p_size bigint)
returns jsonb language sql security invoker set search_path='' as $fn$
 select private.attach_generated_invoice_pdf(p_quote,p_invoice,p_path,p_size);
$fn$;
revoke all on function private.attach_generated_invoice_pdf(uuid,text,text,bigint),
 public.attach_generated_invoice_pdf(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function private.attach_generated_invoice_pdf(uuid,text,text,bigint),
 public.attach_generated_invoice_pdf(uuid,text,text,bigint) to authenticated;
