(function(){
'use strict';
var main=document.getElementById('main');if(!main||!document.getElementById('c-steps'))return;
var en=function(){return document.documentElement.lang==='en';};
var tr=function(fr,english){return en()?english:fr;};
var shell=document.createElement('div');shell.className='workspace-shell';main.parentNode.insertBefore(shell,main);shell.appendChild(main);
var intro=document.createElement('section');intro.className='workspace-intro';intro.innerHTML='<div class="workspace-overline">DZOFT · PROJECT WORKSPACE</div><div class="workspace-intro-row"><div><h1 id="workspace-title">Project workspace</h1><p id="workspace-subtitle"></p></div><span class="workspace-badge" id="workspace-badge"></span></div><div class="workspace-actions"><button type="button" class="btn main" data-workspace-action="payment"></button><button type="button" class="btn line" data-workspace-action="progress"></button><button type="button" class="btn line" data-workspace-action="message"></button></div><div class="workspace-glance"><div><span id="workspace-progress-label"></span><b id="workspace-progress-value">—</b><div class="workspace-meter"><span id="workspace-progress-bar"></span></div></div><div><span id="workspace-next-label"></span><b id="workspace-next-value">—</b></div><div><span id="workspace-access-label"></span><b id="workspace-access-value">—</b></div></div>';main.prepend(intro);
var layout=document.createElement('div');layout.className='workspace-columns';main.appendChild(layout);
var primary=document.createElement('div');primary.className='workspace-primary';var aside=document.createElement('aside');aside.className='workspace-aside';layout.appendChild(primary);layout.appendChild(aside);
var extras=document.createElement('details');extras.className='workspace-advanced';extras.innerHTML='<summary></summary><div class="workspace-advanced-grid"></div>';main.appendChild(extras);
var advance=extras.querySelector('div');
function fold(id,fr,eng,container,opened){var node=document.getElementById(id);if(!node)return;var det=document.createElement('details');det.className='workspace-fold';det.open=!!opened;var summary=document.createElement('summary');summary.dataset.fr=fr;summary.dataset.en=eng;det.appendChild(summary);det.appendChild(node);container.appendChild(det);return det;}
function move(id,to){var node=document.getElementById(id);if(node)to.appendChild(node);return node;}
move('c-steps',primary);
move('c-inv',aside);
move('c-msg',aside);
fold('c-note','Message visible par le client','Client-facing note',aside,false);
fold('c-docs','Documents partagés','Shared documents',primary,false);
fold('c-files','Fichiers du client','Client files',primary,false);
fold('c-journal','Journal privé du projet','Private project journal',primary,false);
fold('c-care','Suivi mensuel','Monthly maintenance',aside,false);
['c-share','c-acc','c-env','c-activity','c-rv'].forEach(function(id){move(id,advance);});
var steps=document.getElementById('c-steps');
if(steps){
 var edits=document.createElement('details');edits.className='workspace-fold workspace-step-edit';var sum=document.createElement('summary');sum.dataset.fr='Gérer toutes les étapes et validations';sum.dataset.en='Manage milestones and approvals';edits.appendChild(sum);
 ['steps'].forEach(function(id){var el=document.getElementById(id);if(el)edits.appendChild(el);});steps.appendChild(edits);
 // The deposit milestone must keep its original event handlers after being moved.
 var paymentSteps=document.getElementById('payment-steps');
 window.DzoftPlacePaymentSteps=function(){
   if(!paymentSteps)return;paymentSteps.replaceChildren();
   document.querySelectorAll('#steps [data-step-key="deposit"]').forEach(function(row){paymentSteps.appendChild(row);});
 };
 if(paymentSteps){
   ['input','change','click'].forEach(function(type){paymentSteps.addEventListener(type,function(ev){var original=document.getElementById('steps');var fn=original&&original['on'+type];if(fn)fn.call(original,ev);});});
   window.DzoftPlacePaymentSteps();
 }
}
var invoice=document.getElementById('c-inv');
if(invoice){
 var legacy=document.createElement('details');legacy.className='workspace-fold workspace-legacy';var sum=document.createElement('summary');sum.dataset.fr='Factures officielles et détails';sum.dataset.en='Official invoices and details';legacy.appendChild(sum);
 Array.from(invoice.children).filter(function(node){return node.id!=='tracking-admin';}).forEach(function(node){legacy.appendChild(node);});invoice.appendChild(legacy);
}
function openParents(node){for(var x=node;x&&x!==main;x=x.parentElement){if(x.tagName==='DETAILS')x.open=true;}}
function jump(target){
 var id=target==='payment'?'tracking-admin':target==='progress'?'tracking-publish':'c-msg';
 var element=document.getElementById(id)||(target==='payment'?document.getElementById('c-inv'):document.getElementById('c-steps'));
 if(!element)return;
 openParents(element);
 if(target==='payment'){var edit=element.querySelector('details.tracking-editor');if(edit)edit.open=true;}
 if(target==='progress'){var publish=element.querySelector('details.tracking-editor');if(publish)publish.open=true;}
 element.scrollIntoView({behavior:'smooth',block:'start'});
 if(target==='message'){var field=document.getElementById('reply');if(field)setTimeout(function(){field.focus({preventScroll:true});},350);}
}
intro.querySelectorAll('[data-workspace-action]').forEach(function(b){b.addEventListener('click',function(){jump(b.dataset.workspaceAction);});});
function refresh(){
 var full=(document.getElementById('ttl')||{}).textContent||'';
 var title=document.getElementById('workspace-title'),sub=document.getElementById('workspace-subtitle');
 title.textContent=full.replace(/^Fiche projet\s*·\s*/,'').replace(/^Project record\s*·\s*/,'')||tr('Projet','Project');
 sub.textContent=tr('Toutes vos actions importantes, sans changer de page.','All essential actions, on one page.');
 var active=document.querySelectorAll('#steps .st,#payment-steps .st');
 var completed=Array.from(active).filter(function(row){var ck=row.querySelector('input.ck');return ck&&ck.checked;}).length;
 var total=active.length;
 var percent=total?Math.round(completed*100/total):0;
 document.getElementById('workspace-progress-value').textContent=total?completed+' / '+total+' · '+percent+'%':'—';
 document.getElementById('workspace-progress-bar').style.width=percent+'%';
 var next=Array.from(active).find(function(row){var ck=row.querySelector('input.ck');return ck&&!ck.checked;});
 var nextTitle=next&&next.querySelector('input.t');
 document.getElementById('workspace-next-value').textContent=nextTitle?(nextTitle.value||'—'):(total?tr('Toutes les étapes terminées','All steps completed'):'—');
 var access=(document.getElementById('sh-pill')||{}).textContent||'—';
 document.getElementById('workspace-access-value').textContent=access;
 document.getElementById('workspace-badge').textContent=total&&completed===total?tr('Terminé','Completed'):tr('En cours','In progress');
}
function translate(){
 intro.querySelector('.workspace-overline').textContent=tr('DZOFT · ESPACE PROJET','DZOFT · PROJECT WORKSPACE');
 document.getElementById('workspace-progress-label').textContent=tr('Avancement','Progress');
 document.getElementById('workspace-next-label').textContent=tr('Prochaine étape','Next step');
 document.getElementById('workspace-access-label').textContent=tr('Espace client','Client access');
 intro.querySelector('[data-workspace-action=payment]').textContent=tr('＋ Gérer les paiements','＋ Manage payments');
 intro.querySelector('[data-workspace-action=progress]').textContent=tr('↗ Publier une avancée','↗ Publish progress');
 intro.querySelector('[data-workspace-action=message]').textContent=tr('✉ Écrire au client','✉ Message client');
 extras.querySelector('summary').textContent=tr('Accès, accord, environnement et historique','Access, agreement, environment & history');
 main.querySelectorAll('summary[data-fr]').forEach(function(s){s.textContent=s.dataset[en()?'en':'fr'];});
 refresh();
}
var scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;setTimeout(function(){scheduled=false;refresh();},120);}
['steps','payment-steps','sh-pill','ttl','tracking-admin'].forEach(function(id){var el=document.getElementById(id);if(el)new MutationObserver(schedule).observe(el,{childList:true,subtree:true,characterData:true,attributes:false});});
main.addEventListener('change',schedule);
document.addEventListener('dzoft:locale-change',translate);
translate();
})();