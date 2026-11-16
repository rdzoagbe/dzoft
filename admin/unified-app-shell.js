/* DZOFT shared chrome: brand and breadcrumbs only.
 * workspace-nav-v6.js is the sole sidebar/mobile route owner.
 * Do not inject legacy navigation items or rewrite project links here.
 */
(function(){
'use strict';
var app=document.getElementById('app');
if(!app)return;
if(!app.querySelector('.dzoft-side-brand')){
 var brand=document.createElement('a');
 brand.className='dzoft-side-brand';
 brand.href='#/tableau-de-bord';
 brand.setAttribute('aria-label','DZOFT · Tableau de bord');
 brand.innerHTML='<img src="../assets/dzoft-favicon.svg" alt=""><span>DZOFT</span>';
 app.appendChild(brand);
}
var header=app.querySelector('.top .in');
if(!header)return;
var crumb=header.querySelector('.dzoft-header-breadcrumb');
if(!crumb){
 crumb=document.createElement('div');
 crumb.className='dzoft-header-breadcrumb';
 crumb.innerHTML='<a href="#/tableau-de-bord">DZOFT</a><span aria-hidden="true">›</span><strong id="dzoft-header-section"></strong>';
 var formerBrand=header.querySelector('.brand');
 if(formerBrand)formerBrand.insertAdjacentElement('afterend',crumb);else header.prepend(crumb);
}
var who=header.querySelector('#who');
if(who&&!header.querySelector('.dzoft-header-avatar')){
 var avatar=document.createElement('span');avatar.className='dzoft-header-avatar';
 avatar.textContent='RD';avatar.setAttribute('aria-hidden','true');
 who.insertAdjacentElement('afterend',avatar);
}
var titles={
 'tableau-de-bord':['Tableau de bord','Dashboard'],
 'vue-globale':['Tableau de bord','Dashboard'],
 'dossiers':['Clients','Clients'],
 'clients':['Clients','Clients'],
 'demandes':['Demandes reçues','Requests'],
 'devis':['Devis & Chiffrage','Quotes & pricing'],
 'projets':['Projets','Projects'],
 'messages':['Messages','Messages'],
 'factures':['Factures','Invoices'],
 'paiements':['Paiements','Payments'],
 'journal':['Journal & Suivi','Journal & tracking'],
 'documents':['Documents','Documents'],
 'catalogue':['Catalogue (Prestations)','Service catalogue'],
 'rapports':['Rapports','Reports'],
 'parametres':['Paramètres','Settings'],
 'corbeille':['Corbeille','Trash']
};
function refresh(){
 var route=location.hash.slice(1).replace(/^\//,'').split(/[?&]/)[0]||'tableau-de-bord';
 var label=titles[route]||titles['tableau-de-bord'];
 var title=document.getElementById('dzoft-header-section');
 if(title)title.textContent=label[document.documentElement.lang==='en'?1:0];
}
window.addEventListener('hashchange',refresh);
document.addEventListener('dzoft:locale-change',refresh);
refresh();
})();
