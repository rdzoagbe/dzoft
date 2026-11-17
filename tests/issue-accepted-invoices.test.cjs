// Invoices created from what the client accepted (balance of the signed quote, approved change):
// the server decides amount and number, the page archives the PDF and offers to send it.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const sql=read('supabase/migrations/20261115190000_issue_accepted_invoices.sql');
const admin=read('admin/suivi.html');
const changes=read('assets/change-requests.js');
const tracking=read('assets/project-tracking.js');

test('the server computes the amount; the page never sends one',()=>{
 assert.match(sql,/function private\.issue_accepted_invoice\(p_quote uuid,p_basis text,p_change uuid\)/);
 assert.match(sql,/not public\.is_owner\(\)/);
 assert.match(sql,/v_amount:=q\.accepted_total-invoiced-unbilled;/);
 assert.match(sql,/v_amount:=c\.extra_price;/);
 // Approved supplement pricing still comes from the server. Editable draft
 // amounts are checked atomically by separate owner-only RPC functions.
 assert.match(admin,/: 'issue_accepted_invoice';/);
 assert.match(admin,/p_quote: QID, p_basis: basis, p_change: change \? change.id : null/);
 assert.match(admin,/issue_final_invoice_checked/);
 assert.match(admin,/issue_interim_invoice/);
});

test('a supplement needs an approved change whose work is completed, and is issued once',()=>{
 assert.match(sql,/c\.status<>'completed' or c\.decided_at is null or c\.proposal_version<1/);
 assert.match(sql,/coalesce\(c\.extra_price,0\)<=0/);
 assert.match(sql,/change_id uuid unique/);
 assert.match(sql,/dzoft_issued_invoice_one_final/);
 assert.match(sql,/'already_issued',true/);
});

test('the accepted quote total is never rewritten and supplements do not use its invoicing room',()=>{
 assert.doesNotMatch(sql,/set\s+accepted_total/i);
 assert.match(sql,/and not \(x \? ''change''\)/);
 assert.match(sql,/and not \(i \? ''change''\)/);
 assert.match(sql,/'total',q\.accepted_total\+supp,'base_total',q\.accepted_total,'supplements',supp/);
});

test('issued invoices cannot be removed or changed by a later save',()=>{
 assert.match(sql,/create trigger dzoft_issued_invoice_amounts before update of invoices on public\.quotes/);
 assert.match(sql,/An issued invoice cannot be removed or changed/);
});

test('deposit invoices keep their own rule: issued when the deposit is received',()=>{
 assert.match(sql,/p_basis not in \('final','supplement'\)/);
 assert.doesNotMatch(sql,/'deposit'/);
});

test('the page asks before issuing and before sending, and sending reuses the existing invoice e-mail',()=>{
 const fn=admin.slice(admin.indexOf('function issueAccepted('),admin.indexOf('function updateInvoice('));
 assert.match(fn,/if \(!confirm\(ask\)\) return;/);
 assert.match(fn,/Envoyer son PDF au client et une copie à votre adresse de suivi/);
 assert.match(fn,/return mailInvoice\(x, null\);/);
 assert.ok(fn.indexOf('sb.rpc(rpc, payload, true)')<fn.indexOf('archiveIssued(x)'));
 assert.ok(fn.indexOf('archiveIssued(x)')<fn.indexOf('mailInvoice(x, null)'));
 assert.match(admin,/data-iv="final" disabled>Vérifier le montant/);
 assert.match(admin,/data-iv="confirm">Confirmer et émettre officiellement/);
 assert.match(admin,/data-iv="cancel">Annuler le brouillon/);
 assert.match(admin,/data-a="invoice-email"/);
 // The shortcuts sit outside the folded list, so they are visible without opening it.
 assert.match(admin,/var bar = \$\('iv-actions'\), h = '';/);
 assert.match(read('admin/project-workspace.js'),/Do not hide invoice issuance or sending/);
 assert.match(admin,/if \(b\.dataset\.a === 'invoice-email'\) return mailInvoice\(x, b\);/);
});

test('change card offers the invoice only for completed work with a price, and shows it once issued',()=>{
 const ctx={window:{}};vm.runInNewContext(changes,ctx);
 const root={listeners:[],addEventListener(t,f){this.listeners.push(f);},querySelector(){return holder;},querySelectorAll(){return [];},innerHTML:''};
 const holder={innerHTML:'',textContent:'',style:{},setAttribute(){}};
 const base={id:'c1',title:'Ajouts',description:'x',created_at:'2026-11-15T10:00:00Z',history:[],proposal_version:1,proposed_scope:'Périmètre',decision_name:'Client',decided_at:'2026-11-15T11:00:00Z'};
 const rows=[Object.assign({},base,{status:'completed',extra_price:500})];
 const sb={rpc:()=>Promise.resolve(rows),select:()=>Promise.resolve([{price_blocks:[]}]),update:()=>Promise.resolve([])};
 let bound=0;
 return ctx.window.DzoftChanges.owner(root,{sb,quoteId:'q',en:false,invoices:[]}).then(()=>{
  bound=root.listeners.length;
  assert.match(holder.innerHTML,/data-change-invoice="c1"/);
  assert.match(holder.innerHTML,/Créer la facture complémentaire/);
  return ctx.window.DzoftChanges.owner(root,{sb,quoteId:'q',en:false,invoices:[{change:'c1',num:'F-2026-0003',amt:500}]});
 }).then(()=>{
  assert.doesNotMatch(holder.innerHTML,/data-change-invoice=/);
  assert.match(holder.innerHTML,/F-2026-0003/);
  assert.equal(root.listeners.length,bound,'listeners are bound once, not at every reload');
  rows[0]=Object.assign({},base,{status:'approved',extra_price:500});
  return ctx.window.DzoftChanges.owner(root,{sb,quoteId:'q',en:false,invoices:[]});
 }).then(()=>{assert.doesNotMatch(holder.innerHTML,/data-change-invoice=/);});
});

test('the PDF generator accepts an invoice without a payment and describes the approved change',()=>{
 const ctx={window:{},Blob:class{constructor(parts,o){this.size=parts[0].length;this.bytes=parts[0];this.type=o.type;}},Uint8Array,URL};
 ctx.window.Blob=ctx.Blob;vm.runInNewContext(read('assets/invoice-pdf.js'),ctx);
 const quote={numero:'D-TEST',accepted_data:{f:{myaddr:'1 rue Test, 93000 Ville',cname:'Client Test',caddr:'2 rue Test, 75000 Paris',novat:true,desc:'BRIEF INITIAL'}}};
 const pdf=ctx.window.DzoftInvoicePdf.build({quote,invoice:{num:'F-2026-0009',amt:500,n:'Facture complémentaire · Ajouts',issuedOn:'2026-11-15',detail:'Complément : Ajouts. Périmètre approuvé',changeNote:'Prestations complémentaires au devis D-TEST, approuvées par Client le 15/11/2026 (proposition n° 1).'},payment:{iban:'FR76 0000'}});
 const text=Buffer.from(pdf.bytes).toString('latin1');
 assert.match(text,/Reste . payer sur cette facture : 500,00 EUR/);
 assert.match(text,/paiement . r.ception de la facture/);
 assert.match(text,/approuv.es par Client/);
 assert.doesNotMatch(text,/BRIEF INITIAL/);
 assert.doesNotMatch(text,/Paiement re.u :/);
 assert.match(tracking,/archive:archiveInvoice/);
});

test('the owner can open a proposal, but only the client approval makes it billable',()=>{
 assert.match(sql,/function public\.owner_create_change_proposal\(p_quote uuid,p_title text,p_scope text,p_extra_price numeric,p_timeline text\)/);
 const fn=sql.slice(sql.indexOf('function public.owner_create_change_proposal'));
 assert.match(fn,/not public\.is_owner\(\)/);
 assert.match(fn,/'proposed',\s*p_scope,p_extra_price,p_timeline,1,now\(\)/);
 assert.doesNotMatch(fn,/'approved'|decided_at\s*[,=]|decision_name\s*[,=]/);
 assert.match(changes,/data-change-offer/);
 assert.match(changes,/Rien n’est dû tant qu’il ne l’a pas approuvée lui-même/);
 assert.match(changes,/owner_create_priced_proposal/);
});

test('priced proposals: server totals and numbers the lines, client signs with an e-mail code',()=>{
 const mig=read('supabase/migrations/20261117090000_priced_change_proposals.sql');
 const fn=read('supabase/functions/change-sign-code/index.ts');
 const espace=read('espace/index.html');
 // The server computes the total from the lines; the browser never sends an amount.
 assert.match(mig,/t:=private\.change_lines_total\(p_lines\);/);
 assert.match(mig,/num:=coalesce\(nullif\(btrim\(q\.numero\),''\),'DEVIS'\)\|\|'-C'\|\|n;/);
 assert.doesNotMatch(changes,/p_extra_price:/);
 // Approval only through a valid, unused, unexpired code for that proposal.
 assert.match(mig,/raise exception ''Approval requires the code sent by e-mail'';/);
 assert.match(mig,/where change_id=p_request and client_id=p_client and used_at is null/);
 assert.match(mig,/if sc\.attempts>=5 then/);
 assert.match(mig,/update public\.sign_codes set used_at=now\(\) where change_id=c\.id and used_at is null;/);
 // Quote signature ignores proposal codes.
 assert.match(mig,/used_at is null and change_id is null/);
 // The code goes only to the address of the client's own file, never the owner.
 assert.match(fn,/c\.client_id !== client\.id/);
 assert.match(fn,/u\.app_metadata\?\.dzoft_owner !== true/);
 assert.match(fn,/reserve_change_sign_code/);
 assert.match(espace,/sb\.fn\('change-sign-code', \{ change_id: changeId, token: token \|\| undefined, lang: EN\(\) \? 'en' : 'fr' \}\)/);
 // Sending is an explicit owner action and goes through the outbox.
 assert.match(mig,/'change_proposed',/);
 assert.match(changes,/owner_send_change_proposal/);
 // Signed and completed work is invoiced on the project page itself, through the existing invoice tool.
 assert.match(read('admin/suivi.html'),/onInvoice:function\(record,btn\)\{ issueAccepted\('supplement',record,btn\); \}/);
 assert.match(admin,/issueAccepted\('supplement', c, null\)/);
});

test('calculate from tracking: done client requests from the journal, each billed once, with optional discount',()=>{
 const mig=read('supabase/migrations/20261117120000_change_lines_from_journal.sql');
 assert.match(changes,/data-calc-journal/);
 // Only "demande" entries since the quote was signed, done ("fait"), not "pas encore construit".
 assert.match(changes,/e\.k==='demande'/);
 assert.match(changes,/\(!since\|\|e\.d>=since\)/);
 assert.match(changes,/done=\/:\\s\*fait\\b\/i\.test\(text\)&&!\/\^pas encore\/i\.test\(text\)/);
 // A request already in a live proposal is skipped.
 assert.match(changes,/\['declined','rejected','withdrawn'\]\.indexOf\(r\.status\)<0/);
 assert.match(changes,/if\(used\[source\]\)\{skipped\+\+;return;\}/);
 // The server keeps the origin, accepts a discount, and refuses a negative total.
 assert.match(mig,/'\^journal:\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}:\[a-z0-9\]\{1,16\}\$'/);
 assert.match(mig,/if positive<=0 or total<0 then raise exception/);
 assert.match(mig,/add column if not exists default_line_price/);
 // Journal lines are not copied into the price list.
 assert.match(changes,/l\.price>0&&!l\.source&&known\.indexOf\(l\.label\)<0/);
});

test('the proposal e-mail has its own subject, text and button',()=>{
 const fn=read('supabase/functions/process-notification-outbox/index.ts');
 assert.match(fn,/subject: `Proposition complémentaire \$\{ref\} à signer/);
 assert.match(fn,/"Lire et signer la proposition"/);
 assert.match(fn,/Rien ne vous est facturé sans votre signature/);
 assert.match(fn,/subject: `Proposition \$\{ref\} signée par le client/);
});

test('price levels: each line shows the client its level and rule; « inclus » is never billed',()=>{
 const mig=read('supabase/migrations/20261117150000_price_tiers.sql');
 for(const key of ['retouche','petite','moyenne','importante','offert'])assert.match(mig,new RegExp('"key":"'+key+'"'));
 assert.match(changes,/function tierDetail\(t,when\)\{return t\?\(t\.label\+' : '\+t\.rule/);
 assert.match(changes,/if\(e\.lvl==='inclus'\)\{included\.push/);
 assert.match(changes,/var qty=Number\(e\.qty\)>0&&Number\(e\.qty\)<=1000\?Number\(e\.qty\):1;/);
 // An offered line shows « Offert » to the client, not 0,00 €.
 assert.match(changes,/var free=Number\(l\.price\)===0;/);
 assert.match(mig,/if positive<=0 or total<=0 then raise exception/);
});
