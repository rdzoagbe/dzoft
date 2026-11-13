/* DZOFT private GitHub activity viewer. Sends ONLY fixed date/category pairs
 * to the owner-guarded private task intake. No commit message, author, AI
 * attribution, code, diff, SHA or session is sent to Supabase/client portal.
 * Rodney's repo is public and a reviewed, fixed allowlist; no GitHub key used. */
(function(){
'use strict';
var quoteId=new URLSearchParams(location.search).get('q');
var RODNEY_QUOTE='c8a50cee-3856-4539-98a3-f5df201dbff0';
if(quoteId!==RODNEY_QUOTE)return;
var root=document.getElementById('jr-github-slot');
if(!root)return;
var url='https://api.github.com/repos/ProjectRodney/ProRod/commits?sha=main&per_page=100';
var ttl=15*60*1000,last=0,loading=false;
var categories=[
 ['administration',/admin|dashboard|tableau de bord|back.?office|moderation|modération|management|portal/i,'Administration'],
 ['qr',/\bqr\b|qr code|scanner/i,'QR codes et accès aux lieux'],
 ['evenements',/venue|lieu|event|événement|établissement/i,'Lieux et événements'],
 ['profils',/profil|profile|inscription|registration|onboard|signup|sign.up/i,'Profils et inscription'],
 ['securite',/secur|sécur|auth|login|password|mot de passe|permission|access|accès|privacy|confidential|consent|rls|pass|token/i,'Sécurité et accès'],
 ['messagerie',/email|e-mail|notification|sms|brevo|message|chat|push/i,'Messages et notifications'],
 ['interface',/design|layout|ui\b|screen|écran|mobile|responsive|style|css|typograph|couleur|color|translation|traduction|wording|texte|photo|image|icon|icône/i,'Interface et affichage'],
 ['donnees',/database|supabase|sql\b|migration|data|données|db\b/i,'Données et configuration'],
 ['tests',/test|regression|régression|fix|bug|correctif|correction|lint|stabil|quality|qualité/i,'Tests et correctifs'],
 ['livraison',/deploy|release|production|deploy|mise en ligne|publish|build/i,'Mises en ligne'],
 ['fonctionnalites',/feature|form|profil|profile|qr|event|événement|venue|lieu|account|compte|registration|inscription|refus|report/i,'Fonctionnalités'],
];
function classify(subject){
 // The raw subject never appears in the page, journal, client portal or API.
 for(var i=0;i<categories.length;i++){if(categories[i][1].test(subject))return categories[i][0];}
 return 'other';
}
function summarize(data){
 var days={};
 for(var i=0;i<data.length;i++){
  var c=data[i];
  if(!c||!/^[0-9a-f]{40}$/i.test(c.sha||''))continue;
  var timestamp=c.commit&&c.commit.committer&&c.commit.committer.date;
  if(!/^\d{4}-\d\d-\d\dT/.test(timestamp||''))continue;
  var day=timestamp.slice(0,10);
  // Only first line of the subject is inspected locally for category labels.
  // Body metadata including AI coauthors / session URLs is never consumed.
  var msg=String(c.commit&&c.commit.message||'').split(/\r?\n/,1)[0].slice(0,240);
  var category=classify(msg);
  if(!days[day])days[day]={date:day,total:0,groups:{}};
  days[day].total++;
  days[day].groups[category]=(days[day].groups[category]||0)+1;
 }
 return Object.keys(days).sort().reverse().slice(0,20).map(function(d){return days[d];});
}
function draw(rows){
 root.replaceChildren();
 var box=document.createElement('section');box.className='jr-github';
 var head=document.createElement('div');head.className='jr-github-head';
 var title=document.createElement('div');
 var eyebrow=document.createElement('span');eyebrow.className='jr-source';eyebrow.textContent='GITHUB · ProRod · main';
 var h=document.createElement('h3');h.textContent='Activité de développement';
 var subtitle=document.createElement('p');subtitle.className='muted';
 subtitle.textContent='Les activités récentes alimentent automatiquement les tâches privées « À vérifier ». Aucun message de commit, code, attribution IA ni session ne sont enregistrés.';
 title.append(eyebrow,h,subtitle);
 var refresh=document.createElement('button');refresh.type='button';refresh.className='btn sm line';refresh.textContent='Actualiser';
 refresh.onclick=function(){load(true);};head.append(title,refresh);box.append(head);
 var body=document.createElement('div');body.className='jr-github-days';
 if(!rows.length){
  var empty=document.createElement('p');empty.className='muted';empty.textContent='Aucune activité GitHub disponible.';body.append(empty);
 }
 for(var i=0;i<rows.length;i++){
  var row=rows[i],section=document.createElement('div');section.className='jr-github-day';
  var label=document.createElement('div');label.className='jr-github-date';
  var day=document.createElement('strong');day.textContent=new Date(row.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  var count=document.createElement('span');count.textContent=row.total+' modification'+(row.total>1?'s':'');
  label.append(day,count);section.append(label);
  var groups=document.createElement('div');groups.className='jr-github-categories';
  Object.keys(row.groups).sort().forEach(function(category){
   var pill=document.createElement('span');pill.className='jr-github-pill';
   var matched=categories.filter(function(c){return c[0]===category;})[0];
   pill.textContent=(matched?matched[2]:'Développement et maintenance')+(row.groups[category]>1?' · '+row.groups[category]:'');
   groups.append(pill);

  });section.append(groups);body.append(section);
 }
 box.append(body);
 var foot=document.createElement('p');foot.className='muted jr-github-foot';foot.textContent='Lecture automatique à l’ouverture et périodiquement lorsque DZOFT reste ouvert. Import privé des 14 derniers jours, regroupé par date et catégorie. Les notes manuelles et l’espace client restent inchangés.';
 box.append(foot);
 var sync=document.createElement('p');sync.className='muted jr-github-sync';sync.setAttribute('role','status');
 sync.textContent='Synchronisation des catégories privées en cours…';
 box.append(sync);root.append(box);
 return sync;
}
function status(text){
 root.replaceChildren();
 var p=document.createElement('p');p.className='muted jr-github-status';p.setAttribute('role','status');p.textContent=text;root.append(p);
}
function load(force){
 if(loading||(!force&&last&&Date.now()-last<ttl))return;
 if(document.visibilityState==='hidden')return;
 loading=true;status('Lecture sécurisée des activités GitHub…');
 fetch(url,{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{'Accept':'application/vnd.github+json'}})
 .then(function(resp){
  if(!resp.ok)throw new Error('GitHub HTTP '+resp.status);
  return resp.json();
 }).then(function(payload){
  if(!Array.isArray(payload))throw new Error('Unexpected GitHub data');
  last=Date.now();
  var summary=summarize(payload),notice=draw(summary);
  if(!window.DzoftWorkItems||typeof window.DzoftWorkItems.syncFromGithub!=='function'){
   notice.textContent='Synchronisation automatique indisponible. Rechargez votre espace privé.';
   return;
  }
  return window.DzoftWorkItems.syncFromGithub(summary).then(function(result){
   var added=Number(result&&result.added)||0,checked=Number(result&&result.checked)||0;
   notice.textContent=added?
    added+' activité'+(added>1?'s':'')+' ajoutée'+(added>1?'s':'')+' automatiquement dans les tâches « À vérifier ». Rien envoyé au client.':
    'Suivi privé à jour · '+checked+' catégorie'+(checked>1?'s':'')+' vérifiée'+(checked>1?'s':'')+'. Rien envoyé au client.';
  }).catch(function(){
   notice.textContent='Activité GitHub affichée, mais enregistrement automatique indisponible. Réessayez avec « Actualiser ».';
  });
 }).catch(function(){
  status('Activité GitHub temporairement indisponible. Vos notes manuelles restent enregistrées.');
  var retry=document.createElement('button');retry.type='button';retry.className='btn sm line';retry.textContent='Réessayer';retry.onclick=function(){load(true);};root.append(retry);
 }).finally(function(){loading=false;});
}
function init(){
 var parent=root.closest('details');
 if(parent){
  parent.addEventListener('toggle',function(){if(parent.open)load();});
  if(parent.open)load();
 }else load();
 window.setInterval(function(){
  if(document.visibilityState==='visible'&&(!parent||parent.open))load();
 },5*60*1000);
 document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&(!parent||parent.open))load();
 });
}
init();
})();
