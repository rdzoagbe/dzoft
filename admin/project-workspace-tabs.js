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
var sections=[
 {id:'overview',fr:'Vue d’ensemble',en:'Overview'},
 {id:'work',fr:'Travail',en:'Work'},
 {id:'billing',fr:'Factures et paiements',en:'Billing'},
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
  work:['Étapes, modifications, journal et fichiers du projet.','Milestones, changes, private notes and project files.'],
  billing:['Factures, encaissements et suivi mensuel.','Invoices, receipts and monthly maintenance.'],
  messages:['Échanges avec le client et historique des e-mails.','Client conversations and email history.']
 };
 if(subs[item.id]){h.querySelector('p').dataset.fr=subs[item.id][0];h.querySelector('p').dataset.en=subs[item.id][1];}
 else h.hidden=true;
 if(subs[item.id])panel.appendChild(h);
}
intro.insertAdjacentElement('afterend',nav);
nav.insertAdjacentElement('afterend',host);

var overview=panes.overview, workPane=panes.work, billing=panes.billing, messages=panes.messages;
var hero=document.createElement('div');hero.className='project-overview-focus';
/* 17 Nov 2026: the three cards repeated the tabs and the action buttons above. One line keeps the two figures that
   matter (next step, money still to receive); the tabs and the buttons above are the only way in. */
hero.innerHTML='<p class="project-overview-line"><span><span data-fr="Prochaine étape" data-en="Next step"></span> : <strong id="project-overview-next">—</strong></span>'+
  '<button type="button" class="project-overview-money" data-open-project="billing"><span data-fr="Reste à encaisser" data-en="Still to receive"></span> : <strong id="project-overview-balance">—</strong> →</button></p>';
overview.appendChild(hero);

// Keep the actual elements so existing events, security gates, forms, uploads,
// invoice numbering and server-side payment logic behave exactly as before.
workPane.appendChild(work);
billing.appendChild(document.getElementById('c-inv'));
var care=document.getElementById('c-care');
if(care)billing.appendChild(care.closest('.workspace-fold')||care);
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
 var id=dest==='payment'?'billing':dest==='progress'||dest==='documents'?'work':'messages';
 var target=dest==='payment'?'tracking-admin':dest==='progress'?'tracking-publish':dest==='documents'?'c-docs':dest==='history'?'c-activity':'c-msg';
 select(id,{scroll:true,target:target});
 if(dest==='message')setTimeout(function(){var field=document.getElementById('reply');if(field)field.focus({preventScroll:true});},350);
},true);
window.DzoftProjectWorkspace={open:function(id){return select(id,{scroll:true});}};

function updateOverview(){
 var next=document.getElementById('workspace-next-value');
 var value=next&&next.textContent.trim();
 document.getElementById('project-overview-next').textContent=value||'—';
 var outstanding=document.getElementById('iv-payment-outstanding');
 var value=outstanding&&outstanding.textContent.trim();
 // Keep the amount only: the label is already written in front of it.
 var amount=value&&value.match(/-?[\d\u00a0\u202f .,]*\d\s?€/g);
 document.getElementById('project-overview-balance').textContent=(amount?amount[amount.length-1].trim():value)||'—';
}
var updating=false;
function updateSoon(){if(updating)return;updating=true;setTimeout(function(){updating=false;updateOverview();},100);}
['workspace-next-value','iv-payment-truth'].forEach(function(id){
 var el=document.getElementById(id);
 if(el)new MutationObserver(updateSoon).observe(el,{childList:true,subtree:true,characterData:true});
});
function translate(){
 nav.setAttribute('aria-label',tr('Rubriques du projet','Project sections'));
 buttons.forEach(translateNode);
 main.querySelectorAll('.project-overview-focus [data-fr][data-en],.project-panel-heading [data-fr][data-en],.project-focus-panel .project-more-tools>summary[data-fr],.project-focus-panel .workspace-fold>summary[data-fr]').forEach(translateNode);
 updateOverview();
}
document.addEventListener('dzoft:locale-change',translate);
// Deep links open the correct tab before navigating to the target control.
 // Explicitly allow only known project sections: never interpret a URL hash
 // as an arbitrary DOM ID or HTML selector.
var deepLinks={
 'work/c-docs':{pane:'work',target:'c-docs'},
 'work/c-files':{pane:'work',target:'c-files'},
 'work/c-journal':{pane:'work',target:'c-journal'},
 'work/c-changes':{pane:'work',target:'c-changes'},
 'billing/c-inv':{pane:'billing',target:'c-inv'},
 'billing/pay':{pane:'billing',target:'c-inv'},
 'work/publish':{pane:'work',target:'c-steps'},
 'messages/c-msg':{pane:'messages',target:'c-msg'}
};
function applyLocationHash(){
 var value=location.hash.replace(/^#/,'');
 var deep=deepLinks[value];
 if(deep){select(deep.pane,{replaceHash:false,scroll:true,target:deep.target});return;}
 if(panes[value])select(value,{replaceHash:false});
}
window.addEventListener('hashchange',applyLocationHash);
translate();
var initial=location.hash.replace(/^#/,'');
if(deepLinks[initial])applyLocationHash();
else select(panes[initial]?initial:'overview',{replaceHash:false});
updateSoon();
})();
