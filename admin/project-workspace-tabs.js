/* DZOFT Project Workspace — focused navigation, existing business logic untouched.
   Moves existing DOM nodes (and their listeners); never clones user data or writes to backend.
   All project tools remain available in four discoverable areas. */
(function(){
'use strict';
var shell=document.querySelector('.workspace-shell');
var main=shell&&shell.querySelector('#main');
var intro=main&&main.querySelector('.workspace-intro');
var layout=main&&main.querySelector('.workspace-columns');
var advanced=main&&main.querySelector('.workspace-advanced');
if(!main||!intro||!layout||!advanced||!document.getElementById('c-inv'))return;
var work=layout.querySelector('.workspace-primary');
var aside=layout.querySelector('.workspace-aside');
if(!work||!aside)return;

var en=function(){return document.documentElement.lang==='en';};
var tr=function(fr,english){return en()?english:fr;};
var translateNode=function(node){if(node&&node.dataset.fr&&node.dataset.en)node.textContent=tr(node.dataset.fr,node.dataset.en);};

var nav=document.createElement('nav');
nav.className='project-focus-tabs';
nav.setAttribute('role','tablist');
nav.setAttribute('aria-label','Project sections');
var host=document.createElement('div');
host.className='project-focus-panels';
/* One project page (17 Nov 2026): five tabs. « billing » keeps its id so existing links (#billing/pay…) still work. */
var sections=[
 {id:'overview',fr:'Vue d’ensemble',en:'Overview'},
 {id:'work',fr:'Travail',en:'Work'},
 {id:'billing',fr:'Argent',en:'Money'},
 {id:'documents',fr:'Documents',en:'Documents'},
 {id:'messages',fr:'Messages',en:'Messages'}
];
var panes={};
sections.forEach(function(item){
 var button=document.createElement('button');
 button.type='button';button.className='project-focus-tab';
 button.setAttribute('role','tab');button.id='project-tab-'+item.id;
 button.dataset.projectTab=item.id;button.dataset.fr=item.fr;button.dataset.en=item.en;
 button.setAttribute('aria-controls','project-panel-'+item.id);
 button.setAttribute('aria-selected','false');button.tabIndex=-1;
 button.textContent=tr(item.fr,item.en);
 nav.appendChild(button);
 var panel=document.createElement('section');
 panel.id='project-panel-'+item.id;panel.className='project-focus-panel';
 panel.setAttribute('role','tabpanel');
 panel.setAttribute('aria-labelledby',button.id);
 panel.hidden=true;paneTitle(item,panel);
 host.appendChild(panel);panes[item.id]=panel;
});
function paneTitle(item,panel){
 var h=document.createElement('div');h.className='project-panel-heading';
 h.innerHTML='<h2></h2><p></p>';h.querySelector('h2').dataset.fr=item.fr;
 h.querySelector('h2').dataset.en=item.en;
 var subs={
  work:['Étapes, avancement publié et journal privé.','Milestones, published progress and private journal.'],
  billing:['Factures, paiements reçus, suppléments et suivi mensuel.','Invoices, payments received, extra work and monthly maintenance.'],
  documents:['Contrat, compléments, factures et reçus en PDF, puis les fichiers du projet et ceux du client.','Contract, extra work, invoices and receipts as PDF, then project and client files.'],
  messages:['Échanges avec le client et historique des e-mails.','Client conversations and email history.']
 };
 if(subs[item.id]){h.querySelector('p').dataset.fr=subs[item.id][0];h.querySelector('p').dataset.en=subs[item.id][1];}
 else h.hidden=true;
 if(subs[item.id])panel.appendChild(h);
}
intro.insertAdjacentElement('afterend',nav);
nav.insertAdjacentElement('afterend',host);

var overview=panes.overview, workPane=panes.work, billing=panes.billing, docsPane=panes.documents, messages=panes.messages;
/* 17 Nov 2026: one project page. The client card and the money tiles (project-summary.js) replace the former one-line
   summary, which repeated the next step and the balance shown above. */
// Client card, money tiles and project scope (admin/project-summary.js).
var summaryBox=document.createElement('div');summaryBox.id='ps-summary';summaryBox.className='ps-summary';overview.appendChild(summaryBox);

// Keep the actual elements so existing events, security gates, forms, uploads,
// invoice numbering and server-side payment logic behave exactly as before.
workPane.appendChild(work);
billing.appendChild(document.getElementById('c-inv'));
var changes=document.getElementById('c-changes');
if(changes)billing.appendChild(changes);
var care=document.getElementById('c-care');
if(care)billing.appendChild(care.closest('.workspace-fold')||care);
// Documents: official PDFs first, then shared documents and the client's files (opened, not folded).
var official=document.createElement('section');official.className='card ps-official';
official.innerHTML='<h2 data-fr="Documents officiels" data-en="Official documents"></h2><div id="ps-docs" class="ps-docs" aria-live="polite"></div>';
docsPane.appendChild(official);
// The cards have their own titles: take them out of their folds (a hidden card then leaves nothing behind).
['c-docs','c-files'].forEach(function(id){var node=document.getElementById(id);if(!node)return;var fold=node.closest('.workspace-fold');docsPane.appendChild(node);if(fold)fold.remove();});
var msg=document.getElementById('c-msg');
if(msg)messages.appendChild(msg);
var note=document.getElementById('c-note');
if(note)messages.appendChild(note.closest('.workspace-fold')||note);
var activity=document.getElementById('c-activity');
if(activity){
 var activityFold=document.createElement('details');activityFold.className='workspace-fold';
 var activitySummary=document.createElement('summary');
 activitySummary.dataset.fr='Historique des e-mails et du projet';
 activitySummary.dataset.en='Email and project activity history';
 activityFold.appendChild(activitySummary);activityFold.appendChild(activity);
 messages.appendChild(activityFold);
}
// Keep miscellaneous client-access, signed agreement, technical environment
// and feedback in the existing administrative disclosure on Overview.
overview.appendChild(advanced);
var oldLayout=layout;
oldLayout.remove();
var leftover=aside.children.length;
if(leftover){ // Future app features must not disappear if a new panel was added.
 var extra=document.createElement('details');extra.className='workspace-fold project-more-tools';
 var summary=document.createElement('summary');summary.dataset.fr='Autres outils';summary.dataset.en='Other tools';
 extra.appendChild(summary);extra.appendChild(aside);
 workPane.appendChild(extra);
}

// The data may have arrived before these containers existed.
if(window.DzoftProjectSummary)window.DzoftProjectSummary.render();
var buttons=Array.from(nav.querySelectorAll('[data-project-tab]'));
function focusPane(id,target){
 var pane=panes[id];
 if(!pane)return;
 if(target){
  var element=document.getElementById(target);
  if(element&&pane.contains(element)){
   for(var node=element;node&&node!==pane;node=node.parentElement)
    if(node.tagName==='DETAILS')node.open=true;
   element.scrollIntoView({behavior:'smooth',block:'start'});
   return;
  }
 }
 nav.scrollIntoView({behavior:'smooth',block:'start'});
}
function select(id,opt){
 opt=opt||{};
 if(!panes[id])id='overview';
 buttons.forEach(function(b){
  var active=b.dataset.projectTab===id;
  b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
 });
 sections.forEach(function(item){panes[item.id].hidden=item.id!==id;});
 if((id==='overview'||id==='documents')&&window.DzoftProjectSummary&&window.DzoftProjectSummary.refreshIfStale)window.DzoftProjectSummary.refreshIfStale();
 if(opt.replaceHash!==false){
  var path=location.pathname+location.search;
  history.replaceState(history.state,'',path+'#'+id);
 }
 if(opt.focusButton){var b=nav.querySelector('[data-project-tab="'+id+'"]');if(b)b.focus();}
 if(opt.scroll)requestAnimationFrame(function(){focusPane(id,opt.target);});
 return id;
}
nav.addEventListener('click',function(event){
 var button=event.target.closest('[data-project-tab]');if(button)select(button.dataset.projectTab,{scroll:false});
});
nav.addEventListener('keydown',function(event){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 var index=buttons.indexOf(document.activeElement);if(index<0)return;
 event.preventDefault();
 var next=event.key==='Home'?0:event.key==='End'?buttons.length-1:
   (index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
 select(buttons[next].dataset.projectTab,{focusButton:true});
});
overview.addEventListener('click',function(event){
 var button=event.target.closest('[data-open-project]');
 if(button)select(button.dataset.openProject,{scroll:true});
});
// Existing overview actions previously only scrolled. Now they also reveal
// their corresponding section before focusing the real business component.
intro.addEventListener('click',function(event){
 var action=event.target.closest('[data-workspace-action]');
 if(!action)return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 var dest=action.dataset.workspaceAction;
 if(dest==='extra'){newExtra();return;}
 // Same addresses as the dashboard quick buttons, so the payment and publish forms open themselves.
 var deep={payment:'billing/pay',progress:'work/publish',message:'messages/c-msg'}[dest]||'messages/c-msg';
 history.replaceState(history.state,'',location.pathname+location.search+'#'+deep);
 window.dispatchEvent(new HashChangeEvent('hashchange'));
 if(dest==='message')setTimeout(function(){var field=document.getElementById('reply');if(field)field.focus({preventScroll:true});},350);
},true);
/* « Ajouter un supplément »: Argent, then the priced proposal form, opened (it is drawn after the data loads). */
function newExtra(){
 select('billing',{scroll:true,target:'c-changes'});
 var tries=0;(function open(){
  var form=document.querySelector('#dzoft-owner-changes .dzoft-change-new[data-new-proposal]');
  if(form){form.open=true;form.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(++tries<40)setTimeout(open,150);
 })();
}
window.DzoftProjectWorkspace={open:function(id){return select(id,{scroll:true});},newExtra:newExtra};

function translate(){
 nav.setAttribute('aria-label',tr('Rubriques du projet','Project sections'));
 buttons.forEach(translateNode);
 if(window.DzoftProjectSummary)window.DzoftProjectSummary.render();
 main.querySelectorAll('.project-panel-heading [data-fr][data-en],.ps-official>h2[data-fr],.project-focus-panel .project-more-tools>summary[data-fr],.project-focus-panel .workspace-fold>summary[data-fr]').forEach(translateNode);
}
document.addEventListener('dzoft:locale-change',translate);
// Deep links open the correct tab before navigating to the target control.
 // Explicitly allow only known project sections: never interpret a URL hash
 // as an arbitrary DOM ID or HTML selector.
var deepLinks={
 'work/c-docs':{pane:'documents',target:'c-docs'},
 'work/c-files':{pane:'documents',target:'c-files'},
 'documents/c-docs':{pane:'documents',target:'c-docs'},
 'documents/c-files':{pane:'documents',target:'c-files'},
 'work/c-journal':{pane:'work',target:'c-journal'},
 'work/c-changes':{pane:'billing',target:'c-changes'},
 'billing/c-changes':{pane:'billing',target:'c-changes'},
 'billing/new-extra':{extra:true},
 'billing/c-inv':{pane:'billing',target:'c-inv'},
 'billing/pay':{pane:'billing',target:'c-inv'},
 'work/publish':{pane:'work',target:'c-steps'},
 'messages/c-msg':{pane:'messages',target:'c-msg'}
};
function applyLocationHash(){
 var value=location.hash.replace(/^#/,'');
 var deep=deepLinks[value];
 if(deep&&deep.extra){newExtra();return;}
 if(deep){select(deep.pane,{replaceHash:false,scroll:true,target:deep.target});return;}
 if(panes[value])select(value,{replaceHash:false});
}
window.addEventListener('hashchange',applyLocationHash);
translate();
var initial=location.hash.replace(/^#/,'');
if(deepLinks[initial])applyLocationHash();
else select(panes[initial]?initial:'overview',{replaceHash:false});
})();
