(function(){
'use strict';
var app=document.getElementById('app'),side=app&&app.querySelector('.side'),main=app&&app.querySelector('.shell main');
if(!app||!side||!main)return;
var en=function(){return document.documentElement.lang==='en';};
var tr=function(fr,english){return en()?english:fr;};
var nav=function(id,fr,english,svg){
 var b=document.createElement('button');b.type='button';b.className='tab';b.dataset.tab=id;b.setAttribute('role','tab');b.setAttribute('aria-selected','false');
 b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+svg+'</svg><span data-fr="'+fr+'" data-en="'+english+'">'+tr(fr,english)+'</span>';
 b.addEventListener('click',function(){location.hash='#/'+(id==='dossiers'?'dossiers':id==='finance'?'paiements':id);});return b;
};
var folder=nav('dossiers','Dossiers clients','Clients & projects','<path d="M3 7h7l2 2h9v11H3z"/><path d="M3 7V5h7l2 2"/>');
var finance=nav('finance','Factures & paiements','Billing','<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h3"/>');
var dashboard=side.querySelector('[data-tab=dash]'),inbox=side.querySelector('[data-tab=inbox]');
if(dashboard)dashboard.insertAdjacentElement('afterend',folder);
if(inbox)inbox.insertAdjacentElement('afterend',finance);
['leads','clients','quotes','projects'].forEach(function(key){var old=side.querySelector('[data-tab='+key+']');if(old)old.hidden=true;});
var dossiers=document.createElement('section');dossiers.id='v-dossiers';dossiers.hidden=true;
dossiers.innerHTML='<div class="simplified-heading"><div><p class="simplified-eyebrow">DZOFT · WORKSPACE</p><h2 id="dossiers-title"></h2><p id="dossiers-intro"></p></div><label class="workspace-search"><span class="sr-only">Rechercher un dossier</span><input type="search" id="dossier-search" placeholder="Rechercher un client, une demande ou un projet…"></label></div><div class="dossier-switch" role="group" aria-label="Type de dossier"></div>';
var lead=document.getElementById('v-leads');if(lead)main.insertBefore(dossiers,lead);
var choices=[['leads','Demandes','Requests','demandes'],['clients','Clients','Clients','clients'],['quotes','Devis','Quotes','devis'],['projects','Projets','Projects','projets']];
choices.forEach(function(c){
 var b=document.createElement('button');b.type='button';b.className='dossier-pill';b.dataset.dossier=c[0];b.setAttribute('aria-pressed','false');
 b.dataset.fr=c[1];b.dataset.en=c[2];b.textContent=tr(c[1],c[2]);
 b.addEventListener('click',function(){location.hash='#/'+c[3];});
 dossiers.querySelector('.dossier-switch').appendChild(b);
 var node=document.getElementById('v-'+c[0]);if(node)dossiers.appendChild(node);
});
var fin=document.createElement('section');fin.id='v-finance';fin.hidden=true;
fin.innerHTML='<div class="simplified-heading"><div><p class="simplified-eyebrow">DZOFT · FINANCES</p><h2 id="finance-title"></h2><p id="finance-intro"></p></div></div><div id="finance-content" aria-live="polite"><div class="empty">Chargement…</div></div>';
main.insertBefore(fin,document.getElementById('v-settings'));
var email=document.querySelector('#v-dash #email-log');
if(email&&email.parentElement){
 var panel=email.parentElement,details=document.createElement('details');details.className='simplified-archive';
 var summary=document.createElement('summary');summary.dataset.fr='Historique des e-mails et notifications';summary.dataset.en='Email and notification history';
 summary.textContent=tr(summary.dataset.fr,summary.dataset.en);
 panel.parentElement.insertBefore(details,panel);details.append(summary,panel);
}
var search=document.getElementById('dossier-search');
function applySearch(){
 var term=search.value.toLocaleLowerCase().trim();
 [['c-search','clients'],['q-search','quotes']].forEach(function(item){var input=document.getElementById(item[0]);if(input&&input.value!==search.value){input.value=search.value;input.dispatchEvent(new Event('input',{bubbles:true}));}});
 document.querySelectorAll('#leads .lead,#projects .v4-project-card,#projects tbody tr').forEach(function(el){el.hidden=!!term&&!el.textContent.toLocaleLowerCase().includes(term);});
}
search.addEventListener('input',applySearch);
window.addEventListener('dzoft:data-refreshed',applySearch);
var top=app.querySelector('.top .in');
if(top){
 var controls=document.createElement('details');controls.className='workspace-more';
 controls.innerHTML='<summary aria-label="Menu du compte">☰</summary><div class="workspace-more-menu"><button type="button" data-extra="settings"></button><button type="button" data-extra="trash"></button><a href="../?workspace=admin" target="_blank" rel="noopener noreferrer" data-extra="site"></a><button type="button" data-extra="logout"></button></div>';
 top.insertBefore(controls,document.getElementById('b-out'));
 controls.querySelectorAll('button[data-extra]').forEach(function(b){b.addEventListener('click',function(){
   controls.open=false;
   if(b.dataset.extra==='logout'){var out=document.getElementById('b-out');if(out)out.click();return;}
   location.hash='#/'+(b.dataset.extra==='settings'?'parametres':'corbeille');
  });});
}
function translate(){
 if(dashboard){dashboard.lastChild&&dashboard.lastChild.nodeType===3&&(dashboard.lastChild.textContent=tr('Aujourd’hui','Today'));}
 document.querySelectorAll('[data-fr][data-en]').forEach(function(node){node.textContent=tr(node.dataset.fr,node.dataset.en);});
 document.getElementById('dossiers-title').textContent=tr('Tous mes dossiers','All cases');
 document.getElementById('dossiers-intro').textContent=tr('Un seul espace pour retrouver un client, sa demande, son devis et son projet.','Find a client, request, quote or project in one place.');
 search.placeholder=tr('Trouver un client, un devis, un projet…','Find a client, quote or project…');
 document.getElementById('finance-title').textContent=tr('Factures et paiements','Invoices & payments');
 document.getElementById('finance-intro').textContent=tr('Encaissements vérifiés, soldes et factures par projet : sélectionnez un projet pour agir.','Verified receipts, balances and invoices by project. Open a project to take action.');
 var more=app.querySelector('.workspace-more');if(more){
  more.querySelector('[data-extra=settings]').textContent=tr('Paramètres','Settings');
  more.querySelector('[data-extra=trash]').textContent=tr('Corbeille','Trash');
  more.querySelector('[data-extra=site]').textContent=tr('Voir le site','View website');
  more.querySelector('[data-extra=logout]').textContent=tr('Déconnexion','Log out');
 }
 if(email){var d=email.closest('details');if(d){d.querySelector('summary').textContent=tr('Historique des e-mails et notifications','Email and notification history');}}
}
// Keep trash reachable without a sixth primary navigation item.
var settings=document.getElementById('v-settings');
if(settings&&!document.getElementById('workspace-trash-link')){
 var link=document.createElement('a');link.id='workspace-trash-link';
 link.href='#/corbeille';link.className='btn sm line workspace-trash-link';
 settings.appendChild(link);
}
var shortcuts=document.querySelector('#v-dash .dashboard-shortcuts');
if(shortcuts&&!document.getElementById('workspace-finance-shortcut')){
 var billing=document.createElement('a');billing.href='#/paiements';
 billing.id='workspace-finance-shortcut';billing.className='btn sm line';
 shortcuts.appendChild(billing);
}
var oldTranslate=translate;
translate=function(){
 oldTranslate();
 var trash=document.getElementById('workspace-trash-link');
 if(trash)trash.textContent=tr('Voir la corbeille et restaurer','View trash and restore');
 var billing=document.getElementById('workspace-finance-shortcut');
 if(billing)billing.textContent=tr('Voir factures et paiements','Invoices and payments');
};
document.addEventListener('dzoft:locale-change',translate);translate();
})();