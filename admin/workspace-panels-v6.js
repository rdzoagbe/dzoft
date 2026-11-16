/* DZOFT v6 operational indexes. All data is supplied by authenticated owner
   queries in index.html. Never creates receipts, invoices or project records. */
(function(){
'use strict';
var root=document.querySelector('#app .shell main');
if(!root)return;
var specs=[
 ['invoices','Factures','Invoices','Retrouvez les factures dans chaque dossier client.','Open a client project to manage its invoices.'],
 ['journal','Journal & Suivi','Journal & tracking','Retrouvez les notes et le suivi de chaque projet.','Review notes and tracking for each project.'],
 ['documents','Documents','Documents','Consultez les documents associés à vos dossiers.','Review documents attached to your projects.'],
 ['catalogue','Catalogue des prestations','Service catalogue','Références de prestations liées aux devis acceptés.','Service references linked to accepted quotes.'],
 ['reports','Rapports','Reports','Vue consolidée des dossiers et encaissements vérifiés.','Consolidated cases and verified receipts.']
];
var en=function(){return document.documentElement.lang==='en';};
var tr=function(fr,english){return en()?english:fr;};
var esc=function(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];});};
var fmt=function(n){return typeof n==='number'&&Number.isFinite(n)?new Intl.NumberFormat(en()?'en-GB':'fr-FR',{style:'currency',currency:'EUR'}).format(n):'—';};
var valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var projectLink=function(id,panel){return valid.test(id)?'projet.html?q='+encodeURIComponent(id)+'#'+panel:null;};
var sectionBefore=document.getElementById('v-settings');
specs.forEach(function(spec){
 var section=document.createElement('section');section.id='v-'+spec[0];section.hidden=true;section.className='v6-workspace-section';
 section.innerHTML='<div class="v6-page-head"><p>DZOFT · ADMIN</p><h1></h1><span></span></div><div class="v6-page-body" aria-live="polite"></div>';
 root.insertBefore(section,sectionBefore);
});
var projects=[],clients=[],quotes=[],trackings={},ready=false;
function projectCards(panel){
 if(!projects.length)return '<div class="v6-empty">'+tr('Aucun projet accepté disponible.','No accepted projects available.')+'</div>';
 return '<div class="v6-card-list">'+projects.map(function(p){
  var link=projectLink(p.id,panel);
  if(!link)return '';
  return '<a class="v6-project-row" href="'+esc(link)+'"><span class="v6-project-icon" aria-hidden="true">▤</span><span class="v6-project-info"><strong>'+esc(p.clientName||tr('Client','Client'))+'</strong><small>'+esc(p.numero||'')+'</small></span><span class="v6-project-open">'+tr('Ouvrir le dossier','Open case')+' →</span></a>';
 }).join('')+'</div>';
}
function invoices(){return '<p class="v6-note">'+tr('Les factures sont gérées dans les dossiers de projet, avec leurs références et encaissements. Aucune facture n’est créée depuis cette liste.','Invoices are managed within project cases. Nothing is issued from this list.')+'</p>'+projectCards('invoices');}
function journal(){return '<p class="v6-note">'+tr('Chaque dossier conserve son journal privé et les étapes de suivi.','Each case has its own private journal and progress tracking.')+'</p>'+projectCards('journal');}
function documents(){return '<p class="v6-note">'+tr('Les pièces sont consultables dans les dossiers autorisés.','Documents are available through authorised project cases.')+'</p>'+projectCards('documents');}
function catalogue(){
 return '<p class="v6-note">'+tr('Les prestations déjà chiffrées sont accessibles dans les devis des projets. Un catalogue de prestations modifiable et partagé nécessite encore sa propre gestion des données.','Existing priced services are available from project quotes. An editable shared catalogue still requires a dedicated data model.')+'</p>'+projectCards('quotes');
}
function reports(){
 var received=0,remaining=0,committed=0,available=0;
 projects.forEach(function(p){
  var d=trackings[p.id];if(!d)return;
  var c=Number(d.total),r=Number(d.received),b=Number(d.remaining);
  if(![c,r,b].every(Number.isFinite))return;
  committed+=Math.round(c*100);received+=Math.round(r*100);remaining+=Math.round(b*100);available++;
 });
 var verified=ready&&(projects.length===0||available===projects.length);
 var label=function(title,value){return '<div class="v6-report-stat"><span>'+title+'</span><strong>'+value+'</strong></div>';};
 return '<div class="v6-report-grid">'+label(tr('Clients','Clients'),String(clients.length))+
 label(tr('Devis','Quotes'),String(quotes.length))+
 label(tr('Projets acceptés','Accepted projects'),String(projects.length))+
 label(tr('Total des contrats suivis','Tracked commitments'),verified?fmt(committed/100):'—')+
 label(tr('Encaissements vérifiés','Verified receipts'),verified?fmt(received/100):'—')+
 label(tr('Solde à encaisser','Outstanding'),verified?fmt(remaining/100):'—')+'</div>'+
 (!verified?'<p class="v6-warning">'+tr('Certains montants ne sont pas encore vérifiables. Aucun total partiel n’est présenté comme définitif.','Some amounts are not available or verified. Partial totals are not presented as final.')+'</p>':'')+
 '<h2 class="v6-report-subtitle">'+tr('Rapports par projet','Project reports')+'</h2>'+projectCards('overview');
}
var views={invoices:invoices,journal:journal,documents:documents,catalogue:catalogue,reports:reports};
function render(){
 specs.forEach(function(spec){
  var section=document.getElementById('v-'+spec[0]);if(!section)return;
  section.querySelector('h1').textContent=tr(spec[1],spec[2]);
  section.querySelector('.v6-page-head>span').textContent=tr(spec[3],spec[4]);
  section.querySelector('.v6-page-body').innerHTML=views[spec[0]]();
 });
}
function setData(next){
 projects=(next.projects||[]).filter(function(x){return x&&valid.test(x.id);});
 clients=next.clients||[];quotes=next.quotes||[];
 trackings=next.trackings||{};ready=!!next.ready;
 render();
}
document.addEventListener('dzoft:locale-change',render);
window.DzoftWorkspacePanelsV6={setData:setData,render:render};
render();
})();
