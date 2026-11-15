/* DZOFT owner workspace: a compact landing area and contextual shortcuts.
   Only routes to existing authenticated controls. No new API calls or data writes. */
(function(){
'use strict';
var app=document.getElementById('app');
var dash=app&&document.getElementById('v-dash');
var settings=app&&document.getElementById('v-settings');
var side=app&&app.querySelector('.side');
if(!app||!dash||!settings||!side)return;
var en=function(){return document.documentElement.lang==='en';};
var tr=function(fr,eng){return en()?eng:fr;};
var tools=document.createElement('section');
tools.className='owner-command-bar';
tools.setAttribute('aria-label','Accès rapides');
tools.innerHTML='<div class="owner-command-intro"><span class="owner-command-eyebrow" data-fr="DZOFT · MON ESPACE" data-en="DZOFT · MY WORKSPACE"></span>'+
  '<h2 data-fr="Votre activité, en toute simplicité." data-en="Your work, all in one place."></h2>'+
  '<p data-fr="Retrouvez un dossier ou démarrez une action en un clic." data-en="Find a case or start an action in one click."></p></div>'+
  '<form class="owner-command-search" role="search"><label for="owner-global-search" data-fr="Rechercher partout" data-en="Search your workspace"></label>'+
  '<div class="owner-search-control"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 5 5"></path></svg>'+
  '<input id="owner-global-search" type="search" autocomplete="off" enterkeyhint="search" placeholder="Client, devis ou projet…">'+
  '<button type="submit" class="btn main" data-fr="Chercher" data-en="Find"></button></div></form>'+
  '<div class="owner-command-actions" role="group" aria-label="Actions courantes">'+
  '<button type="button" data-owner-quick="client"><span aria-hidden="true">＋</span><span data-fr="Nouveau client" data-en="New client"></span></button>'+
  '<button type="button" data-owner-quick="quote"><span aria-hidden="true">＋</span><span data-fr="Nouveau devis" data-en="New quote"></span></button>'+
  '<button type="button" data-owner-quick="billing"><span aria-hidden="true">€</span><span data-fr="Voir les paiements" data-en="View payments"></span></button></div>';
var dashBar=dash.querySelector('.bar');
if(dashBar)dashBar.insertAdjacentElement('afterend',tools);else dash.prepend(tools);
var search=tools.querySelector('input');
var form=tools.querySelector('form');
function openDossiers(term){
 var existing=document.getElementById('dossier-search');
 if(existing){
  existing.value=term;
  existing.dispatchEvent(new Event('input',{bubbles:true}));
 }
 location.hash='#/dossiers';
 if(existing)requestAnimationFrame(function(){existing.focus({preventScroll:true});});
}
form.addEventListener('submit',function(e){
 e.preventDefault();
 openDossiers(search.value.trim());
});
tools.addEventListener('click',function(e){
 var b=e.target.closest('[data-owner-quick]');if(!b)return;
 if(b.dataset.ownerQuick==='billing'){location.hash='#/paiements';return;}
 var id=b.dataset.ownerQuick==='client'?'b-cnew':'b-qnew';
 location.hash=b.dataset.ownerQuick==='client'?'#/clients':'#/devis';
 // Reuse the real existing creation UI; never synthesize a write request.
 requestAnimationFrame(function(){var existing=document.getElementById(id);if(existing)existing.click();});
});
// The existing Settings page already links to the trash; do not duplicate it.
function translate(){
 tools.querySelectorAll('[data-fr][data-en]').forEach(function(n){n.textContent=tr(n.dataset.fr,n.dataset.en);});
 search.placeholder=tr('Client, devis ou projet…','Client, quote or project…');
 tools.setAttribute('aria-label',tr('Accès rapides','Quick actions'));
 var cmd=tools.querySelector('.owner-command-actions');
 cmd.setAttribute('aria-label',tr('Actions courantes','Common actions'));
 var navDash=side.querySelector('[data-tab="dash"]');
 if(navDash&&navDash.lastChild&&navDash.lastChild.nodeType===3)
   navDash.lastChild.textContent=tr('Accueil','Home');
 var navFin=side.querySelector('[data-tab="finance"] [data-fr]');
 if(navFin){navFin.dataset.fr='Factures & paiements';navFin.dataset.en='Billing';navFin.textContent=tr(navFin.dataset.fr,navFin.dataset.en);}
}
document.addEventListener('dzoft:locale-change',translate);
translate();
})();
