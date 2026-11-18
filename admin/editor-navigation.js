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
 /* Same seven entries, same order and same names as the dashboard and the « Dossier client » page (17 Nov 2026).
    The quote editor shows « Devis » as current; the « Outils du projet » page shows « Projets ». */
 var q=encodeURIComponent(quote);
 var paths=[
  {route:'./#/tableau-de-bord',fr:'Tableau de bord',en:'Dashboard',icon:'⌂'},
  {route:'./#/clients',fr:'Clients',en:'Clients',icon:'♧'},
  {route:'./#/devis',fr:'Devis',en:'Quotes',icon:'▤',active:quotePage},
  {route:'./#/projets',fr:'Projets',en:'Projects',icon:'▱',active:!quotePage},
  {route:'./#/comptabilite',fr:'Comptabilité',en:'Accounts',icon:'▧'},
  {route:'./#/messages',fr:'Messages',en:'Messages',icon:'☏'},
  {divider:true},
  {route:'./#/parametres',fr:'Paramètres',en:'Settings',icon:'⚙'}
 ];
 var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]});};
 aside.innerHTML='<a class="dzoft-editor-logo" href="./#/tableau-de-bord"><img alt="" src="../assets/dzoft-favicon.svg"><strong>DZOFT</strong></a>'+
  '<nav aria-label="Navigation principale">'+paths.map(function(p){
    if(p.divider)return '<div class="dzoft-editor-divider" aria-hidden="true"></div>';
    var url=p.route;
    return '<a href="'+esc(url)+'"'+(p.active?' aria-current="page" class="dzoft-editor-active"':'')+
     ' data-fr="'+esc(p.fr)+'" data-en="'+esc(p.en)+'"><span aria-hidden="true">'+esc(p.icon)+'</span><span class="dzoft-editor-item-label">'+esc(p.fr)+'</span>'+'</a>';
  }).join('')+'</nav>';
 var toggle=document.createElement('button');
 toggle.type='button';toggle.className='dzoft-editor-menu-toggle';toggle.setAttribute('aria-label','Ouvrir la navigation');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','dzoft-editor-sidebar');toggle.textContent='☰';
 var bar=body.querySelector(quotePage?'.tools':'header.top .in');
 if(bar)bar.insertBefore(toggle,bar.firstChild);
 body.prepend(aside);
 var overlay=document.createElement('button');
 overlay.type='button';overlay.className='dzoft-editor-overlay';overlay.setAttribute('aria-label','Fermer la navigation');overlay.hidden=true;body.appendChild(overlay);
 /* On a phone (≤ 950 px, same limit as editor-navigation.css) the closed menu slides off screen: it is made inert so
    neither the keyboard nor a screen reader can reach it. When open, focus moves into it, Tab stays inside, and
    Escape or the overlay closes it and gives focus back to the ☰ button (18 Nov 2026). */
 var mobile=window.matchMedia('(max-width:950px)');
 function isOpen(){return body.classList.contains('dzoft-editor-menu-open');}
 function sync(){
   var open=isOpen();
   aside.inert=mobile.matches&&!open;
   overlay.hidden=!mobile.matches||!open;
   toggle.setAttribute('aria-expanded',String(mobile.matches&&open));
 }
 function close(giveFocusBack){
   var was=isOpen();
   body.classList.remove('dzoft-editor-menu-open');sync();
   if(giveFocusBack&&was)toggle.focus();
 }
 toggle.addEventListener('click',function(){
   var open=!isOpen();
   body.classList.toggle('dzoft-editor-menu-open',open);sync();
   if(open){var first=aside.querySelector('a[href]');if(first)first.focus();}
 });
 overlay.addEventListener('click',function(){close(true);});
 document.addEventListener('keydown',function(e){
   if(!mobile.matches||!isOpen())return;
   if(e.key==='Escape'){e.preventDefault();close(true);return;}
   if(e.key!=='Tab')return;
   var links=Array.prototype.slice.call(aside.querySelectorAll('a[href]'));
   var first=links[0],last=links[links.length-1],inside=aside.contains(document.activeElement);
   if(!first)return;
   if(e.shiftKey&&(!inside||document.activeElement===first)){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(!inside||document.activeElement===last)){e.preventDefault();first.focus();}
 });
 aside.addEventListener('click',function(e){if(e.target.closest('a'))close(false);});
 if(mobile.addEventListener)mobile.addEventListener('change',function(){close(false);});
 sync();
 function translate(){
   var english=document.documentElement.lang==='en';
   aside.querySelectorAll('a[data-fr][data-en]').forEach(function(a){
     a.querySelector('.dzoft-editor-item-label').textContent=a.dataset[english?'en':'fr'];
   });
   toggle.setAttribute('aria-label',english?'Open navigation':'Ouvrir la navigation');
   overlay.setAttribute('aria-label',english?'Close navigation':'Fermer la navigation');
   aside.setAttribute('aria-label',english?'DZOFT navigation':'Navigation DZOFT');
   aside.querySelector('nav').setAttribute('aria-label',english?'Main navigation':'Navigation principale');
 }
 document.addEventListener('dzoft:locale-change',translate);translate();
})();
