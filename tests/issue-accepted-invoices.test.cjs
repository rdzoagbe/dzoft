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
 assert.match(admin,/data-iv="final" disabled>Créer et numéroter la facture/);
 assert.match(admin,/data-iv="send"/);
 // The shortcuts sit outside the folded list, so they are visible without opening it.
 assert.match(admin,/if \(bar\.parentNode !== card\) card\.insertBefore\(bar, card\.firstChild\)/);
 assert.match(read('admin/project-workspace.js'),/node\.id!=='iv-actions'/);
 assert.match(admin,/if \(b\.dataset\.a === 'invoice-email'\) return mailInvoice\(x, b\);/);
});

test('change card offers the invoice only for completed work with a price, and shows it once issued',()=>{
 const ctx={window:{}};vm.runInNewContext(changes,ctx);
 const root={listeners:[],addEventListener(t,f){this.listeners.push(f);},querySelector(){return holder;},innerHTML:''};
 const holder={innerHTML:'',textContent:'',style:{},setAttribute(){}};
 const base={id:'c1',title:'Ajouts',description:'x',created_at:'2026-11-15T10:00:00Z',history:[],proposal_version:1,proposed_scope:'Périmètre',decision_name:'Client',decided_at:'2026-11-15T11:00:00Z'};
 const rows=[Object.assign({},base,{status:'completed',extra_price:500})];
 const sb={rpc:()=>Promise.resolve(rows)};
 return ctx.window.DzoftChanges.owner(root,{sb,quoteId:'q',en:false,invoices:[]}).then(()=>{
  assert.match(holder.innerHTML,/data-change-invoice="c1"/);
  assert.match(holder.innerHTML,/Créer la facture complémentaire/);
  return ctx.window.DzoftChanges.owner(root,{sb,quoteId:'q',en:false,invoices:[{change:'c1',num:'F-2026-0003',amt:500}]});
 }).then(()=>{
  assert.doesNotMatch(holder.innerHTML,/data-change-invoice=/);
  assert.match(holder.innerHTML,/F-2026-0003/);
  assert.equal(root.listeners.length,3,'listeners are bound once, not at every reload');
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
});
