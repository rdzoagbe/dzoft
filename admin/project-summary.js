/* DZOFT one project page (17 Nov 2026): the summary that used to live on « Dossier client » (projet.html),
   now inside the project page (suivi.html).
   - Vue d'ensemble: client card, money tiles, scope (included services, accepted extras, pending proposals).
   - Documents: official documents as PDF (signed quote and terms, signed extra work, invoices, payment receipts).
   Read-only: figures come from the server (project_tracking, owner_list_change_requests); nothing is written here.
   suivi.html calls DzoftProjectSummary.update() after each load, so the summary follows every change. */
(function(){
'use strict';
var en=function(){return document.documentElement.lang==='en';};
var tr=function(fr,english){return en()?english:fr;};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var num=function(v){var n=Number(v);return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)?Math.round(n*100)/100:null;};
var money=function(v){return v===null||v===undefined?'—':new Intl.NumberFormat(en()?'en-GB':'fr-FR',{style:'currency',currency:'EUR'}).format(v);};
var day=function(v){if(!v)return '—';var d=new Date(String(v).length===10?v+'T12:00:00':v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(en()?'en-GB':'fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});};
var ACCEPTED=['approved','in_progress','completed'];
var state={sb:null,quote:null,client:null,tracking:null,changes:null,token:0};

function approved(){return (state.changes||[]).filter(function(r){return ACCEPTED.indexOf(r.status)>=0&&r.decided_at&&num(r.extra_price)!==null;});}
function pending(){return (state.changes||[]).filter(function(r){return r.status==='requested'||r.status==='proposed';});}
function scope(){
 var q=state.quote,d=q.accepted_data||q.data||{},lines=Array.isArray(d.lines)?d.lines:[];
 return lines.filter(function(x){return x&&!x.h&&!x.o&&String(x.l||'').trim()&&x.u!=='mois'&&x.u!=='month';}).slice(0,12).map(function(x){return x.l;});
}
function tile(label,value,tone,sub){return '<div class="ps-tile'+(tone?' '+tone:'')+'"><span>'+label+'</span><strong>'+value+'</strong>'+(sub?'<small>'+sub+'</small>':'')+'</div>';}

/* Still to receive = signed contract + signed extras − verified payments (never below 0). The server's own « remaining »
   counts an extra only once it is invoiced, so a signed extra not yet invoiced would be missing from it. */
function due(){
 var t=state.tracking,q=state.quote;if(!t||!state.changes||num(q.accepted_total)===null||num(t.received)===null)return null;
 var extras=approved().reduce(function(n,r){return n+Math.round(num(r.extra_price)*100);},0);
 return Math.max(0,Math.round(num(q.accepted_total)*100)+extras-Math.round(num(t.received)*100))/100;
}
function renderSummary(){
 var box=document.getElementById('ps-summary');if(!box||!state.quote)return;
 var q=state.quote,c=state.client||{},t=state.tracking;
 var extras=state.changes?approved().reduce(function(n,r){return n+Math.round(num(r.extra_price)*100);},0)/100:null;
 var proposed=pending().filter(function(r){return r.status==='proposed';}).reduce(function(n,r){return n+(num(r.extra_price)||0);},0);
 var initials=String(c.nom||'?').trim().split(/\s+/).slice(0,2).map(function(x){return x.charAt(0);}).join('').toUpperCase();
 var h='<div class="ps-client"><span class="ps-avatar" aria-hidden="true">'+esc(initials)+'</span><div><strong data-no-translate>'+esc(c.nom||tr('Client non relié','No client linked'))+'</strong>'+
  '<small data-no-translate>'+esc([c.entreprise,c.email,c.tel].filter(Boolean).join(' · '))+'</small></div>'+
  (q.accepted_at?'<span class="ps-badge">'+tr('Signé le ','Signed on ')+day(q.accepted_at)+'</span>':'<span class="ps-badge wait">'+tr('Devis non signé','Quote not signed')+'</span>')+'</div>';
 if(q.accepted_at){
  h+='<div class="ps-tiles">'+
   tile(tr('Contrat initial','Original contract'),money(num(q.accepted_total)))+
   tile(tr('Suppléments acceptés','Approved extras'),money(extras),'',proposed?tr('+ ','+ ')+money(proposed)+tr(' proposés, non signés',' proposed, not signed'):'')+
   tile(tr('Déjà encaissé','Received'),t?money(num(t.received)):'—','green')+
   tile(tr('Reste à encaisser','Still to receive'),money(due()),'orange')+'</div>'+
   (!t||!state.changes?'<p class="ps-note">'+tr('Certains chiffres sont indisponibles : actualisez la page.','Some figures are unavailable: reload the page.')+'</p>':'');
  var items=scope(),acc=approved(),wait=pending();
  h+='<div class="ps-scope"><div class="ps-scope-head"><h3>'+tr('Périmètre du projet','Project scope')+'</h3>'+
   '<button type="button" class="btn sm main" data-ps-new-extra>'+tr('＋ Ajouter un supplément','＋ Add extra work')+'</button></div>'+
   '<h4>'+tr('Prestations du devis signé','Services in the signed quote')+'</h4>'+
   (items.length?'<ul class="ps-lines" data-no-translate>'+items.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'<p class="ps-note">'+tr('Voir le détail dans le devis signé.','See the signed quote for details.')+'</p>')+
   (acc.length?'<h4>'+tr('Suppléments signés','Signed extra work')+'</h4><ul class="ps-lines">'+acc.map(function(r){return '<li><span data-no-translate>'+esc(r.title||'')+'</span> · <strong>'+money(num(r.extra_price))+'</strong></li>';}).join('')+'</ul>':'')+
   (wait.length?'<h4>'+tr('En attente de l’accord du client','Awaiting the client’s approval')+'</h4><ul class="ps-lines ps-wait">'+wait.map(function(r){return '<li><span data-no-translate>'+esc(r.title||'')+'</span> · '+(num(r.extra_price)===null?tr('à chiffrer','to price'):money(num(r.extra_price)))+'</li>';}).join('')+'</ul>':'')+
   '</div>';
 }
 box.innerHTML=h;
}

/* Official documents: the same documents as in the client's space, drawn from the records (assets/dzoft-documents.js). */
function entry(title,sub,action){return '<article class="ps-doc"><span class="ps-doc-icon" aria-hidden="true">▢</span><div><strong data-no-translate>'+esc(title)+'</strong>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>'+(action||'')+'</article>';}
function pdf(kind,id){return '<button type="button" class="btn sm line" data-ps-doc="'+kind+'"'+(id?' data-id="'+esc(id)+'"':'')+'>PDF</button>';}
function receipts(){return (state.tracking&&Array.isArray(state.tracking.receipts))?state.tracking.receipts:[];}
function paidFor(invoiceId){return receipts().filter(function(r){return r.invoice_id===invoiceId;}).reduce(function(n,r){return n+Number(r.amount||0);},0);}
function renderDocuments(){
 var box=document.getElementById('ps-docs');if(!box||!state.quote)return;
 var q=state.quote;
 if(!q.accepted_at){box.innerHTML='<p class="ps-note">'+tr('Les documents officiels apparaîtront ici après la signature du devis.','Official documents will appear here once the quote is signed.')+'</p>';return;}
 var f=((q.accepted_data||q.data||{}).f)||{},cgv=q.accepted_terms==='v2026-10'?'../cgv-2026-10.html':'../cgv.html',h='';
 h+='<h3 class="ps-doc-group">'+tr('Contrat','Contract')+'</h3><div class="ps-doc-list">'+
  entry(tr('Devis signé n° ','Signed quote no. ')+(f.num||q.numero||''),tr('Signé le ','Signed on ')+day(q.accepted_at)+(q.accepted_name?' · '+q.accepted_name:''),pdf('quote'))+
  entry(tr('Conditions générales acceptées','Accepted terms of sale'),q.accepted_terms?tr('Version ','Version ')+String(q.accepted_terms).replace(/^v/,''):'','<a class="btn sm line" href="'+cgv+'" target="_blank" rel="noopener">'+tr('Voir','View')+' ↗</a>')+'</div>';
 var ch=approved();
 if(ch.length)h+='<h3 class="ps-doc-group">'+tr('Compléments signés','Signed extra work')+'</h3><div class="ps-doc-list">'+ch.map(function(r){return entry((r.proposal_number?r.proposal_number+' · ':'')+(r.title||''),money(num(r.extra_price))+' · '+tr('signé le ','signed on ')+day(r.decided_at),pdf('change',r.id));}).join('')+'</div>';
 var inv=(Array.isArray(q.invoices)?q.invoices:[]).filter(function(x){return x&&(x.num||x.n);});
 h+='<h3 class="ps-doc-group">'+tr('Factures','Invoices')+'</h3>'+(inv.length?'<div class="ps-doc-list">'+inv.map(function(x){
  // « Réglée » comes from the payments recorded on the server, never from the invoice's own flag.
  var got=paidFor(x.id),settled=Number(x.amt)>0&&got>=Number(x.amt)-0.005;
  return entry((x.num?x.num+' · ':'')+(x.n||tr('Facture','Invoice')),money(num(x.amt))+' · '+(settled?tr('réglée','paid'):got>0?tr('reçu ','received ')+money(got):tr('à régler','to pay')),
   x.file?'<button type="button" class="btn sm line" data-ps-file="'+esc(x.file)+'">PDF</button>':'<small class="ps-note">'+tr('PDF pas encore archivé','PDF not archived yet')+'</small>');
 }).join('')+'</div>':'<p class="ps-note">'+tr('Aucune facture pour le moment.','No invoice yet.')+'</p>');
 var rc=receipts().slice().sort(function(a,b){return String(a.received_on).localeCompare(String(b.received_on));});
 h+='<h3 class="ps-doc-group">'+tr('Paiements reçus','Payments received')+'</h3>'+(rc.length?'<div class="ps-doc-list">'+rc.map(function(r){return entry(money(num(r.amount)),tr('Reçu le ','Received on ')+day(r.received_on),pdf('receipt',r.id));}).join('')+'</div>':'<p class="ps-note">'+tr('Aucun paiement enregistré.','No payment recorded.')+'</p>');
 box.innerHTML=h;
}
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('[data-ps-doc],[data-ps-file]');if(!b||!state.quote)return;
 if(b.dataset.psFile){var w=window.open('about:blank','_blank');state.sb.files.link(b.dataset.psFile,true).then(function(u){if(w)w.location=u;},function(){if(w)w.close();});return;}
 var D=window.DzoftDocuments;if(!D)return;
 var q=state.quote,f=((q.accepted_data||q.data||{}).f)||{},n=f.num||q.numero||'';
 try{
  if(b.dataset.psDoc==='quote')D.download(D.signedQuote(q),'Devis-signe-'+n);
  else if(b.dataset.psDoc==='change'){var r=approved().filter(function(x){return x.id===b.dataset.id;})[0];if(r)D.download(D.signedChange(r,q),'Complement-signe-'+(r.proposal_number||n));}
  else if(b.dataset.psDoc==='receipt'){var all=receipts(),rc=all.filter(function(x){return x.id===b.dataset.id;})[0];if(rc)D.download(D.paymentReceipt(rc,q,all),'Recu-paiement-'+rc.received_on+'-'+n);}
 }catch(err){alert(tr('Le document n’a pas pu être créé : ','The document could not be created: ')+(err&&err.message||''));}
});
// « Ajouter un supplément » opens the priced proposal form in Argent.
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('[data-ps-new-extra]');if(!b)return;
 if(window.DzoftProjectWorkspace&&window.DzoftProjectWorkspace.newExtra)window.DzoftProjectWorkspace.newExtra();
});

function render(){renderSummary();renderDocuments();}
/* The extra-work widget (Argent) redraws itself after creating, repricing or withdrawing a proposal. Mark the summary
   stale then, and fetch again when Vue d'ensemble or Documents is shown (not on every keystroke in the calculator). */
var stale=false;
function watchChanges(){
 var w=document.getElementById('dzoft-owner-changes');if(!w||w._psWatched||typeof MutationObserver!=='function')return;
 w._psWatched=true;new MutationObserver(function(){stale=true;}).observe(w,{childList:true,subtree:true});
}
function refreshIfStale(){watchChanges();if(stale&&window.DzoftProjectData){stale=false;update(window.DzoftProjectData);}}
function update(input){
 state.sb=input.sb;state.quote=input.Q;state.client=input.C;render();
 if(!input.Q||!input.Q.accepted_at){state.tracking=null;state.changes=[];render();return;}
 var token=++state.token,quoteId=input.QID;
 Promise.all([
  Promise.resolve(input.sb.rpc('project_tracking',{p_quote:quoteId},true)).catch(function(){return null;}),
  Promise.resolve(input.sb.rpc('owner_list_change_requests',{p_quote:quoteId},true)).catch(function(){return null;})
 ]).then(function(x){
  if(token!==state.token)return;
  state.tracking=x[0]&&typeof x[0]==='object'?x[0]:null;state.changes=Array.isArray(x[1])?x[1]:null;render();
 });
}
document.addEventListener('dzoft:locale-change',render);
window.DzoftProjectSummary={update:update,render:render,refreshIfStale:refreshIfStale};
if(window.DzoftProjectData)update(window.DzoftProjectData);
})();
