-- Synthetic check of proposal lines: origin from the journal, commercial discount, positive total.
begin;
do $t$ declare r jsonb; failed boolean;
begin
 r:=private.change_lines_total('[{"label":"Profils cachés","qty":1,"price":300,"source":"journal:2026-11-11:abc123","detail":"Demandé et réalisé le 11 novembre 2026"},{"label":"QR codes","qty":1,"price":250},{"label":"Remise commerciale","qty":1,"price":-50}]');
 if (r->>'total')::numeric<>500 or r->'lines'->0->>'source'<>'journal:2026-11-11:abc123' or r->'lines'->2->>'price'<>'-50' or (r->'lines'->1 ? 'source') then raise exception 'wrong %',r; end if;
 failed:=false; begin perform private.change_lines_total('[{"label":"Remise","qty":1,"price":-10}]'); exception when others then failed:=true; end;
 if not failed then raise exception 'A discount alone was accepted'; end if;
 failed:=false; begin perform private.change_lines_total('[{"label":"Ajout","qty":1,"price":10},{"label":"Remise","qty":1,"price":-20}]'); exception when others then failed:=true; end;
 if not failed then raise exception 'A negative total was accepted'; end if;
 failed:=false; begin perform private.change_lines_total('[{"label":"Ajout","qty":1,"price":10,"source":"http://example.invalid"}]'); exception when others then failed:=true; end;
 if not failed then raise exception 'An invalid line origin was accepted'; end if;
end $t$;
rollback;
