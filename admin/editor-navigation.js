/* DZOFT unified navigation for authenticated quote and project editors.
   Adds shared presentation only. Never changes document or invoice records. */
(function(){
 'use strict';
 var body=document.body;
 if(!body.classList.contains('dzoft-editor')||document.getElementById('dzoft-editor-sidebar'))return;
 var quote=new URLSearchParams(location.search).get('q')||'';
 var valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote);
 var quotePage=/\/devis\.html$/i.test(location.pathname);
 var aside=document.createElement('aside');
 aside.id='dzoft-editor-sidebar';
 aside.className='dzoft-editor-sidebar';
 aside.setAttribute('aria-label','Navigation DZOFT');
 /* Same menu, same order and same names as the dashboard and the « Dossier client » page (17 Nov 2026).
    Inside a project, its entries open that project's own sections; the « Outils du projet » page shows « Projets » as current. */
 var q=encodeURIComponent(quote),tools=function(h){return valid?'suivi.html?q='+q+h:null;};
 var paths=[
  {route:'./#/tableau-de-bord',fr:'Tableau de bord',en:'Dashboard',icon:'⌂'},
  {route:'./#/dossiers',fr:'Clients',en:'Clients',icon:'♧'},
  {route:valid?'projet.html?q='+q:'./#/projets',fr:'Projets',en:'Projects',icon:'▱',active:!quotePage},
  {route:quotePage?'#':(valid?'devis.html?q='+q:'./#/devis'),fr:'Devis & Chiffrage',en:'Quotes & pricing',icon:'▤',active:quotePage},
  {route:tools('#billing/c-inv')||'./#/factures',fr:'Factures',en:'Invoices',icon:'▧'},
  {route:tools('#billing')||'./#/paiements',fr:'Paiements',en:'Payments',icon:'▣'},
  {route:'./#/messages',fr:'Messages',en:'Messages',icon:'☏'},
  {route:tools('#work/c-journal')||'./#/journal',fr:'Journal & Suivi',en:'Journal & tracking',icon:'☷'},
  {route:tools('#work/c-docs')||'./#/documents',fr:'Documents',en:'Documents',icon:'□'},
  {route:'./#/catalogue',fr:'Catalogue (Prestations)',en:'Service catalogue',icon:'♧'},
  {route:'./#/rapports',fr:'Rapports',en:'Reports',icon:'▥'},
  {divider:true},
  {route:'./#/parametres',fr:'Paramètres',en:'Settings',icon:'⚙'}
 ];
 var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]});};
 aside.innerHTML='<a class="dzoft-editor-logo" href="./#/tableau-de-bord"><img alt="" src="../assets/dzoft-favicon.svg"><strong>DZOFT</strong></a>'+
  '<nav aria-label="Navigation principale">'+paths.map(function(p){
    if(p.divider)return '<div class="dzoft-editor-divider" aria-hidden="true"></div>';
    var url=p.route==='#'?(quotePage?'devis.html':'suivi.html')+location.search:p.route;
    return '<a href="'+esc(url)+'"'+(p.active?' aria-current="page" class="dzoft-editor-active"':'')+
     ' data-fr="'+esc(p.fr)+'" data-en="'+esc(p.en)+'"><span aria-hidden="true">'+esc(p.icon)+'</span><span class="dzoft-editor-item-label">'+esc(p.fr)+'</span></a>';
  }).join('')+'</nav>';
 var toggle=document.createElement('button');
 toggle.type='button';toggle.className='dzoft-editor-menu-toggle';toggle.setAttribute('aria-label','Ouvrir la navigation');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','dzoft-editor-sidebar');toggle.textContent='☰';
 var bar=body.querySelector(quotePage?'.tools':'header.top .in');
 if(bar)bar.insertBefore(toggle,bar.firstChild);
 body.prepend(aside);
 var overlay=document.createElement('button');
 overlay.type='button';overlay.className='dzoft-editor-overlay';overlay.setAttribute('aria-label','Fermer la navigation');overlay.hidden=true;body.appendChild(overlay);
 function close(){body.classList.remove('dzoft-editor-menu-open');toggle.setAttribute('aria-expanded','false');overlay.hidden=true;}
 toggle.addEventListener('click',function(){var open=!body.classList.contains('dzoft-editor-menu-open');body.classList.toggle('dzoft-editor-menu-open',open);toggle.setAttribute('aria-expanded',String(open));overlay.hidden=!open;});
 overlay.addEventListener('click',close);
 document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
 aside.addEventListener('click',function(e){if(e.target.closest('a'))close();});
 function translate(){
   var english=document.documentElement.lang==='en';
   aside.querySelectorAll('a[data-fr][data-en]').forEach(function(a){
     a.querySelector('.dzoft-editor-item-label').textContent=a.dataset[english?'en':'fr'];
   });
   toggle.setAttribute('aria-label',english?'Open navigation':'Ouvrir la navigation');
 }
 document.addEventListener('dzoft:locale-change',translate);translate();
})();
