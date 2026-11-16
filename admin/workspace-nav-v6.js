/* DZOFT v6 unified navigation, same information architecture on all admin pages.
   Anchors are real routes; no placeholder (#) links and no invented data writes. */
(function(){
'use strict';
var isProject=/\/projet\.html$/i.test(location.pathname);
var id=isProject?new URLSearchParams(location.search).get('q'):null;
var validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
var english=function(){return document.documentElement.lang==='en';};
var routes=[
 {slug:'tableau-de-bord',fr:'Tableau de bord',en:'Dashboard',glyph:'⌂'},
 {slug:'clients',fr:'Clients',en:'Clients',glyph:'♧'},
 {slug:'projets',fr:'Projets',en:'Projects',glyph:'▱',projectPanel:'overview',id:'pf-side-project'},
 {slug:'devis',fr:'Devis & Chiffrage',en:'Quotes & pricing',glyph:'▤',projectPanel:'quotes'},
 {slug:'factures',fr:'Factures',en:'Invoices',glyph:'▧',projectPanel:'invoices',id:'pf-side-invoices'},
 {slug:'paiements',fr:'Paiements',en:'Payments',glyph:'▣',projectPanel:'payments'},
 {slug:'journal',fr:'Journal & Suivi',en:'Journal & tracking',glyph:'☷',projectPanel:'journal',id:'pf-side-journal'},
 {slug:'documents',fr:'Documents',en:'Documents',glyph:'□',projectPanel:'documents',id:'pf-side-documents'},
 {slug:'catalogue',fr:'Catalogue (Prestations)',en:'Service catalogue',glyph:'♧'},
 {slug:'rapports',fr:'Rapports',en:'Reports',glyph:'▥'},
 {slug:'parametres',fr:'Paramètres',en:'Settings',glyph:'⚙'}
];
var home=function(slug){return (isProject?'./':'')+'#/'+slug;};
var projectLink=function(item){return validId&&item.projectPanel?'projet.html?q='+encodeURIComponent(id)+'#'+item.projectPanel:home(item.slug);};
var url=function(item){return isProject&&validId&&item.projectPanel?('#'+item.projectPanel):home(item.slug);};
var nav=document.querySelector(isProject?'#pf-sidebar .pf-side-links':'#app .side');
if(!nav)return;
nav.replaceChildren();
nav.removeAttribute('role');
nav.classList.add('dzoft-v6-nav');
var entries={};
routes.forEach(function(item,index){
 if(item.slug==='parametres'){var hr=document.createElement('div');hr.className='dzoft-v6-divider';hr.setAttribute('aria-hidden','true');nav.appendChild(hr);}
 var a=document.createElement('a');
 a.href=url(item);a.className='dzoft-v6-link';a.dataset.route=item.slug;
 a.dataset.fr=item.fr;a.dataset.en=item.en;
 if(isProject&&item.id)a.id=item.id;
 if(isProject&&item.slug==='tableau-de-bord')a.id='pf-side-dashboard';
 if(isProject&&item.slug==='clients')a.id='pf-side-cases';
 var icon=document.createElement('span');icon.className='dzoft-v6-icon';icon.setAttribute('aria-hidden','true');icon.textContent=item.glyph;
 var label=document.createElement('span');label.className='dzoft-v6-label';label.textContent=english()?item.en:item.fr;
 a.append(icon,label);nav.appendChild(a);
 entries[item.slug]=a;
});
function active(){
 var current=isProject?(location.hash.slice(1)||'overview'):location.hash.replace(/^#\/?/,'')||'tableau-de-bord';
 if(current==='vue-globale')current='tableau-de-bord';
 if(current==='dossiers')current='clients';
 if(current==='demandes')current='clients';
 if(current==='corbeille')current='parametres';
 var selected=current;
 if(isProject){var map={overview:'projets',quotes:'devis',invoices:'factures',payments:'paiements',extras:'projets',activity:'journal',journal:'journal',documents:'documents'};selected=map[current]||'projets';}
 if(!isProject&&current==='vue-classique')selected='tableau-de-bord';
 Object.keys(entries).forEach(function(key){
   var a=entries[key];if(key===selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 });
 var main=document.getElementById('dzoft-v6-page-title');
 if(main)main.textContent=entries[selected]?entries[selected].querySelector('.dzoft-v6-label').textContent:(english()?'Workspace':'Espace de gestion');
 // Keep installed mobile navigation consistent without changing its logout logic.
 document.querySelectorAll('#dzoft-installed-menu-panel [data-app-route]').forEach(function(a){
   if(a.dataset.appRoute===selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 });
}
function translate(){
 routes.forEach(function(item){var a=entries[item.slug];if(a)a.querySelector('.dzoft-v6-label').textContent=english()?item.en:item.fr;});
 active();
}
function mobile(){
 var panel=document.getElementById('dzoft-installed-menu-panel');
 if(!panel)return;
 // Existing installed-app-menu.js owns the toggle and delegated route handler.
 // Rebuild only its navigation destinations, retaining its safe logout control.
 var old=Array.from(panel.querySelectorAll('[data-app-action="logout"]'))[0];
 panel.replaceChildren();
 var title=document.createElement('p');title.className='installed-menu-heading';title.textContent=english()?'Navigation':'Navigation';panel.appendChild(title);
 routes.forEach(function(item){
   var b=document.createElement('button');b.type='button';b.className='installed-menu-item';b.dataset.appRoute=item.slug;
   var icon=document.createElement('span');icon.className='installed-menu-icon';icon.setAttribute('aria-hidden','true');icon.textContent=item.glyph;
   var txt=document.createElement('span');txt.className='installed-menu-label';txt.dataset.fr=item.fr;txt.dataset.en=item.en;txt.textContent=english()?item.en:item.fr;
   b.append(icon,txt);panel.appendChild(b);
 });
 if(old)panel.appendChild(old);
}
if(!isProject)mobile();
document.addEventListener('dzoft:locale-change',function(){translate();var panel=document.getElementById('dzoft-installed-menu-panel');if(panel)panel.querySelectorAll('[data-fr][data-en]').forEach(function(x){x.textContent=x.dataset[english()?'en':'fr'];});});
window.addEventListener('hashchange',active);
window.addEventListener('pageshow',active);
translate();
window.DzoftNavigationV6={routes:routes.map(function(r){return r.slug;}),refresh:active};
})();
