/* One persistent owner navigation across every authenticated global section.
   Project links derive exclusively from already-loaded, authorized admin choices.
   Nothing is stored or sent to a new service. */
(function(){
'use strict';
var app=document.getElementById('app');
if(!app)return;
var side=app.querySelector('.side'),switcher=document.getElementById('sd-project-select');
if(!side)return;
if(!app.querySelector('.dzoft-side-brand')){
 var link=document.createElement('a');link.className='dzoft-side-brand';
 link.href='#/tableau-de-bord';link.setAttribute('aria-label','DZOFT · Tableau de bord');
 link.innerHTML='<img src="../assets/dzoft-favicon.svg" alt=""><span>DZOFT</span>';
 app.appendChild(link);
}
var header=app.querySelector('.top .in');
if(header&&!header.querySelector('.dzoft-header-breadcrumb')){
 var crumb=document.createElement('div');crumb.className='dzoft-header-breadcrumb';
 crumb.innerHTML='<a href="#/vue-globale">DZOFT</a><span aria-hidden="true">›</span><strong id="dzoft-header-section">Vue globale</strong>';
 var brand=header.querySelector('.brand');
 if(brand)brand.insertAdjacentElement('afterend',crumb);else header.prepend(crumb);
 var who=header.querySelector('#who');
 if(who){
  var badge=document.createElement('span');
  badge.className='dzoft-header-avatar';badge.textContent='RD';badge.setAttribute('aria-hidden','true');
  who.insertAdjacentElement('afterend',badge);
 }
}
var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var english=function(){return document.documentElement.lang==='en';};
var global=side.querySelector('.dzoft-global-overview');
if(!global){
 global=document.createElement('a');global.className='dzoft-side-route dzoft-global-overview';
 global.href='#/vue-globale';global.dataset.fr='Vue globale';global.dataset.en='Global overview';
 global.innerHTML='<span class="dzoft-nav-symbol" aria-hidden="true">◫</span><span class="dzoft-nav-text"></span>';
 var dash=side.querySelector('[data-tab="dash"]');
 if(dash)dash.insertAdjacentElement('afterend',global);
}
var group=document.createElement('div');group.className='dzoft-project-nav';group.hidden=true;
var sep=document.createElement('div');sep.className='dzoft-project-divider';sep.setAttribute('aria-hidden','true');
var header=document.createElement('p');header.className='dzoft-project-heading';
header.dataset.fr='PROJET SÉLECTIONNÉ';header.dataset.en='SELECTED PROJECT';
group.append(sep,header);
var items=[
 {slug:'',fr:'Dossier en cours',en:'Current project',symbol:'◇'},
 {slug:'#invoices',fr:'Factures du projet',en:'Project invoices',symbol:'▧'},
 {slug:'#journal',fr:'Journal privé',en:'Private journal',symbol:'☷'},
 {slug:'#documents',fr:'Documents du projet',en:'Project documents',symbol:'▢'}
];
items.forEach(function(item){
 var a=document.createElement('a');a.className='dzoft-side-route';
 a.dataset.projectTarget=item.slug;a.dataset.fr=item.fr;a.dataset.en=item.en;
 var symbol=document.createElement('span');symbol.className='dzoft-nav-symbol';symbol.setAttribute('aria-hidden','true');symbol.textContent=item.symbol;
 var txt=document.createElement('span');txt.className='dzoft-nav-text';a.append(symbol,txt);group.appendChild(a);
});
var firstHr=side.querySelector('hr');
if(firstHr)side.insertBefore(group,firstHr);else side.appendChild(group);
function refresh(){
 var selected=switcher&&switcher.value||'';
 if(!uuid.test(selected)){group.hidden=true;refreshMobile('');return;}
 group.hidden=false;
 group.querySelectorAll('[data-project-target]').forEach(function(a){
  var slug=a.dataset.projectTarget;
  a.href=slug.startsWith('suivi:')?'suivi.html?q='+encodeURIComponent(selected)+'#'+slug.slice(6):
   'projet.html?q='+encodeURIComponent(selected)+slug;
 });
 refreshMobile(selected);
}
function refreshMobile(selected){
 var panel=document.getElementById('dzoft-installed-menu-panel');
 if(!panel)return;
 var existing=panel.querySelector('.dzoft-mobile-project');
 if(!uuid.test(selected)){if(existing)existing.remove();return;}
 if(!existing){
  existing=document.createElement('div');
  existing.className='installed-menu-section dzoft-mobile-project';
  var title=document.createElement('p');
  title.className='installed-menu-heading';title.dataset.fr='Projet sélectionné';title.dataset.en='Selected project';
  existing.appendChild(title);
  items.forEach(function(item){
   var a=document.createElement('a');a.className='installed-menu-item';
   a.dataset.projectTarget=item.slug;
   var ico=document.createElement('span');ico.className='installed-menu-icon';ico.setAttribute('aria-hidden','true');ico.textContent=item.symbol;
   var label=document.createElement('span');label.className='installed-menu-label';label.dataset.fr=item.fr;label.dataset.en=item.en;
   a.append(ico,label);existing.appendChild(a);
  });
  panel.appendChild(existing);
 }
 existing.querySelectorAll('[data-project-target]').forEach(function(a){
   var slug=a.dataset.projectTarget;
   a.href=slug.startsWith('suivi:')?'suivi.html?q='+encodeURIComponent(selected)+'#'+slug.slice(6):
    'projet.html?q='+encodeURIComponent(selected)+slug;
 });
 existing.querySelectorAll('[data-fr][data-en]').forEach(function(node){node.textContent=node.dataset[english()?'en':'fr'];});
}
function translate(){
 var en=english();
 global.querySelector('.dzoft-nav-text').textContent=global.dataset[en?'en':'fr'];
 header.textContent=header.dataset[en?'en':'fr'];
 group.querySelectorAll('[data-project-target]').forEach(function(a){
   a.querySelector('.dzoft-nav-text').textContent=a.dataset[en?'en':'fr'];
 });
 var mobile=document.querySelector('.dzoft-mobile-project');if(mobile)mobile.querySelectorAll('[data-fr][data-en]').forEach(function(node){node.textContent=node.dataset[en?'en':'fr'];});
}
function selection(){
 var current=location.hash.slice(1).replace(/^\//,'');
 var globalSelected=current==='vue-globale';
 if(globalSelected)global.setAttribute('aria-current','page');
 else global.removeAttribute('aria-current');
 var dash=side.querySelector('[data-tab="dash"]');
 if(dash&&globalSelected)dash.setAttribute('aria-selected','false');
 var titles={
  'vue-globale':['Vue globale','Global overview'],
  'tableau-de-bord':['Tableau de bord','Dashboard'],
  'dossiers':['Dossiers clients','Client cases'],
  'clients':['Clients','Clients'],
  'projets':['Projets','Projects'],
  'devis':['Devis','Quotes'],
  'demandes':['Demandes reçues','Requests'],
  'messages':['Messages','Messages'],
  'paiements':['Paiements','Payments'],
  'factures':['Factures','Invoices'],
  'journal':['Journal & Suivi','Journal & tracking'],
  'documents':['Documents','Documents'],
  'catalogue':['Catalogue (Prestations)','Service catalogue'],
  'rapports':['Rapports','Reports'],
  'parametres':['Paramètres','Settings'],
  'corbeille':['Corbeille','Trash']
 };
 var title=document.getElementById('dzoft-header-section');
 if(title){var labels=titles[current]||titles['tableau-de-bord'];title.textContent=labels[english()?1:0];}
}
document.addEventListener('dzoft:locale-change',function(){translate();selection();});
window.addEventListener('hashchange',selection);
window.addEventListener('dzoft:data-refreshed',refresh);
if(switcher)switcher.addEventListener('change',refresh);
translate();selection();refresh();
})();
