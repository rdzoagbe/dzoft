/* DZOFT single owner dashboard — presentation only, fed by the authenticated admin.
 * Financial figures come from verified project_tracking RPCs; no writes.
 * Project-specific contract and supplements are shown in the project page (suivi.html). */
(function(root){
"use strict";
var section=document.getElementById("sd-dashboard");
if(!section)return;
var selectedId="";
var lastInput=null;
var $=function(id){return document.getElementById(id);};
var esc=function(v){return String(v===undefined||v===null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
var cents=function(v){if(v===null||v===undefined||v==="")return null;var n=Number(v);return Number.isFinite(n)?Math.round(n*100):null;};
var tr=function(fr,en){return lastInput&&lastInput.english?en:fr;};
var money=function(c){return c===null?"—":new Intl.NumberFormat(lastInput&&lastInput.english?"en-GB":"fr-FR",{style:"currency",currency:"EUR"}).format(c/100);};
var projectUrl=function(id){return "suivi.html?q="+encodeURIComponent(id);};
// Money at a glance (17 Nov 2026). Only verified receipts count as received; "ready to invoice" is finished extra
// work the client signed and that has no invoice yet (its amount is the signed one). Nothing here is ever written.
var thisMonth=function(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
var statsData=function(input){
 var signed=0,received=0,remaining=0,pending=0,valid=0,month=0,month0=thisMonth(),ready=0,readyCount=0;
 (input.projects||[]).forEach(function(p){
  var d=p.tracking;
  if(!d)return;
  var total=cents(d.total),r=cents(d.received),rest=cents(d.remaining);
  if(total===null||r===null||rest===null)return;
  valid++;signed+=total;received+=r;remaining+=rest;
  (d.payment_statuses||[]).forEach(function(x){if(x.status==="pending"||x.status==="sent_by_client")pending+=cents(x.amount)||0;});
  (d.receipts||[]).forEach(function(x){if(String(x.received_on||"").slice(0,7)===month0)month+=cents(x.amount)||0;});
 });
 (input.changes||[]).forEach(function(c){var v=cents(c.extra_price);if(c.status==="completed"&&!c.invoiced&&v>0){ready+=v;readyCount++;}});
 return {signed:signed,received:received,remaining:remaining,pending:pending,valid:valid,month:month,ready:ready,readyCount:readyCount};
};
function stat(label,value,icon,modifier,route,sub){
 return '<button type="button" class="sd-stat '+modifier+'" data-go="'+esc(route)+'"><span class="sd-stat-icon">'+icon+'</span><span class="sd-stat-label">'+label+'</span><strong>'+value+'</strong>'+(sub?'<small class="sd-stat-sub">'+sub+'</small>':'')+'<span class="sd-stat-arrow">↗</span></button>';
}
function renderStats(data){
 var sum=statsData(data),ready=!!data.ready,all=(data.projects||[]).length;
 var partial=ready&&sum.valid<all;
 var valid=ready&&(all===0||sum.valid>0);
 var fmt=function(n){return valid?money(n):"—";};
 $("sd-stats").innerHTML=
  stat(tr("Déjà encaissé","Received and verified"),fmt(sum.received),"✓","green","finance",valid?tr("dont "+money(sum.month)+" ce mois-ci",money(sum.month)+" this month"):"")+
  stat(tr("Reste à encaisser","Outstanding balance"),fmt(sum.remaining),"◷","orange","finance",valid&&sum.pending?tr("dont "+money(sum.pending)+" annoncés par le client, à vérifier",money(sum.pending)+" reported by clients, to check"):"")+
  stat(tr("Prêt à facturer","Ready to invoice"),data.ready?money(sum.ready):"—","€","violet","finance",data.ready?(sum.readyCount?tr(sum.readyCount>1?sum.readyCount+" suppléments signés et terminés":"1 supplément signé et terminé",sum.readyCount>1?sum.readyCount+" signed extras completed":"1 signed extra completed"):tr("Rien en attente","Nothing waiting")):"")+
  stat(tr("Total des contrats suivis","Tracked contracts total"),fmt(sum.signed),"▣","purple","finance")+
  stat(tr("Projets en cours","Active projects"),String(data.activeProjects||0),"▤","blue","projects");
 $("sd-verification").textContent=!ready?tr("Chargement des données financières vérifiées…","Loading verified financial data…"):
  partial?tr("Attention : certains soldes ne sont pas accessibles. Les montants affichés sont partiels et ne doivent pas être utilisés comme total comptable.","Some balances are unavailable. Amounts shown are partial and must not be used as accounting totals."):
  tr("Les encaissements affichés sont uniquement ceux confirmés dans le suivi des projets. Aucun paiement n'est validé automatiquement ici.","Only verified project receipts are displayed. This dashboard never confirms a payment.");
}
function renderProjects(data){
 var projects=(data.projects||[]).slice().sort(function(a,b){return new Date(b.accepted_at||0)-new Date(a.accepted_at||0);});
 if(!projects.length){$("sd-project-list").innerHTML='<div class="sd-empty">'+tr("Aucun projet accepté. Les nouveaux projets apparaîtront ici après validation du devis.","No accepted projects yet. New projects will appear after quote approval.")+'</div>';return;}
 $("sd-project-list").innerHTML=projects.slice(0,7).map(function(p){
  var progress=Math.max(0,Math.min(100,Number(p.progress)||0)),label=progress===100?tr("Terminé","Completed"):tr("En cours","In progress");
  var d=p.tracking,remaining=d?cents(d.remaining):null;
  return '<a class="sd-project" href="'+esc(projectUrl(p.id))+'"><span class="sd-project-mark">▤</span>'+
   '<span class="sd-project-copy"><strong>'+esc(p.clientName)+'</strong><span>'+esc(p.numero)+' · '+esc(p.stage||label)+'</span>'+
   '<span class="sd-progress"><span style="width:'+progress+'%"></span></span></span>'+
   '<span class="sd-project-status"><b>'+ (d?esc(money(remaining)):"—") +'</b><small>'+tr("reste","remaining")+'</small></span><span class="sd-chevron">›</span></a>';
 }).join('')+(projects.length>7?'<button type="button" class="sd-text-link sd-see-all" data-go="projects">'+tr("Voir tous les projets","View all projects")+' →</button>':"");
}
// Category of a to-do line from the owner dashboard (admin/index.html), for its colour dot and title.
function todoKind(t){
 var x=t.text,g=t.target||"";
 if(/^Virement signalé|^Paiement déclaré/.test(x))return ["reported","Virement signalé","Reported transfer"];
 if(g.indexOf("thread:")===0)return ["message","Message client","Client message"];
 if(/^Demande de modification/.test(x))return ["request","Demande du client","Client request"];
 if(/^Proposition|^Travaux .* terminés/.test(x))return ["quote","Travaux complémentaires","Extra work"];
 if(g==="leads")return ["lead",/^Relancer/.test(x)?"Relance prévue":"Nouvelle demande",/^Relancer/.test(x)?"Follow-up due":"New request"];
 if(/^Échec/.test(x))return ["failed","E-mail non envoyé","E-mail not sent"];
 if(/^Paiement à vérifier|^Acompte|facture/.test(x))return ["pending","Paiement et facturation","Payment and invoicing"];
 if(/^Devis/.test(x))return ["quote","Devis","Quote"];
 if(/a validé/.test(x))return ["validated","Étape validée","Step validated"];
 if(/^Nouvel avis/.test(x))return ["review","Avis client","Client review"];
 if(/corbeille/.test(x))return ["trash","Corbeille","Trash"];
 return ["other","Action à suivre","Action to review"];
}
function renderActions(data){
 // The complete to-do list computed by the dashboard: every reminder, nothing hidden.
 if(Array.isArray(data.todo)){
  var list=data.todo,shown=list.slice(0,8),more=list.length-shown.length;
  var row=function(t){var k=todoKind(t);
   return '<button type="button" class="sd-action" data-go="'+esc(t.target)+'"><span class="sd-action-dot '+esc(k[0])+'"></span>'+
    '<span class="sd-action-copy"><strong>'+tr(k[1],k[2])+'</strong><small>'+esc(t.text)+'</small></span><span class="sd-action-chevron">›</span></button>';};
  $("sd-action-list").innerHTML=list.length?shown.map(row).join('')+
   (more>0?'<details class="sd-more"><summary>'+tr("Voir les "+more+" autres actions","Show "+more+" more actions")+'</summary>'+list.slice(8).map(row).join('')+'</details>':''):
   '<p class="sd-empty">'+(data.ready?tr("Tout est à jour : aucune action en attente.","All up to date: nothing waiting."):tr("Synchronisation des actions…","Loading actions…"))+'</p>';
  return;
 }
 var tasks=root.DzoftToday?root.DzoftToday.build({
  projects:(data.projects||[]).map(function(p){return {id:p.id,numero:p.numero,clientName:p.clientName,tracking:p.tracking};}),
  unread:data.unread||[],ready:data.ready,failures:data.failures
 }):{actions:[]};
 var actions=tasks.actions.slice(0,5);
 if(data.newLeads)actions.push({category:"lead",title:tr("Nouvelles demandes","New requests"),name:String(data.newLeads)+" "+tr("à traiter","to review"),amount:null,target:"leads"});
 if(data.waitingQuotes)actions.push({category:"quote",title:tr("Devis en attente d'accord","Quotes awaiting approval"),name:String(data.waitingQuotes)+" "+tr("devis","quotes"),amount:null,target:"quotes"});
 var labels={reported:[ "Virement signalé","Reported transfer"],pending:["Paiement en attente","Pending payment"],invoice:["Facture à traiter","Invoice to review"],message:["Message client","Client message"],lead:["Demande reçue","New request"],quote:["Devis envoyé","Quote sent"]};
 $("sd-action-list").innerHTML=actions.length?actions.slice(0,7).map(function(a){
  var label=labels[a.category]||["Action à suivre","Action to review"];
  return '<button type="button" class="sd-action" data-go="'+esc(a.target)+'">'+
    '<span class="sd-action-dot '+esc(a.category)+'"></span><span class="sd-action-copy"><strong>'+tr(label[0],label[1])+'</strong><small>'+esc(a.name)+(a.amount!==null?" · "+money(a.amount):"")+'</small></span><span class="sd-action-chevron">›</span></button>';
 }).join(''):'<p class="sd-empty">'+(data.ready?tr("Aucune priorité détectée dans les dossiers accessibles.","No outstanding priority found in accessible cases."):tr("Synchronisation des actions…","Loading actions…"))+'</p>';
}
function translateShell(){
 var global=location.hash==='#/vue-globale'||location.hash==='#vue-globale';
 $("sd-title").textContent=global?tr("Vue globale","Global overview"):tr("Tableau de bord","Dashboard");
 $("sd-subtitle").textContent=global?
   tr("Votre activité en un coup d'œil. Ouvrez un dossier pour retrouver les outils propres à chaque projet.","Your business at a glance. Open a case for its project-specific tools."):
   tr("Clients, projets, facturation et encaissements au même endroit.","Clients, projects, invoices and receipts in one place.");
 $("sd-find").textContent=tr("Rechercher un dossier","Find a case");
 $("sd-new-quote").textContent=tr("+ Nouveau devis ou supplément","+ New quote or extra");
 $("sd-projects-title").textContent=tr("Projets en cours","Projects in progress");
 $("sd-actions-title").textContent=tr("À faire","To do");var ah=$("sd-actions-help");if(ah)ah.textContent=tr("Le plus urgent en premier.","Most urgent first.");
}
function render(input){
 lastInput=input;translateShell();translateQuick();renderStats(input);renderProjects(input);renderActions(input);
 if(pendingQuick&&input.ready)runQuick(pendingQuick);
}
function newQuote(){
 location.hash="#/devis";
 requestAnimationFrame(function(){var b=document.getElementById("b-qnew");if(b)b.click();});
}
/* « + Nouveau devis ou supplément » (18 Nov 2026, Roland's flow): first choose a new project or an extra on a
   project in progress. The extra goes to that project's calculator (same path as « Créer un supplément »):
   calculate from the project's follow-up, optional commercial discount, draft to read, then « Envoyer au client ».
   Nothing is created or sent by this choice. With no accepted project yet, it goes straight to a new quote. */
function translateNew(){
 $("sd-new-title").textContent=tr("Que voulez-vous préparer ?","What do you want to prepare?");
 var q=$("sd-new-quote-choice"),x=$("sd-new-extra-choice");
 q.querySelector("b").textContent=tr("Nouveau projet","New project");
 q.querySelector("span").textContent=tr("Un devis pour un nouveau client ou un nouveau projet.","A quote for a new client or a new project.");
 x.querySelector("b").textContent=tr("Supplément sur un projet en cours","Extra work on a project in progress");
 x.querySelector("span").textContent=tr("Calcul depuis le suivi du projet, remise au choix, brouillon à relire, puis envoi au client qui le signe.","Calculated from the project’s follow-up, optional discount, a draft to read, then sent to the client to sign.");
 $("sd-new-cancel").textContent=tr("Annuler","Cancel");
}
$("sd-new-quote").addEventListener("click",function(){
 if(lastInput&&lastInput.ready&&!quickProjects().length){newQuote();return;}
 translateNew();var d=$("sd-new");if(typeof d.showModal==="function")d.showModal();else d.setAttribute("open","");
});
$("sd-new").addEventListener("close",function(){
 var v=$("sd-new").returnValue;$("sd-new").returnValue="";
 if(v==="quote")newQuote();else if(v==="extra")runQuick("extra");
});
/* Quick actions: pick the project (skipped when there is only one), then open the form inside it.
   Nothing is recorded here: the project page does the work with its usual checks. */
var QUICK={
 pay:{fr:"Enregistrer un paiement",en:"Record a payment",helpFr:"Ouvre le formulaire « Paiement reçu » du projet. Enregistrez seulement un paiement vérifié sur votre compte.",helpEn:"Opens the project’s “Payment received” form. Only record a payment you have checked on your account.",url:function(id){return "suivi.html?q="+encodeURIComponent(id)+"#billing/pay";}},
 extra:{fr:"Créer un supplément",en:"Create extra work",helpFr:"Ouvre le calculateur du projet. Le client signe la proposition avec un code reçu par e-mail avant toute facture.",helpEn:"Opens the project’s calculator. The client signs the proposal with an e-mailed code before any invoice.",url:function(id){return "suivi.html?q="+encodeURIComponent(id)+"#billing/new-extra";}},
 publish:{fr:"Publier une avancée",en:"Publish an update",helpFr:"Ouvre « Publier une avancée » du projet. Rien n’est envoyé au client avant « Publier et notifier ».",helpEn:"Opens the project’s “Publish an update”. Nothing reaches the client before “Publish and notify”.",url:function(id){return "suivi.html?q="+encodeURIComponent(id)+"#work/publish";}}
};
var pickAction=null;
function quickProjects(){return ((lastInput&&lastInput.projects)||[]).filter(function(p){return p&&/^[0-9a-f-]{36}$/i.test(p.id);});}
function translateQuick(){
 Array.prototype.forEach.call(section.querySelectorAll("[data-quick]"),function(b){var q=QUICK[b.dataset.quick];if(q)b.querySelector("b").textContent=tr(q.fr,q.en);});
 var g=$("sd-quick");if(g)g.setAttribute("aria-label",tr("Actions rapides","Quick actions"));
 $("sd-pick-title").textContent=tr("Pour quel projet ?","Which project?");$("sd-pick-label").textContent=tr("Projet","Project");
 $("sd-pick-cancel").textContent=tr("Annuler","Cancel");$("sd-pick-go").textContent=tr("Ouvrir","Open");
}
// A click before the projects have loaded is kept and carried out as soon as they arrive.
var pendingQuick=null;
function runQuick(key){
 var q=QUICK[key];if(!q)return;
 if(!lastInput||!lastInput.ready){pendingQuick=key;
  Array.prototype.forEach.call(section.querySelectorAll("[data-quick]"),function(x){x.setAttribute("aria-busy",String(x.dataset.quick===key));});return;}
 pendingQuick=null;Array.prototype.forEach.call(section.querySelectorAll("[data-quick]"),function(x){x.removeAttribute("aria-busy");});
 var list=quickProjects();
 if(!list.length){$("sd-pick-help").textContent=tr("Aucun projet accepté pour l’instant : cette action sera disponible après l’accord d’un devis.","No accepted project yet: this action becomes available once a quote is accepted.");}
 else if(list.length===1){location.assign(q.url(list[0].id));return;}
 else $("sd-pick-help").textContent=tr(q.helpFr,q.helpEn);
 pickAction=key;
 var sel=$("sd-pick-select");sel.innerHTML=list.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===selectedId?' selected':'')+'>'+esc((p.clientName||"")+" · "+(p.numero||""))+'</option>';}).join("");
 sel.disabled=!list.length;$("sd-pick-go").disabled=!list.length;$("sd-pick-title").textContent=tr(q.fr,q.en)+" · "+tr("pour quel projet ?","which project?");
 var d=$("sd-pick");if(typeof d.showModal==="function")d.showModal();else d.setAttribute("open","");
}
section.addEventListener("click",function(ev){var b=ev.target.closest("[data-quick]");if(b)runQuick(b.dataset.quick);});
$("sd-pick").addEventListener("close",function(){
 var d=$("sd-pick"),q=QUICK[pickAction],id=$("sd-pick-select").value;pickAction=null;
 if(d.returnValue==="go"&&q&&id)location.assign(q.url(id));
});
translateQuick();
document.addEventListener("dzoft:locale-change",function(){if(lastInput)render(lastInput);});
window.addEventListener("hashchange",function(){if(lastInput)translateShell();});
root.DzoftWorkspaceDashboard={render:render};
})(window);
