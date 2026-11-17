(function(){
'use strict';
/* Owner-only views. Financial totals originate from verified tracking; no writes. */
var root=document.querySelector('#app .shell main');if(!root)return;
/* 17 Nov 2026: the menu has seven entries. The invoice register sits inside Comptabilité (#v-finance);
   Catalogue opens from Devis. A project's journal and documents live in that project's page only. */
var definitions=[
 ['invoices','Registre des factures','Invoice register','Toutes les factures émises, tous projets confondus','Every issued invoice, all projects'],
 ['catalogue','Catalogue (Prestations)','Service catalogue','Mes tarifs et prestations de vos devis','My prices and the services in your quotes']
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
 var nested=d[0]==='invoices'&&el('v-finance');
 section.innerHTML='<div class="v6-page-head">'+(nested?'<h2 class="v6-title"></h2>':'<p>DZOFT · ADMIN</p><h1 class="v6-title"></h1>')+'<span></span></div>'+(d[0]==='catalogue'?'<p class="v6-back"><a href="#/devis" data-fr="← Devis" data-en="← Quotes">← Devis</a></p><div class="dzoft-prices-admin" id="dzoft-prices" data-no-translate></div>':'')+'<div class="v6-page-body" aria-live="polite"></div>';
 if(nested){section.classList.add('v6-nested');el('v-finance').appendChild(section);}else root.insertBefore(section,el('v-settings'));}
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
function invoices(){
 if(quotesError)return '<div class="v6-warning" role="alert">'+tr('Impossible de charger les factures depuis les devis. Les données existent peut-être encore sur le serveur.','Unable to load invoice records from quotes. Data may still exist on the server.')+'</div><button class="btn sm main" data-retry-owner="invoices" type="button">'+tr('Réessayer','Retry')+'</button>';
 var rows=[];quotes.forEach(q=>(Array.isArray(q.invoices)?q.invoices:[]).forEach(i=>{if(i&&(i.num||i.numero))rows.push({q,i});}));
 if(!rows.length)return empty('Aucune facture enregistrée dans les devis accessibles.','No recorded invoices in accessible quotes.');
 return '<p class="v6-note">'+tr('Factures enregistrées, sans présumer des encaissements.','Recorded invoices. Issuance does not prove payment.')+'</p><div class="v6-card-list">'+rows.map(({q,i})=>
  card(link(q,'invoices'),'▧',i.num||i.numero,esc(clientName(q.client_id))+' · '+esc(q.numero||'')+' · '+when(i.issuedOn||i.date||i.issued_at||i.created_at),money(i.amt))).join('')+'</div>';
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
var renderers={invoices:invoices,catalogue:catalogue};
function render(){definitions.forEach(d=>{var section=el('v-'+d[0]);section.querySelector('.v6-title').textContent=tr(d[1],d[2]);var back=section.querySelector('.v6-back a');if(back)back.textContent=tr(back.dataset.fr,back.dataset.en);section.querySelector('.v6-page-head>span').textContent=tr(d[3],d[4]);section.querySelector('.v6-page-body').innerHTML=renderers[d[0]]();});}
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