/* DZOFT — one-search case finder, source is already-rendered, owner-only DOM.
   No additional requests, persistence, server writes or unsafe HTML injection. */
(function(){
'use strict';
var app=document.getElementById('app');
var cases=document.getElementById('v-dossiers');
var field=document.getElementById('dossier-search');
if(!app||!cases||!field)return;
var tr=function(fr,en){return document.documentElement.lang==='en'?en:fr;};
var GROUPS=[
 {key:'leads',slug:'demandes',label:['Demande','Request'],selector:'#leads .lead',
  title:function(el){return (el.querySelector('.h b')||{}).textContent||'';},
  desc:function(el){return (el.querySelector('.meta .chip')||{}).textContent||'';}},
 // Since the 16 Nov redesign, clients, quotes and projects are cards (.v4-list-card); the former
 // table rows are still recognised so an older layout keeps working.
 {key:'clients',slug:'clients',label:['Client','Client'],selector:'#clients tbody tr, #clients .v4-list-card',
  title:function(el){return (el.querySelector('td:first-child b, h3')||{}).textContent||'';},
  desc:function(el){return (el.querySelector('td:nth-child(2), .v4-card-sub')||{}).textContent||'';}},
 {key:'quotes',slug:'devis',label:['Devis','Quote'],selector:'#quotes tbody tr, #quotes .v4-list-card',
  title:function(el){return (el.querySelector('td:first-child b, h3')||{}).textContent||'';},
  desc:function(el){return (el.querySelector('td:nth-child(2), .v4-card-kicker')||{}).textContent||'';}},
 {key:'projects',slug:'projets',label:['Projet','Project'],selector:'#projects tbody tr, #projects .v4-list-card',
  title:function(el){return (el.querySelector('td:first-child b, h3')||{}).textContent||'';},
  desc:function(el){return (el.querySelector('td:nth-child(2), .v4-card-kicker')||{}).textContent||'';}}
];
var panel=document.createElement('section');
panel.className='dzoft-case-finder';panel.id='dzoft-case-finder';
panel.hidden=true;panel.setAttribute('role','region');
panel.setAttribute('aria-label','Résultats de recherche');
var heading=document.createElement('div');heading.className='dzoft-case-finder-heading';
var label=document.createElement('strong');label.id='dzoft-case-finder-count';
var clear=document.createElement('button');clear.className='btn sm line';clear.type='button';clear.setAttribute('aria-label','Effacer la recherche');
heading.append(label,clear);
var results=document.createElement('div');results.className='dzoft-case-results';
results.setAttribute('role','list');
panel.append(heading,results);
var headingElement=cases.querySelector('.simplified-heading');
if(headingElement)headingElement.insertAdjacentElement('afterend',panel);
else cases.insertBefore(panel,cases.firstChild);
function visible(el){return !el.hidden && !!el.closest('#v-dossiers');}
function chooseRow(group,idx){
 var selected=document.querySelectorAll(GROUPS[group].selector)[idx];
 if(!selected)return;
 // Navigation is a hash change and does not load any customer data anew.
 location.hash='#/'+GROUPS[group].slug;
 window.setTimeout(function(){
   var target=document.querySelectorAll(GROUPS[group].selector)[idx];
   if(target){target.scrollIntoView({block:'center',behavior:'auto'});target.classList.add('dzoft-found-row');
     window.setTimeout(function(){target.classList.remove('dzoft-found-row');},1500);}
 },20);
}
function render(){
 var term=field.value.trim().toLocaleLowerCase(),isSearch=term.length>=2;
 panel.hidden=!isSearch;
 if(!isSearch){results.replaceChildren();return;}
 var found=[];
 GROUPS.forEach(function(group,groupIndex){
   document.querySelectorAll(group.selector).forEach(function(el,idx){
     if(!visible(el))return;
     // Search only the already-rendered content; never expose hidden/inaccessible rows.
     if(!el.textContent.toLocaleLowerCase().includes(term))return;
     found.push({group:group,groupIndex:groupIndex,index:idx,
       title:group.title(el).trim(),description:group.desc(el).trim()});
   });
 });
 label.textContent=tr(found.length+' résultat'+(found.length>1?'s':'')+' dans vos dossiers',
   found.length+' result'+(found.length===1?'':'s')+' across your cases');
 clear.textContent=tr('Effacer','Clear');
 results.replaceChildren();
 if(!found.length){
   var empty=document.createElement('p');empty.className='dzoft-case-empty';
   empty.textContent=tr('Aucun résultat. Essayez un nom, un numéro de devis ou un mot du projet.',
     'No matching case. Try a name, quote number or project keyword.');
   results.appendChild(empty);return;
 }
 found.slice(0,24).forEach(function(item){
   var b=document.createElement('button');b.type='button';b.className='dzoft-case-result';
   b.setAttribute('role','listitem');
   b.dataset.group=String(item.groupIndex);b.dataset.row=String(item.index);
   var kind=document.createElement('span');kind.className='dzoft-case-kind';
   kind.textContent=item.group.label[document.documentElement.lang==='en'?1:0];
   var content=document.createElement('span');content.className='dzoft-case-result-copy';
   var title=document.createElement('strong');title.textContent=item.title||tr('Sans nom','Unnamed');
   var description=document.createElement('small');description.textContent=item.description;
   content.append(title,description);
   var arrow=document.createElement('span');arrow.textContent='›';arrow.className='dzoft-case-arrow';arrow.setAttribute('aria-hidden','true');
   b.append(kind,content,arrow);results.appendChild(b);
 });
 if(found.length>24){
  var note=document.createElement('p');note.className='dzoft-case-empty';
  note.textContent=tr('24 premiers résultats affichés. Affinez la recherche pour en voir d’autres.',
   'Showing the first 24 matches. Refine the search for more.');
  results.appendChild(note);
 }
}
field.setAttribute('autocomplete','off');
field.setAttribute('aria-controls',panel.id);
field.setAttribute('aria-describedby','dzoft-case-search-tip');
var tip=document.createElement('p');tip.className='dzoft-case-search-tip';tip.id='dzoft-case-search-tip';
tip.textContent=tr('Tapez au moins 2 caractères pour chercher dans les demandes, clients, devis et projets.',
 'Type 2 or more characters to search requests, clients, quotes and projects.');
field.parentNode.appendChild(tip);
clear.addEventListener('click',function(){field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();});
results.addEventListener('click',function(e){
 var b=e.target.closest('button[data-group]');if(!b)return;
 chooseRow(Number(b.dataset.group),Number(b.dataset.row));
});
field.addEventListener('input',render);
field.addEventListener('keydown',function(e){
 if(e.key==='Escape' && field.value){e.preventDefault();clear.click();}
 if(e.key==='Enter' && !panel.hidden){
   var first=results.querySelector('button[data-group]');if(first){e.preventDefault();first.click();}
 }
});
window.addEventListener('dzoft:data-refreshed',function(){window.setTimeout(render,0);});
document.addEventListener('dzoft:locale-change',function(){
 tip.textContent=tr('Tapez au moins 2 caractères pour chercher dans les demandes, clients, devis et projets.',
 'Type 2 or more characters to search requests, clients, quotes and projects.');
 render();
});
render();
})();
