/* Single navigation menu only for an INSTALLED mobile DZOFT Admin PWA.
   Ordinary browser tabs, desktop and the client portal retain their existing UI. */
(function(){
'use strict';
var app=document.getElementById('app');
var header=app&&app.querySelector('.top .in');
if(!header)return;
var narrow=window.matchMedia?window.matchMedia('(max-width: 980px)'):null;
var standalone=window.matchMedia?window.matchMedia('(display-mode: standalone)'):null;
var menu=document.createElement('details');
menu.className='installed-app-menu';
menu.id='dzoft-installed-app-menu';
menu.innerHTML='<summary id="dzoft-installed-menu-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="dzoft-installed-menu-panel">'+
  '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'+
  '<path d="M4 6h16M4 12h16M4 18h16"/></svg></summary>'+
  '<nav class="installed-app-menu-panel" id="dzoft-installed-menu-panel" aria-label="Navigation DZOFT"></nav>';
header.appendChild(menu);
var toggle=menu.querySelector('summary'),panel=menu.querySelector('nav');
var icons={};
['dash','dossiers','leads','clients','quotes','projects','inbox','finance','settings','trash'].forEach(function(key){
 var source=app.querySelector('.side [data-tab="'+key+'"] svg');
 icons[key]=source?source.outerHTML:'';
});
// Keep the early installed-PWA menu identical to the seven canonical Admin routes.
// workspace-nav-v6.js reuses these same destinations when it finishes loading.
var groups=[
 {fr:'Navigation',en:'Navigation',items:[
  {key:'dash',slug:'tableau-de-bord',fr:'Tableau de bord',en:'Dashboard'},
  {key:'clients',slug:'clients',fr:'Clients',en:'Clients'},
  {key:'quotes',slug:'devis',fr:'Devis',en:'Quotes'},
  {key:'projects',slug:'projets',fr:'Projets',en:'Projects'},
  {key:'finance',slug:'comptabilite',fr:'Comptabilité',en:'Accounts'},
  {key:'inbox',slug:'messages',fr:'Messages',en:'Messages'},
  {key:'settings',slug:'parametres',fr:'Paramètres',en:'Settings'}]},
 {fr:'Compte',en:'Account',items:[
  {key:'site',url:'../?workspace=admin',fr:'Voir le site',en:'View website'},
  {key:'logout',action:'logout',fr:'Déconnexion',en:'Log out'}]}
];
function makeItem(item){
 var node=document.createElement(item.url?'a':'button');
 if(item.url){node.href=item.url;node.target='_blank';node.rel='noopener noreferrer';}
 else node.type='button';
 node.className='installed-menu-item';
 node.dataset.menuKey=item.key;
 if(item.slug)node.dataset.appRoute=item.slug;
 if(item.action)node.dataset.appAction=item.action;
 var icon=document.createElement('span');icon.className='installed-menu-icon';icon.setAttribute('aria-hidden','true');
 if(icons[item.key])icon.innerHTML=icons[item.key];
 else icon.textContent=item.key==='logout'?'↪':'↗';
 var label=document.createElement('span');label.className='installed-menu-label';label.dataset.noTranslate='true';
 label.dataset.fr=item.fr;label.dataset.en=item.en;
 node.append(icon,label);
 return node;
}
groups.forEach(function(group){
 var part=document.createElement('div');part.className='installed-menu-section';
 var heading=document.createElement('p');heading.className='installed-menu-heading';heading.dataset.noTranslate='true';heading.dataset.fr=group.fr;heading.dataset.en=group.en;
 part.appendChild(heading);
 group.items.forEach(function(item){part.appendChild(makeItem(item));});
 panel.appendChild(part);
});
function en(){return document.documentElement.lang==='en';}
function translate(){
 panel.querySelectorAll('[data-fr][data-en]').forEach(function(el){el.textContent=en()?el.dataset.en:el.dataset.fr;});
 var open=menu.open;
 toggle.setAttribute('aria-label',en()?(open?'Close menu':'Open menu'):(open?'Fermer le menu':'Ouvrir le menu'));
 panel.setAttribute('aria-label',en()?'DZOFT navigation':'Navigation DZOFT');
}
function updateSelected(){
 var current=location.hash.replace(/^#\/?/,'').split(/[?&]/)[0]||'tableau-de-bord';
 panel.querySelectorAll('[data-app-route]').forEach(function(item){
   if(item.dataset.appRoute===current)item.setAttribute('aria-current','page');
   else item.removeAttribute('aria-current');
 });
}
function syncMode(){
 var installed=(standalone&&standalone.matches)||navigator.standalone===true;
 var mobile=narrow?narrow.matches:window.innerWidth<=980;
 document.body.classList.toggle('dzoft-installed-mobile',!!(installed&&mobile));
 if(!(installed&&mobile))menu.open=false;
}
panel.addEventListener('click',function(event){
 var item=event.target.closest('[data-app-route],[data-app-action]');
 if(!item){
   // Project-specific links are injected later by unified-app-shell.js.
   // They are ordinary anchors rather than app-route buttons.
   if(event.target.closest('.dzoft-mobile-project a[href]'))menu.open=false;
   return;
 }
 if(item.dataset.appRoute){
   location.hash='#/'+item.dataset.appRoute;menu.open=false;updateSelected();
 }else if(item.dataset.appAction==='logout'){
   menu.open=false;
   var existing=document.getElementById('b-out');
   if(existing)existing.click(); // Reuses the existing authenticated sign-out handler.
 }
});
menu.addEventListener('toggle',function(){
 toggle.setAttribute('aria-expanded',menu.open?'true':'false');
 translate();
});
menu.addEventListener('keydown',function(event){
 if(event.key==='Escape'&&menu.open){event.preventDefault();menu.open=false;toggle.focus();}
});
document.addEventListener('pointerdown',function(event){
 if(menu.open&&!menu.contains(event.target))menu.open=false;
});
window.addEventListener('hashchange',function(){menu.open=false;updateSelected();});
document.addEventListener('dzoft:locale-change',translate);
if(narrow&&narrow.addEventListener)narrow.addEventListener('change',syncMode);
if(standalone&&standalone.addEventListener)standalone.addEventListener('change',syncMode);
window.addEventListener('pageshow',syncMode);
translate();updateSelected();syncMode();
})();
