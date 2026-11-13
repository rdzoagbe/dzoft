/* DZOFT private project tasks: owner-only Supabase RPCs, never expose source
 * commit text, AI co-authors, code, URLs, or GitHub credentials to clients.
 * A client update is published ONLY by an explicit owner action. */
(function(){
'use strict';
var quoteId=new URLSearchParams(location.search).get('q');
var root=document.getElementById('jr-tasks-slot'),sb=window.RDsb;
if(!quoteId||!root||!sb||!sb.session())return;
var items=[],busy=false,loaded=false,refreshQueued=false,autoPromise=null,tasksExpanded=false;
var statusNames={todo:['À faire','To do'],working:['En cours','In progress'],review:['À vérifier','To verify'],done:['Terminé','Completed']};
var categories={design:['Interface','Interface'],accounts:['Comptes et profils','Accounts and profiles'],venue:['Lieux et événements','Venues and events'],chat:['Messages','Messaging'],safety:['Sécurité','Security'],other:['Autre','Other']};
var safeGithub={
 administration:['Administration','other'],
 qr:['QR codes et accès aux lieux','venue'],
 evenements:['Lieux et événements','venue'],
 profils:['Profils et inscription','accounts'],
 securite:['Sécurité et accès','safety'],
 messagerie:['Messages et notifications','chat'],
 interface:['Interface et affichage','design'],
 donnees:['Données et configuration','other'],
 tests:['Tests et correctifs','other'],
 livraison:['Mises en ligne','other'],
 fonctionnalites:['Fonctionnalités','other'],
 other:['Développement et maintenance','other']
};
function english(){return document.documentElement.lang==='en';}
function t(fr,en){return english()?en:fr;}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;}
function button(text,cls){var e=el('button',cls||'btn sm line',text);e.type='button';return e;}
function message(s,isError){var area=root.querySelector('[data-task-message]');if(area){area.textContent=s;area.className='jr-task-message'+(isError?' error':'');}}
function selection(values,value){
 var sel=el('select');Object.keys(values).forEach(function(k){
  var o=el('option','',english()?values[k][1]:values[k][0]);o.value=k;sel.append(o);
 });sel.value=value;return sel;
}
function rpc(name,details){return sb.rpc(name,details,true);}
function load(){
 if(busy){refreshQueued=true;return;}busy=true;root.replaceChildren(el('p','muted',t('Lecture des tâches privées…','Loading private tasks…')));
 rpc('list_project_work_items',{p_quote:quoteId}).then(function(data){
  items=Array.isArray(data)?data:[];loaded=true;render();
 }).catch(function(){
  root.replaceChildren();
  root.append(el('p','jr-task-message error',t('Tâches indisponibles. Votre journal est conservé.','Tasks unavailable. Your journal is preserved.')));
  var retry=button(t('Réessayer','Retry'));retry.onclick=load;root.append(retry);
 }).finally(function(){
  busy=false;
  if(refreshQueued){refreshQueued=false;load();}
 });
}
function save(item,done){
 return rpc('save_project_work_item',{
  p_quote:quoteId,p_id:item.id||null,p_title:item.title,
  p_status:item.status,p_category:item.category||'other',
  p_source_date:item.source_date||null,p_source_group:item.source_group||null
 }).then(function(result){if(done)done(result);return result;});
}
function render(){
 root.replaceChildren();
 var outer=el('section','jr-work-items');
 var header=el('div','jr-work-header');
 var titles=el('div');
 titles.append(el('h3','',t('Tâches et validations','Tasks and approvals')));
 titles.append(el('p','muted',t('GitHub alimente ce suivi automatiquement à l’ouverture. Chaque activité reste à vérifier, jamais terminée d’office.','GitHub fills this review list when you open it. Activities always require verification and are never marked completed automatically.')));
 header.append(titles,el('span','jr-work-count',items.filter(function(x){return x.status!=='done';}).length+' '+t('à suivre','open')));
 outer.append(header);
 var form=el('form','jr-task-new');
 var label=el('label','',t('Nouvelle tâche','New task'));
 var input=el('input');input.type='text';input.maxLength=160;input.minLength=3;input.required=true;input.placeholder=t('Ex. : Tester le QR code sur deux téléphones','E.g. Test venue QR codes on two phones');
 label.append(input);
 var add=el('button','btn sm main',t('＋ Ajouter','＋ Add'));add.type='submit';
 form.append(label,add);
 var alert=el('p','jr-task-message');alert.setAttribute('data-task-message','');alert.setAttribute('role','status');alert.setAttribute('aria-live','polite');
 outer.append(form,alert);
 form.onsubmit=function(ev){
  ev.preventDefault();
  var title=input.value.trim();if(title.length<3)return;
  add.disabled=true;
  save({title:title,status:'todo',category:'other'},function(){
    input.value='';load();
  }).catch(function(){message(t('Tâche non enregistrée. Réessayez.','Task not saved. Try again.'),true);})
    .finally(function(){add.disabled=false;});
 };
 var summary=el('div','jr-task-progress');
 summary.append(el('span','',items.filter(function(x){return x.status==='done';}).length+' '+t('terminée(s)','completed')));
 summary.append(el('span','',items.filter(function(x){return x.status==='review';}).length+' '+t('à vérifier','to verify')));
 outer.append(summary);
 if(!items.length)outer.append(el('p','muted jr-tasks-empty',t(
  quoteId==='c8a50cee-3856-4539-98a3-f5df201dbff0'?'Les activités GitHub récentes seront ajoutées ici automatiquement.':'Aucune tâche pour le moment.',
  quoteId==='c8a50cee-3856-4539-98a3-f5df201dbff0'?'Recent GitHub activity will appear here automatically.':'No tasks yet.'
 )));
 var list=el('div','jr-task-list');
 var order={review:0,working:1,todo:2,done:3};
 var ordered=items.slice().sort(function(a,b){
  var pri=(order[a.status]===undefined?9:order[a.status])-(order[b.status]===undefined?9:order[b.status]);
  if(pri)return pri;
  return String(b.source_date||b.created_at||'').localeCompare(String(a.source_date||a.created_at||''));
 });
 (tasksExpanded?ordered:ordered.slice(0,8)).forEach(function(item){
  var card=el('article','jr-task-card'+(item.published_at?' jr-task-published':''));
  var top=el('div','jr-task-top');
  var text=el('div','jr-task-title');
  text.append(el('strong','',item.title));
  var origin=item.source_group&&safeGithub[item.source_group];
  text.append(el('small','',origin?t('Suivi GitHub · ','GitHub review · ')+String(item.source_date||''):t('Ajoutée manuellement','Added manually')));
  top.append(text);
  if(item.published_at)top.append(el('span','jr-work-badge',t('Publié au client','Shared with client')));
  else{
   var status=selection(statusNames,item.status);status.setAttribute('aria-label',t('État de la tâche','Task status'));
   status.onchange=function(){
    status.disabled=true;
    save({id:item.id,title:item.title,status:status.value,category:item.category},function(){load();})
      .catch(function(){status.value=item.status;message(t('Statut non enregistré.','Status not saved.'),true);})
      .finally(function(){status.disabled=false;});
   };
   top.append(status);
  }
  card.append(top);
  if(item.published_at){
   card.append(el('p','jr-work-help',t('Résumé publié avec notification en file d’envoi lors de l’approbation.','Summary was published and a notification was queued on approval.')));
  }else{
   var actions=el('div','jr-task-actions');
   var edit=el('details','jr-task-edit');
   edit.append(el('summary','',t('Modifier','Edit')));
   var editForm=el('form');
   var editInput=el('input');editInput.type='text';editInput.maxLength=160;editInput.required=true;editInput.minLength=3;editInput.value=item.title;
   var cat=selection(categories,item.category);
   var editSave=el('button','btn sm line',t('Enregistrer','Save'));editSave.type='submit';
   editForm.append(editInput,cat,editSave);edit.append(editForm);
   editForm.onsubmit=function(ev){ev.preventDefault();editSave.disabled=true;
    save({id:item.id,title:editInput.value.trim(),status:item.status,category:cat.value},function(){load();})
      .catch(function(){message(t('Modification non enregistrée.','Edit not saved.'),true);})
      .finally(function(){editSave.disabled=false;});
   };
   actions.append(edit);
   if(item.status==='done'){
    var publish=el('details','jr-task-publish');
    publish.append(el('summary','',t('Relire et publier au client','Review and share with client')));
    var pubForm=el('form');
    var intro=el('p','jr-work-help',t('Vous choisissez le texte. Aucun commit, contenu IA ou note privée n’est copié. La publication enverra une notification au client.','You write the text. No commit, AI metadata, or private notes are copied. Publishing queues a client notification.'));
    var pubLabel=el('label','',t('Résumé destiné au client','Client-facing summary'));
    var pubText=el('textarea');pubText.maxLength=220;pubText.minLength=5;pubText.required=true;pubText.rows=3;pubText.placeholder=t('Décrivez ce qui est réellement terminé et vérifié…','Describe what was actually completed and verified…');pubLabel.append(pubText);
    var pubCategory=selection(categories,item.category);
    var tested=el('label','jr-work-tested');var check=el('input');check.type='checkbox';
    tested.append(check,document.createTextNode(t(' J’ai testé personnellement cette modification',' I personally tested this change')));
    var pubBtn=el('button','btn sm main',t('Approuver et notifier','Approve and notify'));pubBtn.type='submit';
    pubForm.append(intro,pubLabel,pubCategory,tested,pubBtn);publish.append(pubForm);
    var batchId=null;
    pubForm.onsubmit=function(ev){
      ev.preventDefault();if(!pubForm.reportValidity())return;
      var summary=pubText.value.trim();
      if(!summary||!confirm(t('Publier au client : « '+summary+' » ? Un e-mail sera mis en file d’envoi.','Publish to client: “'+summary+'”? An email will be queued.')))return;
      if(!batchId)batchId=crypto.randomUUID();
      pubBtn.disabled=true;
      rpc('publish_project_work_item',{p_quote:quoteId,p_id:item.id,p_batch:batchId,
       p_category:pubCategory.value,p_summary:summary,p_tested:check.checked
      }).then(function(result){
       var state=result&&result.client_email_status;
       var msg=state==='queued'?t('Publication enregistrée. E-mail en attente d’envoi.','Published. Email queued for sending.'):
          state==='sent'?t('Publié. E-mail accepté par le fournisseur.','Published. Email accepted by provider.'):
          state==='failed'?t('Publié, mais l’e-mail a échoué : vérifiez l’historique.','Published, but email failed: check email history.'):
          t('Publié. Notification client non confirmée : vérifiez l’historique.','Published. Client notification unconfirmed: check email history.');
       message(msg,state==='failed');
       if(state==='queued')sb.fn('process-notification-outbox',{}).catch(function(){});
       setTimeout(load,900);
      }).catch(function(){message(t('Publication non confirmée. Vous pouvez réessayer sans dupliquer la notification.','Publication not confirmed. Retry will not duplicate the notification.'),true);})
       .finally(function(){pubBtn.disabled=false;});
    };
    actions.append(publish);
   }
   card.append(actions);
  }
  list.append(card);
 });
 outer.append(list);
 if(ordered.length>8){
  var more=button(tasksExpanded?t('Voir les 8 priorités','Show top 8'):t('Voir toutes les tâches ('+ordered.length+')','Show all tasks ('+ordered.length+')'),'btn sm line jr-tasks-more');
  more.onclick=function(){tasksExpanded=!tasksExpanded;render();};
  outer.append(more);
 }
 var foot=el('p','jr-work-help',t('Les tâches restent privées. Seul « Approuver et notifier » rend votre propre résumé visible au client.','Tasks remain private. Only “Approve and notify” shares your own summary with the client.'));
 outer.append(foot);
 root.append(outer);
}
// Auto-import is triggered exclusively by the already-sanitized, read-only
// GitHub activity viewer. Only date and allowlisted category cross to Supabase.
// Keep an overlap for missed visits; DB unique(quote,date,group) prevents repeats.
function sanitizedActivity(rows){
 if(!Array.isArray(rows))return [];
 var windowStart=new Date(Date.now()-13*24*60*60*1000).toISOString().slice(0,10);
 var windowEnd=new Date(Date.now()+24*60*60*1000).toISOString().slice(0,10);
 var seen=Object.create(null),out=[];
 rows.forEach(function(row){
  if(!row||typeof row.date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(row.date)
     ||row.date<windowStart||row.date>windowEnd||!row.groups||typeof row.groups!=='object')return;
  Object.keys(row.groups).sort().forEach(function(group){
   if(out.length>=40||!Object.prototype.hasOwnProperty.call(safeGithub,group)
      ||!(Number(row.groups[group])>0))return;
   var key=row.date+'|'+group;
   if(seen[key])return;
   seen[key]=true;
   // Do not transmit group counts, commit subjects, authors, URLs, SHAs, or code.
   out.push({date:row.date,group:group});
  });
 });
 return out;
}
function syncFromGithub(rows){
 if(quoteId!=='c8a50cee-3856-4539-98a3-f5df201dbff0')
  return Promise.reject(new Error('Unapproved project'));
 var safe=sanitizedActivity(rows);
 if(!safe.length)return Promise.resolve({added:0,checked:0,client_notified:false});
 if(autoPromise)return autoPromise;
 autoPromise=rpc('sync_project_github_groups',{p_quote:quoteId,p_items:safe})
 .then(function(result){
  if(result && Number(result.added)>0)load();
  return result;
 }).finally(function(){autoPromise=null;});
 return autoPromise;
}
window.DzoftWorkItems={syncFromGithub:syncFromGithub,refresh:load};
var fold=root.closest('details');
if(fold){
 fold.addEventListener('toggle',function(){if(fold.open&&(!loaded||!busy))load();});
 if(fold.open)load();
}else load();
document.addEventListener('dzoft:locale-change',function(){if(loaded)render();});
})();
