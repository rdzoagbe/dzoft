-- DZOFT (18 Nov 2026) — credit notes, two fixes from review:
-- 1. The admin calls public.issue_credit_note as `authenticated`; that SQL wrapper runs with the caller's rights, so the
--    private implementation must be executable by `authenticated` too (as for the other invoice RPCs). The function
--    itself still refuses anyone but the owner with a recent second factor (is_owner()).
-- 2. « Erreur sur la facture » on a deposit/interim invoice while a final invoice is still active would leave the
--    restored amount with no way to be invoiced again (one final per project, interims refused after the final).
--    That case is refused before any credit note is created: cancel the final invoice first if it is still unpaid.
grant execute on function private.issue_credit_note(uuid,text,numeric,text,text,uuid) to authenticated;

do $m$
declare def text; o text; n text; k integer;
begin
  def := pg_get_functiondef('private.issue_credit_note(uuid,text,numeric,text,text,uuid)'::regprocedure);
  o := 'raise exception ''To re-issue, cancel the whole unpaid invoice'';
  end if;';
  n := 'raise exception ''To re-issue, cancel the whole unpaid invoice'';
  end if;
  if p_effect = ''reissue'' and reg.change_id is null and coalesce(reg.basis,'''') <> ''final''
     and exists(select 1 from private.dzoft_issued_invoice_registry f
                 where f.quote_id = p_quote and f.basis = ''final'' and not f.cancelled_for_reissue) then
    raise exception ''A final invoice is already issued: cancel it first to re-issue this invoice'';
  end if;';
  k := (length(def) - length(replace(def, o, ''))) / length(o);
  if k <> 1 then raise exception 'credit notes fix: expected once, found %', k; end if;
  execute replace(def, o, n);
end $m$;
