(function(){
'use strict';
/* Owner-only views. Financial totals originate from verified tracking; no writes. */
var root=document.querySelector('#app .shell main');if(!root)return;
var definitions=[
 ['invoices','Factures','Invoices','Registre des factures émises','Issued invoice register'],
 ['journal','Journal & Suivi','Journal & tracking','Notes privées des projets','Private project notes'],
 ['documents','Documents','Documents','Contrat, factures, reçus et fichiers : choisissez le projet','Contract, invoices, receipts and files: choose the project'],
 ['catalogue','Catalogue (Prestations)','Service catalogue','Mes tarifs et prestations de vos devis','My prices and the services in your quotes'],
 ['reports','Rapports','Reports','Suivi des dossiers et des encaissements','Case and receipt reporting']
];
var el=id=>document.getElementById(id),en=()=>document.documentElement.lang==='en',tr=(fr,eng)=>en()?eng:fr;
var esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var money=x=>Number.isFinite(Number(x))&&x!==null&&x!==''?new Intl.NumberFormat(en()?'en-GB':'fr-FR',{style:'currency',currency:'EUR'}).format(Number(x)):'—';
var when=x=>{if(!x)return '—';var d=new Date(x);return Number.isNaN(d.getTime())?esc(x):d.toLocaleDateString(en()?'en-GB':'fr-FR');};
var projects=[],clients=[],quotes=[],details=[],trackings={},trackingReady=false,detailState='idle',clientsError=false,quotesError=false;
definitions.forEach(function(d){
 var section=el('v-'+d[0]);
 if(!section){section=document.createElement('section');section.id='v-'+d[0];section.hidden=true;section.className='v6-workspace-section';
 section.innerHTML='<div class="v6-page-head"><p>DZOFT · ADMIN</p><h1></h1><span></span></div>'+(d[0]==='catalogue'?'<div class="dzoft-prices-admin" id="dzoft-prices" data-no-translate></div>':'')+'<div class="v6-page-body" aria-live="polite"></div>';
 root.insertBefore(section,el('v-settings'));}
});
/* « Mes tarifs » (price levels, known items, default price) lives on the Catalogue page, shared by every project.
   Loaded when the page is opened; settings are owner-only (RLS). */
function mountPrices(){
 var box=el('dzoft-prices');if(!box||!/^#\/?catalogue$/.test(location.hash))return;
 if(!window.DzoftChanges||!window.DzoftChanges.prices||!window.RDsb||!window.RDsb.session||!window.RDsb.session())return;
 window.DzoftChanges.prices(box,{sb:window.RDsb,en:en()});
}
window.addEventListener('hashchange',mountPrices);document.addEventListener('dzoft:locale-change',mountPrices);
var clientName=id=>{var c=clients.find(x=>x.id===id);return c&&c.nom||tr('Client','Client');};
var link=(q,panel)=>q&&uuid.test(q.id)?(q.accepted_at?'projet.html?q='+encodeURIComponent(q.id)+'#'+panel:panel==='quotes'?'devis.html?q='+encodeURIComponent(q.id):panel==='invoices'||panel==='payments'?'suivi.html?q='+encodeURIComponent(q.id)+'#billing':'suivi.html?q='+encodeURIComponent(q.id)+'#work/c-'+(panel==='journal'?'journal':'docs')):'#/dossiers';
var empty=(fr,eng)=>'<p class="v6-empty">'+tr(fr,eng)+'</p>';
var detailNotice=()=>detailState==='error'?'<p class="v6-warning">'+tr('Les détails ne sont pas accessibles. Ouvrez à nouveau cette rubrique pour réessayer.','Detailed records are unavailable. Reopen this section to retry.')+'</p>':empty('Chargement des détails autorisés…','Loading authorised details…');
var card=(href,icon,name,meta,right)=>'<a class="v6-project-row" href="'+esc(href)+'"><span class="v6-project-icon" aria-hidden="true">'+icon+'</span><span class="v6-project-info"><strong>'+esc(name)+'</strong><small>'+meta+'</small></span>'+(right?'<strong class="v6-record-amount">'+right+'</strong>':'')+'<span class="v6-project-open">→</span></a>';
function projectCards(panel){
 if(!projects.length)return empty('Aucun projet accepté.','No accepted projects.');
 return '<div class="v6-card-list">'+projects.map(p=>card('projet.html?q='+encodeURIComponent(p.id)+'#'+panel,'▤',p.clientName||tr('Client','Client'),esc(p.numero||''))).join('')+'</div>';
}
function invoices(){
 if(quotesError)return '<div class="v6-warning" role="alert">'+tr('Impossible de charger les factures depuis les devis. Les données existent peut-être encore sur le serveur.','Unable to load invoice records from quotes. Data may still exist on the server.')+'</div><button class="btn sm main" data-retry-owner="invoices" type="button">'+tr('Réessayer','Retry')+'</button>';
 var rows=[];quotes.forEach(q=>(Array.isArray(q.invoices)?q.invoices:[]).forEach(i=>{if(i&&(i.num||i.numero))rows.push({q,i});}));
 if(!rows.length)return empty('Aucune facture enregistrée dans les devis accessibles.','No recorded invoices in accessible quotes.');
 return '<p class="v6-note">'+tr('Factures enregistrées, sans présumer des encaissements.','Recorded invoices. Issuance does not prove payment.')+'</p><div class="v6-card-list">'+rows.map(({q,i})=>
  card(link(q,'invoices'),'▧',i.num||i.numero,esc(clientName(q.client_id))+' · '+esc(q.numero||'')+' · '+when(i.issuedOn||i.date||i.issued_at||i.created_at),money(i.amt))).join('')+'</div>';
}
function detailed(field){
 if(detailState!=='ready')return detailNotice();
 var rows=[];details.forEach(q=>(Array.isArray(q[field])?q[field]:[]).forEach(item=>{if(item)rows.push({q,item});}));
 if(!rows.length)return empty(field==='journal'?'Aucune note privée enregistrée.':'Aucune référence de document enregistrée.',field==='journal'?'No private notes recorded.':'No document references recorded.');
 if(field==='journal')rows.sort((a,b)=>String(b.item.d||'').localeCompare(String(a.item.d||'')));
 return '<div class="v6-card-list">'+rows.map(({q,item})=>field==='journal'?
  card(link(q,'journal'),'☷',item.t||tr('Note','Note'),esc(clientName(q.client_id))+' · '+esc(q.numero||'')+' · '+when(item.d)+' · '+esc(item.k||'')):
  card(link(q,'documents'),'□',item.n||tr('Document','Document'),esc(clientName(q.client_id))+' · '+esc(q.numero||''))).join('')+'</div>';
}
function catalogue(){
 if(detailState!=='ready')return detailNotice();
 var rows=[];details.forEach(q=>{
  var d=q.accepted_data||q.data||{};(Array.isArray(d.lines)?d.lines:[]).forEach(l=>{
   if(l&&!l.h&&!l.o&&String(l.l||'').trim())rows.push({q,l});
  });
 });
 if(!rows.length)return empty('Aucune prestation figurant dans les devis accessibles.','No service lines in accessible quotes.');
 return '<h2 class="v6-report-subtitle">'+tr('Prestations figurant dans vos devis','Services in your quotes')+'</h2><p class="v6-note">'+tr('Prestations extraites des devis : prix indicatifs par devis, pas un tarif catalogue approuvé.','Services extracted from quotes: per-quote indicative prices, not approved catalogue prices.')+'</p><div class="v6-card-list">'+rows.map(({q,l})=>
  card(link(q,'quotes'),'▤',l.l,esc(clientName(q.client_id))+' · '+esc(q.numero||'')+(l.u?' · '+esc(l.u):'')+(l.s?' · '+esc(l.s):''),l.p==null?'—':money(l.p))).join('')+'</div>';
}
function reports(){
 if(clientsError||quotesError)return '<div class="v6-warning" role="alert">'+tr('Données partielles : impossible de calculer les rapports tant que Clients et Devis ne sont pas chargés.','Partial data: reports cannot be calculated until Clients and Quotes load correctly.')+'</div>';
 var sums={total:0,received:0,remaining:0},valid=0;
 projects.forEach(p=>{var d=trackings[p.id];if(!d)return;var vals=['total','received','remaining'].map(k=>d[k]===null||d[k]===undefined?NaN:Number(d[k]));if(vals.some(n=>!Number.isFinite(n)))return;
 ['total','received','remaining'].forEach((k,i)=>sums[k]+=Math.round(vals[i]*100));valid++;});
 var complete=trackingReady&&valid===projects.length;
 var kpi=(t,v)=>'<div class="v6-report-stat"><span>'+t+'</span><strong>'+v+'</strong></div>';
 return '<div class="v6-report-grid">'+kpi(tr('Clients','Clients'),clients.length)+kpi(tr('Devis','Quotes'),quotes.length)+kpi(tr('Projets acceptés','Accepted projects'),projects.length)+
 kpi(tr('Engagement total suivi','Tracked commitments'),complete?money(sums.total/100):'—')+kpi(tr('Paiements confirmés','Verified receipts'),complete?money(sums.received/100):'—')+kpi(tr('Reste à encaisser','Outstanding'),complete?money(sums.remaining/100):'—')+'</div>'+
 (complete?'':'<p class="v6-warning">'+tr('Données financières incomplètes ou en cours de chargement. Aucun total partiel n’est affiché comme définitif.','Financial data incomplete or loading. Partial totals are not represented as final.')+'</p>')+
 '<h2 class="v6-report-subtitle">'+tr('Dossiers de projets','Project cases')+'</h2>'+projectCards('overview');
}
/* 17 Nov 2026: each project has a complete Documents tab (contract, signed extra work, invoices, payment receipts,
   files). This page only leads to it, instead of listing loose links. */
function documentsByProject(){
 return (projects.length?'<div class="v6-card-list">'+projects.map(p=>card('projet.html?q='+encodeURIComponent(p.id)+'#documents','▢',p.clientName||tr('Client','Client'),esc(p.numero||'')+' · '+tr('contrat, factures, reçus, fichiers','contract, invoices, receipts, files'))).join('')+'</div>':empty('Aucun projet signé pour le moment.','No signed project yet.'))+
  '<h2 class="v6-report-subtitle">'+tr('Fichiers partagés avec les clients','Files shared with clients')+'</h2>'+detailed('docs');
}
var renderers={invoices:invoices,journal:()=>detailed('journal'),documents:documentsByProject,catalogue:catalogue,reports:reports};
function render(){definitions.forEach(d=>{var section=el('v-'+d[0]);section.querySelector('h1').textContent=tr(d[1],d[2]);section.querySelector('.v6-page-head>span').textContent=tr(d[3],d[4]);section.querySelector('.v6-page-body').innerHTML=renderers[d[0]]();});}
function setData(input){
 projects=(input.projects||[]).filter(p=>p&&uuid.test(p.id));clients=input.clients||[];quotes=input.quotes||[];
 trackings=input.trackings||{};trackingReady=!!input.ready;
 clientsError=!!input.clientsError;quotesError=!!input.quotesError;render();mountPrices();
}
function loadingDetails(){detailState='loading';render();}
function setDetails(rows,failed){details=Array.isArray(rows)?rows:[];detailState=failed?'error':'ready';render();}
document.addEventListener('dzoft:locale-change',render);
window.DzoftWorkspacePanelsV6={setData,loadingDetails,setDetails,render};
render();mountPrices();
})();