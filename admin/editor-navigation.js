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
 var back=valid?'projet.html?q='+encodeURIComponent(quote):'./#/dossiers';
 var paths=[
  {route:'./#/tableau-de-bord',fr:'Aujourd’hui',en:'Today',icon:'⌂'},
  {route:'./#/dossiers',fr:'Dossiers clients',en:'Client cases',icon:'▱'},
  {route:'./#/messages',fr:'Messages',en:'Messages',icon:'☏'},
  {route:'./#/paiements',fr:'Factures & paiements',en:'Invoices & payments',icon:'▣'},
  {divider:true},
  {requiresProject:true,route:back,fr:'Dossier du projet',en:'Project workspace',icon:'◈'},
  {route:quotePage?'#':(valid?'devis.html?q='+encodeURIComponent(quote):'devis.html'),fr:'Éditeur de devis',en:'Quote editor',icon:'▤',active:quotePage},
  {requiresProject:true,route:!quotePage?'#':'suivi.html?q='+encodeURIComponent(quote),fr:'Outils du projet',en:'Project tools',icon:'☷',active:!quotePage},
  {divider:true},
  {route:'./#/parametres',fr:'Paramètres',en:'Settings',icon:'⚙'}
 ];
 var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]});};
 aside.innerHTML='<a class="dzoft-editor-logo" href="./#/tableau-de-bord"><img alt="" src="../assets/dzoft-favicon.svg"><strong>DZOFT</strong></a>'+
  '<nav aria-label="Navigation principale">'+paths.map(function(p){
    if(p.requiresProject&&!valid)return '';
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
 var mobile=window.matchMedia('(max-width:950px)');
 function syncMenu(){
   var open=body.classList.contains('dzoft-editor-menu-open');
   aside.inert=mobile.matches&&!open;
   overlay.hidden=!mobile.matches||!open;
   toggle.setAttribute('aria-expanded',String(mobile.matches&&open));
 }
 function close(restoreFocus){
   var wasOpen=body.classList.contains('dzoft-editor-menu-open');
   body.classList.remove('dzoft-editor-menu-open');syncMenu();
   if(restoreFocus&&wasOpen)toggle.focus();
 }
 toggle.addEventListener('click',function(){
   var open=!body.classList.contains('dzoft-editor-menu-open');
   body.classList.toggle('dzoft-editor-menu-open',open);syncMenu();
   if(open){var first=aside.querySelector('a');if(first)first.focus();}
 });
 overlay.addEventListener('click',function(){close(true);});
 document.addEventListener('keydown',function(e){
   if(!mobile.matches||!body.classList.contains('dzoft-editor-menu-open'))return;
   if(e.key==='Escape'){e.preventDefault();close(true);return;}
   if(e.key==='Tab'){
     var links=Array.from(aside.querySelectorAll('a[href]'));
     var first=links[0],last=links[links.length-1];
     if(!first)return;
     if(e.shiftKey&&(document.activeElement===first||!aside.contains(document.activeElement))){e.preventDefault();last.focus();}
     else if(!e.shiftKey&&(document.activeElement===last||!aside.contains(document.activeElement))){e.preventDefault();first.focus();}
   }
 });
 aside.addEventListener('click',function(e){if(e.target.closest('a'))close(false);});
 mobile.addEventListener('change',function(){close(false);});
 syncMenu();
 function translate(){
   var english=document.documentElement.lang==='en';
   aside.querySelectorAll('a[data-fr][data-en]').forEach(function(a){
     a.querySelector('.dzoft-editor-item-label').textContent=a.dataset[english?'en':'fr'];
   });
   toggle.setAttribute('aria-label',english?'Open navigation':'Ouvrir la navigation');
   overlay.setAttribute('aria-label',english?'Close navigation':'Fermer la navigation');
   aside.querySelector('nav').setAttribute('aria-label',english?'Main navigation':'Navigation principale');
 }
 document.addEventListener('dzoft:locale-change',translate);translate();
})();
