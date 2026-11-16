/* DZOFT Admin project finance — read-only dashboard over existing trusted RPCs.
   New supplementary proposals use the existing DzoftChanges owner workflow;
   invoice issuance remains in suivi.html under its existing server guard.
   Never auto-approve extra work or treat "issued" as "paid". */
(function(){
"use strict";
var sb=window.RDsb, $=function(id){return document.getElementById(id);};
var id=new URLSearchParams(location.search).get("q");
var validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||"");
if(!sb||!sb.session()||!validId){location.replace("./");return;}
var initialPanel=location.hash.slice(1);
var validPanels=["overview","quotes","invoices","payments","extras","activity"];
var state={quote:null,client:null,changes:null,tracking:null,events:[],section:validPanels.includes(initialPanel)?initialPanel:"overview",busy:false,modalInitialized:false,readError:null};
var acceptedStates=["approved","in_progress","completed"];
var en=function(){return document.documentElement.lang==="en";};
var tr=function(fr,english){return en()?english:fr;};
var money=function(v){return typeof v==="number"&&Number.isFinite(v)?new Intl.NumberFormat(en()?"en-GB":"fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(v):"—";};
var amount=function(v){var n=Number(v);return v!==null&&v!==undefined&&v!==""&&Number.isFinite(n)?Math.round(n*100)/100:null;};
var esc=function(v){return String(v===null||v===undefined?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
var day=function(v){if(!v)return "—";var d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString(en()?"en-GB":"fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"});};
var isApproved=function(r){return acceptedStates.includes(r.status)&&r.decided_at&&amount(r.extra_price)!==null;};
var quoteUrl=function(){return "devis.html?q="+encodeURIComponent(id);};
var projectUrl=function(hash){return "suivi.html?q="+encodeURIComponent(id)+(hash?"#"+hash:"");};
var clientName=function(){var c=state.client||{};return c.nom||tr("Client","Client");};
function status(r){
 var states={
  requested:tr("À étudier","To review"),proposed:tr("En attente d’accord","Awaiting approval"),
  approved:tr("Accepté","Approved"),in_progress:tr("En cours","In progress"),completed:tr("Terminé","Completed"),
  declined:tr("Refusé","Declined"),rejected:tr("Non retenu","Rejected"),withdrawn:tr("Retiré","Withdrawn")};
 return states[r.status]||tr("À vérifier","Needs review");
}
function badge(text,tone){return '<span class="pf-tag '+(tone||"")+'">'+esc(text)+'</span>';}
function showError(message){
 $("pf-loading").hidden=false;
 $("pf-loading").textContent=message;
 $("pf-shell").hidden=true;
}
function totals(){
 var q=state.quote||{},t=state.tracking||{},records=state.changes||[];
 var base=amount(q.accepted_total);
 var received=amount(t.received);
 var extras=records.filter(isApproved).reduce(function(n,r){return n+(amount(r.extra_price)||0);},0);
 var proposed=records.filter(function(r){return r.status==="proposed";}).reduce(function(n,r){return n+(amount(r.extra_price)||0);},0);
 var committed=base===null||!state.changes?null:Math.round((base+extras)*100)/100;
 var due=committed===null||received===null?null:Math.max(0,Math.round((committed-received)*100)/100);
 return {base:base,received:received,extras:state.changes?extras:null,proposed:proposed,committed:committed,due:due};
}
function setText(id,value){$(id).textContent=value;}
function setHref(id,href){var el=$(id);if(el)el.href=href;}
function applyTranslations(){
 document.querySelectorAll("[data-fr][data-en]").forEach(function(node){node.textContent=node.dataset[en()?"en":"fr"];});
 document.querySelectorAll("[data-new-extra]").forEach(function(b){b.disabled=!state.quote||!state.quote.accepted_at;});
}
function renderHeader(){
 var q=state.quote,c=state.client||{};
 setText("pf-client-name",clientName());
 setText("pf-crumb-client",clientName());
 setText("pf-project-name",tr("Projet · ","Project · ")+(q.numero||"—"));
 setText("pf-crumb-project",q.numero||"Projet");
 setText("pf-project-meta",tr("Devis ","Quote ")+(q.numero||"—")+" · "+tr("Accepté le ","Accepted ")+day(q.accepted_at));
 setText("pf-project-status",q.accepted_at?tr("En cours","In progress"):tr("Devis","Quote"));
 setText("pf-client-sub",[c.entreprise,c.email].filter(Boolean).join(" · ")||tr("Fiche client privée","Private client record"));
 setText("pf-avatar",clientName().trim().split(/\s+/).slice(0,2).map(function(x){return x.slice(0,1);}).join("").toUpperCase());
 setHref("pf-side-dashboard","./#/tableau-de-bord");
  setHref("pf-side-project","projet.html?q="+encodeURIComponent(id));
 setHref("pf-project-tools",projectUrl());
 setHref("pf-side-journal",projectUrl("work/c-journal"));
 setHref("pf-side-documents",projectUrl("work/c-docs"));
 setHref("pf-side-invoices","projet.html?q="+encodeURIComponent(id)+"#invoices");
 setHref("pf-open-billing",projectUrl("billing"));
}
function loadProjectSwitcher(){
 // This is a project-centric dashboard, not a sum across unrelated clients.
 // Offer an explicit selector; never mistake one client's totals for all clients.
 return sb.select("quotes","select=id,numero,client_id,accepted_at&accepted_at=not.is.null&deleted_at=is.null&order=accepted_at.desc").then(function(quotes){
  var rows=Array.isArray(quotes)?quotes.filter(function(q){return q.id&&q.accepted_at;}):[];
  var picker=$("pf-project-switch");if(!picker)return;
  picker.replaceChildren();
  rows.forEach(function(q){
   var opt=document.createElement("option");
   opt.value=q.id;opt.textContent=q.numero||tr("Projet","Project");
   if(q.id===id)opt.selected=true;
   picker.appendChild(opt);
  });
  if(!rows.some(function(q){return q.id===id;})){
   var self=document.createElement("option");self.value=id;
   self.textContent=state.quote&&state.quote.numero||tr("Ce projet","This project");
   self.selected=true;picker.prepend(self);
  }
  picker.disabled=picker.options.length<2;
 }).catch(function(){
  var picker=$("pf-project-switch");if(picker){picker.disabled=true;picker.replaceChildren();}
 });
}
function renderKpis(){
 var x=totals();
 setText("pf-base",money(x.base));
 setText("pf-extras",money(x.extras));
 setText("pf-received",money(x.received));
 setText("pf-remaining",money(x.due));
 setText("pf-committed",money(x.committed));
 var n=$("pf-finance-note");
 n.textContent=!state.changes||!state.tracking?tr("Données financières indisponibles : montants incomplets.","Financial data unavailable: totals are incomplete."):
 x.proposed>0?tr("Propositions en attente : ","Pending proposals: ")+money(x.proposed)+tr(" — non incluses dans le total engagé."," — excluded from committed totals."):
 tr("Totaux basés sur les accords client et les encaissements vérifiés.","Totals reflect approved work and verified receipts.");
 renderChart(x);
}
function renderChart(x){
 var p=x.committed>0&&x.received!==null?Math.max(0,Math.min(100,Math.round(x.received/x.committed*100))):0;
 setText("pf-percent",x.committed===null||x.received===null?"—":p+"%");
 setText("pf-legend-paid",money(x.received));
 setText("pf-legend-total",money(x.committed));
 // The verified RPC returns receipts at project level, not a reliable
 // allocation of each unlinked receipt to initial vs supplementary work.
 // These displayed remaining segments are illustrative accounting allocation,
 // explicitly identified as such, NOT a claim that a specific invoice was paid.
 var initial=x.base===null||x.received===null?null:Math.max(0,Math.round((x.base-x.received)*100)/100);
 var rest=x.due===null||initial===null?null:Math.max(0,Math.round((x.due-initial)*100)/100);
 setText("pf-legend-initial",money(initial));
 setText("pf-legend-extra",money(rest));
 $("pf-donut").style.background=x.committed===null||x.received===null?"#e6e2f7":
  "conic-gradient(#17b999 0% "+p+"%,#5b24e7 "+p+"% 100%)";
 $("pf-donut").setAttribute("aria-label",tr("Part encaissée : ","Received share: ")+(x.committed===null||x.received===null?"—":p+"%"));
 setText("pf-due-detail",tr("Répartition indicative des soldes (encaissements non ventilés par facture).","Indicative remaining breakdown (receipts not allocated to individual invoices)."));
}
function originalScope(){
 var q=state.quote,d=q.accepted_data||q.data||{},lines=Array.isArray(d.lines)?d.lines:[];
 var actual=lines.filter(function(x){return x&&!x.h&&!x.o&&String(x.l||"").trim()&&(x.u!=="mois"&&x.u!=="month");})
   .slice(0,12).map(function(x){return x.l;});
 return actual;
}
function listLines(items){return items.length?'<ul class="pf-deliverables">'+items.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ul>":'<p class="pf-muted">'+tr("Voir le détail du devis signé.","See the accepted quotation for scope details.")+"</p>";}
function itemDate(q){return day(q.accepted_at);}
function approvedRows(){return (state.changes||[]).filter(isApproved).sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);});}
function pendingRows(){return (state.changes||[]).filter(function(r){return ["requested","proposed"].includes(r.status);});}
function mainItem(){
 var q=state.quote;
 return '<article class="pf-timeline-item"><span class="pf-timeline-pin paid" aria-hidden="true">✓</span>'+
  '<div class="pf-timeline-item-head"><div><h3>'+tr("Projet initial — ","Original project — ")+esc(q.numero||"—")+'</h3><small>'+tr("Devis accepté le ","Quote accepted ")+esc(itemDate(q))+'</small></div>'+
  badge(tr("Accepté","Approved"))+'<strong class="pf-timeline-sum">'+money(totals().base)+'</strong></div>'+
  '<div class="pf-timeline-body"><h4>'+tr("Prestations incluses","Included services")+'</h4>'+listLines(originalScope())+'</div></article>';
}
function changeItem(r){
 var agreed=isApproved(r),pending=r.status==="proposed",text=r.proposed_scope||r.description||"";
 return '<article class="pf-timeline-item"><span class="pf-timeline-pin '+(agreed?"":"wait")+'" aria-hidden="true">'+(agreed?"✓":"…")+'</span>'+
  '<div class="pf-timeline-item-head"><div><h3>'+esc(r.title||tr("Supplément","Extra work"))+'</h3><small>'+
  tr("Proposition ","Proposal ")+(r.proposal_version||"—")+(r.decided_at?tr(" · Accord du "," · Approved ")+day(r.decided_at):"")+'</small></div>'+
  badge(status(r),agreed?"":pending?"pending":"neutral")+
  '<strong class="pf-timeline-sum">'+(amount(r.extra_price)===null?tr("À chiffrer","To price"):money(amount(r.extra_price)))+'</strong></div>'+
  '<div class="pf-timeline-body"><h4>'+tr("Détail du supplément","Additional scope")+'</h4><p class="pf-muted">'+esc(text)+'</p>'+
  (!agreed?'<p class="pf-muted">'+tr("Proposition non acceptée : exclue du total engagé.","Not approved: excluded from committed total.")+'</p>':"")+'</div></article>';
}
function invoiceRows(){
 var q=state.quote;
 return (Array.isArray(q.invoices)?q.invoices:[]).slice().map(function(x){
  var kind=x.change?tr("Facture complémentaire","Supplement invoice"):x.care?tr("Maintenance","Maintenance"):tr("Facture initiale","Original invoice");
  return {kind:kind,number:x.num||x.numero||"—",amount:amount(x.amt),date:x.date||x.issued_at||x.created_at||null,change:!!x.change,id:x.id};
 });
}
function invoiceTable(rows){
 if(!rows.length)return '<div class="pf-empty">'+tr("Aucune facture enregistrée.","No invoices recorded.")+'</div>';
 return '<div class="pf-table-wrap"><table class="pf-data-table"><thead><tr><th>'+tr("Type","Type")+'</th><th>'+tr("Référence","Reference")+'</th><th>'+tr("Montant","Amount")+'</th><th>'+tr("Statut","Status")+'</th><th>'+tr("Action","Action")+'</th></tr></thead><tbody>'+
 rows.map(function(r){return '<tr><td>'+esc(r.kind)+'</td><td>'+esc(r.number)+'</td><td class="pf-table-amount">'+money(r.amount)+'</td><td>'+badge(tr("Voir encaissements","See receipts"),"neutral")+'</td><td><a href="'+esc(projectUrl("billing"))+'">'+tr("Ouvrir","Open")+'</a></td></tr>';}).join("")+
 '</tbody></table></div>';
}
function overview(){
 var rows=approvedRows(),pending=pendingRows();
 return '<div class="pf-timeline">'+mainItem()+rows.map(changeItem).join("")+
  (pending.length?'<div class="pf-timeline-compact"><h3>'+tr("Propositions non acceptées","Unapproved proposals")+'</h3>'+pending.map(changeItem).join("")+'</div>':"")+
  '<article class="pf-timeline-item"><span class="pf-timeline-pin wait" aria-hidden="true"></span><div class="pf-timeline-item-head"><div><h3>'+tr("Facturation & paiements","Invoicing & payments")+'</h3><small>'+tr("Factures émises et paiements confirmés","Issued invoices and confirmed receipts")+'</small></div></div><div class="pf-timeline-body">'+invoiceTable(invoiceRows())+'</div></article>'+
  '</div><a class="pf-more-link" href="'+esc(projectUrl())+'">'+tr("Ouvrir le suivi complet du projet →","Open full project management →")+'</a>';
}
function allQuotes(){
 return '<div class="pf-timeline">'+mainItem()+approvedRows().map(changeItem).join("")+
 (pendingRows().length?'<h3>'+tr("Propositions en attente","Pending proposals")+'</h3>'+pendingRows().map(changeItem).join(""):"")+
 '</div><a class="pf-more-link" href="'+esc(quoteUrl())+'">'+tr("Consulter le devis initial →","Open original quotation →")+'</a>';
}
function allInvoices(){
 return invoiceTable(invoiceRows())+'<a class="pf-more-link" href="'+esc(projectUrl("billing"))+'">'+tr("Émettre ou consulter une facture dans la facturation sécurisée →","Issue or view an invoice in secure billing →")+'</a>';
}
function payments(){
 var t=state.tracking;
 if(!t)return '<div class="pf-empty">'+tr("Encaissements non chargés. Ne pas déduire de paiement des factures émises.","Receipts unavailable. Issued invoices do not prove payment.")+'</div>';
 var rows=Array.isArray(t.receipts)?t.receipts:[];
 return '<div class="pf-timeline-item"><h3>'+tr("Encaissements réellement confirmés","Verified receipts")+'</h3><div class="pf-timeline-body"><strong>'+money(amount(t.received))+'</strong><p class="pf-muted">'+
 tr("Montants issus du suivi serveur, et non des cases « payé » sur les factures.","Figures come from server payment tracking, not invoice paid checkboxes.")+'</p></div></div>'+
 (rows.length?rows.map(function(x){return '<div class="pf-payment-row"><div><strong>'+esc(day(x.received_on))+'</strong><br><span>'+esc(x.method||tr("Paiement","Payment"))+'</span></div><strong class="pf-money-strong">'+money(amount(x.amount))+'</strong></div>';}).join(""):'<div class="pf-empty">'+tr("Aucun reçu détaillé.","No detailed receipts.")+'</div>')+
 '<a class="pf-more-link" href="'+esc(projectUrl("billing"))+'">'+tr("Voir le détail du suivi financier →","See full payment tracking →")+'</a>';
}
function extras(){
 var rows=state.changes||[];
 return rows.length?'<div class="pf-timeline">'+rows.map(changeItem).join("")+'</div>':'<div class="pf-empty">'+tr("Aucune demande supplémentaire sur ce projet.","No extra work requests for this project.")+'</div>';
}
function activity(){
 var a=[],q=state.quote;
 if(q.accepted_at)a.push({date:q.accepted_at,text:tr("Devis initial accepté","Original quote accepted")});
 (state.changes||[]).forEach(function(r){
  a.push({date:r.created_at,text:tr("Demande supplémentaire : ","Change request: ")+(r.title||"—")});
  if(r.decided_at)a.push({date:r.decided_at,text:status(r)+" · "+(r.title||"—")});
 });
 (state.tracking&&state.tracking.receipts||[]).forEach(function(p){a.push({date:p.received_on,text:tr("Encaissement confirmé : ","Receipt confirmed: ")+money(amount(p.amount))});});
 a.sort(function(x,y){return new Date(y.date)-new Date(x.date);});
 return a.length?a.map(function(x){return '<div class="pf-activity-row"><strong>'+esc(x.text)+'</strong><span>'+esc(day(x.date))+'</span></div>';}).join(""):'<div class="pf-empty">'+tr("Aucune activité pour le moment.","No activity yet.")+'</div>';
}
var sections={overview:{fr:["◉ Périmètre du projet","Prestations, statut et montants associés."],en:["◉ Project scope","Services, statuses and amounts."]},
 quotes:{fr:["▤ Devis & accords","Contrat initial et propositions complémentaires."],en:["▤ Quotes & approvals","Original contract and supplementary proposals."]},
 invoices:{fr:["▧ Factures","Factures enregistrées, sans doublon des suppléments."],en:["▧ Invoices","Recorded invoices, with extras counted only once."]},
 payments:{fr:["▣ Paiements","Seulement les paiements confirmés."],en:["▣ Payments","Verified payments only."]},
 extras:{fr:["◇ Suppléments","Demandes, propositions et accords du client."],en:["◇ Extras","Requests, proposals and approvals."]},
 activity:{fr:["⌁ Activité","Chronologie des étapes et décisions."],en:["⌁ Activity","Project milestones and decisions."]}};
function renderSection(){
 var s=sections[state.section]||sections.overview,t=s[en()?"en":"fr"];
 setText("pf-panel-title",t[0]);setText("pf-panel-sub",t[1]);
 var box=$("pf-panel-content");
 box.innerHTML=state.section==="overview"?overview():state.section==="quotes"?allQuotes():state.section==="invoices"?allInvoices():state.section==="payments"?payments():state.section==="extras"?extras():activity();
 $("pf-tabs").querySelectorAll("[data-panel]").forEach(function(b){var on=b.dataset.panel===state.section;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));b.tabIndex=on?0:-1;});
}
function render(){
 if(!state.quote)return;
 $("pf-loading").hidden=true;$("pf-shell").hidden=false;
 applyTranslations();renderHeader();renderKpis();renderSection();
}
var MFA_WINDOW=12*60*60;
function mfaExpired(){
 return typeof sb.aal==="function"&&typeof sb.mfaFresh==="function"&&
  (sb.aal()!=="aal2"||!sb.mfaFresh(MFA_WINDOW));
}
function requireNewVerification(){
 conceal();
 location.replace("./?return="+encodeURIComponent("projet.html?q="+id));
}
function readData(){
 if(!sb.session()){conceal();location.replace("./");return;}
 if(mfaExpired()){requireNewVerification();return;}
 if(state.busy)return;
 state.busy=true;
 return sb.select("quotes","select=*&id=eq."+encodeURIComponent(id)).then(function(rows){
  var q=rows&&rows[0];if(!q||!q.accepted_at){showError(tr("Projet accepté introuvable. Ouvrez le devis initial.","Accepted project not found. Open original quote."));return null;}
  state.quote=q;
  return Promise.all([
   q.client_id?sb.select("clients","select=*&id=eq."+encodeURIComponent(q.client_id)).then(function(x){return x&&x[0]||null;}):Promise.resolve(null),
   sb.rpc("owner_list_change_requests",{p_quote:id},true),
   sb.rpc("project_tracking",{p_quote:id},true)
  ]).then(function(res){state.client=res[0];state.changes=Array.isArray(res[1])?res[1]:null;state.tracking=res[2]||null;state.readError=null;render();loadProjectSwitcher();},
   function(err){state.readError=err;state.changes=null;state.tracking=null;render();setText("pf-finance-note",tr("Certaines données financières sont indisponibles. Aucun total non vérifié n'est présenté.","Some financial data is unavailable. Unverified totals are hidden."));});
 }).catch(function(){state.readError=true;conceal();showError(tr("Accès impossible au projet. Vérifiez votre session administrateur.","Unable to access project. Check your admin session."));})
 .finally(function(){state.busy=false;});
}
function conceal(){
 $("pf-shell").hidden=true;
 $("pf-loading").hidden=false;
 $("pf-loading").textContent=tr("Vérification de la session…","Checking session…");
 if($("pf-extra-dialog").open)$("pf-extra-dialog").close();
}
function verifyOwnerAndLoad(){
 conceal();
 if(!sb.session()){location.replace("./");return;}
 if(mfaExpired()){requireNewVerification();return;}
 return sb.rpc("is_owner",{},true).then(function(ok){
  if(!ok){location.replace("./");return;}
  return readData();
 }).catch(function(){showError(tr("Accès administrateur non vérifié. Revenez à la connexion.","Admin access could not be verified. Return to sign-in."));});
}
function openExtra(){
 if(!state.quote||!state.quote.accepted_at)return;
 var dialog=$("pf-extra-dialog");
 if(typeof dialog.showModal!=="function")return;
 dialog.showModal();
 if(!state.modalInitialized){
  if(!window.DzoftChanges){$("pf-change-widget").textContent=tr("Module des demandes indisponible.","Change request module unavailable.");return;}
  state.modalInitialized=true;
  var root=$("pf-change-widget");
  var observer=new MutationObserver(function(){
   clearTimeout(root._pfTimer);
   root._pfTimer=setTimeout(function(){if(dialog.open&&!state.busy)readData();},450);
  });
  observer.observe(root,{subtree:true,childList:true});
  Promise.resolve(window.DzoftChanges.owner(root,{
    sb:sb,quoteId:id,en:en(),invoices:state.quote.invoices||[],
    onInvoice:function(){dialog.close();location.href=projectUrl("billing");}
  })).then(function(){
    if(!dialog.open)return;
    var form=root.querySelector("[data-change-offer]");
    if(form){var detail=form.closest("details");if(detail)detail.open=true;}
  }).catch(function(){root.textContent=tr("Impossible de charger les propositions. Réessayez depuis le suivi du projet.","Unable to load proposals. Retry from project management.");});
 } else {
  var form=$("pf-change-widget").querySelector("[data-change-offer]");
  if(form){var detail=form.closest("details");if(detail)detail.open=true;}
 }
}
$("pf-dialog-close").addEventListener("click",function(){$("pf-extra-dialog").close();});
$("pf-extra-dialog").addEventListener("click",function(e){if(e.target===$("pf-extra-dialog"))e.target.close();});
document.querySelectorAll("[data-new-extra]").forEach(function(b){b.addEventListener("click",openExtra);});
$("pf-tabs").addEventListener("click",function(e){var b=e.target.closest("[data-panel]");if(!b)return;location.hash=b.dataset.panel;});
window.addEventListener("hashchange",function(){var section=location.hash.slice(1);if(!validPanels.includes(section))return;state.section=section;if(state.quote)renderSection();});
$("pf-project-switch").addEventListener("change",function(){
 var next=this.value;
 if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(next)&&next!==id){conceal();location.assign("projet.html?q="+encodeURIComponent(next));}
});
$("pf-menu").addEventListener("click",function(){var open=!$("pf-shell").classList.contains("pf-menu-open");$("pf-shell").classList.toggle("pf-menu-open",open);$("pf-menu").setAttribute("aria-expanded",String(open));$("pf-overlay").hidden=!open;});
$("pf-overlay").addEventListener("click",function(){$("pf-shell").classList.remove("pf-menu-open");$("pf-menu").setAttribute("aria-expanded","false");$("pf-overlay").hidden=true;});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&$("pf-shell").classList.contains("pf-menu-open"))$("pf-overlay").click();});
document.addEventListener("dzoft:locale-change",function(){if(state.quote)render();});
$("pf-logout").addEventListener("click",function(){
 conceal();
 // Hide immediately, independently of whether the remote logout request succeeds.
 Promise.resolve(sb.signOut()).finally(function(){location.replace("./");});
});
document.addEventListener("visibilitychange",function(){if(!document.hidden)verifyOwnerAndLoad();});
setInterval(function(){if(!document.hidden&&!$("pf-shell").hidden&&mfaExpired())requireNewVerification();},60000);
window.addEventListener("pagehide",conceal);
window.addEventListener("pageshow",function(e){if(e.persisted)verifyOwnerAndLoad();});
verifyOwnerAndLoad();
})();