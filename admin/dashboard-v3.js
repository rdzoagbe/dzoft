/* DZOFT single owner dashboard — presentation only, fed by the authenticated admin.
 * Financial figures come from verified project_tracking RPCs; no writes.
 * Project-specific contract and supplements are shown in projet.html. */
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
var projectUrl=function(id){return "projet.html?q="+encodeURIComponent(id);};
var statsData=function(input){
 var signed=0,received=0,remaining=0,pending=0,valid=0;
 (input.projects||[]).forEach(function(p){
  var d=p.tracking;
  if(!d)return;
  var total=cents(d.total),r=cents(d.received),rest=cents(d.remaining);
  if(total===null||r===null||rest===null)return;
  valid++;signed+=total;received+=r;remaining+=rest;
  (d.payment_statuses||[]).forEach(function(x){if(x.status==="pending"||x.status==="sent_by_client")pending+=cents(x.amount)||0;});
 });
 return {signed:signed,received:received,remaining:remaining,pending:pending,valid:valid};
};
function stat(label,value,icon,modifier,route){
 return '<button type="button" class="sd-stat '+modifier+'" data-go="'+route+'"><span class="sd-stat-icon">'+icon+'</span><span class="sd-stat-label">'+label+'</span><strong>'+value+'</strong><span class="sd-stat-arrow">↗</span></button>';
}
function renderStats(data){
 var sum=statsData(data),ready=!!data.ready,all=(data.projects||[]).length;
 var partial=ready&&sum.valid<all;
 var valid=ready&&(all===0||sum.valid>0);
 var fmt=function(n){return valid?money(n):"—";};
 $("sd-stats").innerHTML=
  stat(tr("Total des contrats suivis","Tracked contracts total"),fmt(sum.signed),"▣","purple","finance")+
  stat(tr("Déjà encaissé","Received and verified"),fmt(sum.received),"✓","green","finance")+
  stat(tr("Reste à encaisser","Outstanding balance"),fmt(sum.remaining),"◷","orange","finance")+
  stat(tr("En attente de vérification","Pending verification"),fmt(sum.pending),"⌁","violet","finance")+
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
function renderActions(data){
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
function renderSelected(data){
 var projects=data.projects||[],picker=$("sd-project-select");
 if(!selectedId||!projects.some(function(p){return p.id===selectedId}))selectedId=projects.length?projects[0].id:"";
 picker.innerHTML=projects.length?projects.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===selectedId?' selected':'')+'>'+esc(p.clientName+" · "+p.numero)+'</option>';}).join(''):'<option value="">'+tr("Aucun projet","No projects")+'</option>';
 picker.disabled=!projects.length;
 var p=projects.find(function(item){return item.id===selectedId;});
 if(!p){$("sd-project-summary").innerHTML='<p class="sd-empty">'+tr("Choisissez un projet dès qu'un devis aura été accepté.","Select a project after a quote has been accepted.")+'</p>';return;}
 var d=p.tracking;var t=d?cents(d.total):null,r=d?cents(d.received):null,b=d?cents(d.remaining):null;
 var pct=t&&r!==null?Math.min(100,Math.max(0,Math.round(100*r/t))):null;
 $("sd-project-summary").innerHTML='<div class="sd-selected-name"><div><strong>'+esc(p.clientName)+'</strong><span>'+esc(p.numero)+'</span></div><a class="sd-project-link" href="'+esc(projectUrl(p.id))+'">'+tr("Ouvrir le dossier","Open project")+' ↗</a></div>'+
  '<div class="sd-selected-amounts"><div><span>'+tr("Total contractuel suivi","Tracked commitment")+'</span><b>'+money(t)+'</b></div>'+
  '<div><span>'+tr("Encaissements vérifiés","Verified receipts")+'</span><b>'+money(r)+'</b></div>'+
  '<div><span>'+tr("Solde à recevoir","Remaining balance")+'</span><b>'+money(b)+'</b></div></div>'+
  '<div class="sd-selected-track"><span style="width:'+(pct===null?0:pct)+'%"></span></div>'+
  '<div class="sd-selected-foot"><span>'+(pct===null?"—":pct+"%")+' '+tr("encaissé","collected")+'</span><a href="'+esc(projectUrl(p.id)+"#extras")+'">'+tr("Gérer les suppléments","Manage extras")+' →</a><a href="'+esc(projectUrl(p.id)+"#invoices")+'">'+tr("Voir les factures","View invoices")+' →</a></div>'+
  (d?"":'<p class="sd-warning">'+tr("Suivi financier indisponible pour ce projet.","Financial tracking is unavailable for this project.")+'</p>');
}
function translateShell(){
 var global=location.hash==='#/vue-globale'||location.hash==='#vue-globale';
 $("sd-title").textContent=global?tr("Vue globale","Global overview"):tr("Tableau de bord","Dashboard");
 $("sd-subtitle").textContent=global?
   tr("Votre activité en un coup d'œil. Ouvrez un dossier pour retrouver les outils propres à chaque projet.","Your business at a glance. Open a case for its project-specific tools."):
   tr("Clients, projets, facturation et encaissements au même endroit.","Clients, projects, invoices and receipts in one place.");
 $("sd-find").textContent=tr("Rechercher un dossier","Find a case");
 $("sd-new-quote").textContent=tr("+ Nouveau devis","+ New quote");
 $("sd-projects-title").textContent=tr("Projets clients","Client projects");
 $("sd-actions-title").textContent=tr("Actions prioritaires","Priority actions");
 $("sd-selected-title").textContent=tr("Dossier sélectionné","Selected project");
 $("sd-activity-title").textContent=tr("Gérer votre activité","Manage your work");
}
function render(input){
 lastInput=input;translateShell();renderStats(input);renderProjects(input);renderActions(input);renderSelected(input);
}
$("sd-project-select").addEventListener("change",function(){selectedId=this.value;if(lastInput)renderSelected(lastInput);});
$("sd-new-quote").addEventListener("click",function(){
 location.hash="#/devis";
 requestAnimationFrame(function(){var b=document.getElementById("b-qnew");if(b)b.click();});
});
document.addEventListener("dzoft:locale-change",function(){if(lastInput)render(lastInput);});
window.addEventListener("hashchange",function(){if(lastInput)translateShell();});
root.DzoftWorkspaceDashboard={render:render};
})(window);
