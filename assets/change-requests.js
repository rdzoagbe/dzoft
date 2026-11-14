(function(global){
'use strict';
var api={};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function cash(v){return Number(v||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});}
function when(v){return v?new Date(v).toLocaleString('fr-FR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';}
function tr(en,fr,english){return en?english:fr;}
function labels(en){return {requested:tr(en,'À étudier','Awaiting review'),proposed:tr(en,'Proposition à valider','Awaiting approval'),approved:tr(en,'Approuvée','Approved'),declined:tr(en,'Refusée par le client','Declined by client'),rejected:tr(en,'Non retenue','Not proceeding'),withdrawn:tr(en,'Retirée','Withdrawn'),in_progress:tr(en,'Travaux en cours','In progress'),completed:tr(en,'Travaux terminés','Work completed')};}
function history(r,en){var h=r.history||[];return '<details class="dzoft-change-history"><summary>'+tr(en,'Historique des décisions','Decision history')+' ('+h.length+')</summary><ol>'+h.map(function(e){return '<li>'+esc(labels(en)[e.event_type]||e.event_type)+' · '+esc(tr(en,e.actor_type==='owner'?'DZOFT':'Client',e.actor_type==='owner'?'DZOFT':'Client'))+' · '+esc(when(e.at))+'</li>';}).join('')+'</ol></details>';}
function stateError(err,en){return esc((err&&err.message)||tr(en,'Opération impossible. Réessayez.','Action failed. Please retry.'));}
function banner(root,message,error){var m=root.querySelector('.dzoft-change-message');if(!m)return;m.textContent=message;m.style.color=error?'#9b2020':'#14613e';m.setAttribute('role','status');}
function rootMarkup(en){return '<div class="dzoft-change-message" role="status" aria-live="polite"></div><div class="dzoft-change-content">'+tr(en,'Chargement des demandes…','Loading requests…')+'</div>';}
function openForm(en){return '<details class="dzoft-change-new"><summary>'+tr(en,'＋ Demander une modification','＋ Request a change')+'</summary><form class="dzoft-change-form" data-change-create>'+
 '<label>'+tr(en,'Objet de la demande','Request title')+'<input name="title" maxlength="120" minlength="3" required placeholder="'+tr(en,'Ex. : Ajouter une page','E.g. add a new page')+'"></label>'+
 '<label>'+tr(en,'Décrivez précisément ce que vous souhaitez ajouter ou modifier','Explain what you would like to add or change')+'<textarea name="description" minlength="10" maxlength="2000" rows="3" required></textarea></label>'+
 '<p>'+tr(en,'Vous ne payez rien en envoyant cette demande. DZOFT étudie le prix et le délai, puis vous soumet une proposition à approuver avant tout supplément.','Submitting a request does not incur any charge. DZOFT will assess the cost and timeline, then ask for your approval before any extra work.')+'</p>'+
 '<button class="btn main" type="submit">'+tr(en,'Envoyer la demande','Submit request')+'</button></form></details>';}
function clientCard(r,en,name){
 var status=labels(en)[r.status]||r.status;
 var h='<article class="dzoft-change-item"><header><b>'+esc(r.title)+'</b><span class="dzoft-change-status">'+esc(status)+'</span></header><p>'+esc(r.description)+'</p>'+
 '<p class="dzoft-change-meta">'+tr(en,'Demandée le ','Requested on ')+esc(when(r.created_at))+'</p>';
 if(r.proposed_scope){
  h+='<div class="dzoft-change-proposal"><b>'+tr(en,'Proposition DZOFT, version ','DZOFT proposal, version ')+esc(r.proposal_version)+'</b>'+
   '<p>'+esc(r.proposed_scope)+'</p>'+
   '<p><strong>'+tr(en,'Supplément proposé : ','Proposed extra charge: ')+cash(r.extra_price)+'</strong></p>'+
   '<p>'+tr(en,'Impact sur le délai : ','Timeline impact: ')+esc(r.timeline_impact||tr(en,'Aucun changement annoncé','No change specified'))+'</p></div>';
 }
 if(r.status==='proposed'){
  h+='<form data-change-decision="'+esc(r.id)+'" data-version="'+esc(r.proposal_version)+'" class="dzoft-change-form">'+
   '<label>'+tr(en,'Nom de la personne qui confirme la décision','Name of person confirming the decision')+
   '<input name="decisionName" maxlength="120" minlength="2" required value="'+esc(name||'')+'"></label>'+
   '<label class="dzoft-change-check"><input type="checkbox" name="consent" required><span>'+
   tr(en,'J’ai lu la description, le supplément et le délai éventuel. Je comprends que seule mon approbation explicite autorise ces travaux et leur facturation.','I have reviewed the scope, extra charge and any timeline impact. I understand that only my explicit approval authorizes this additional work and charge.')+
   '</span></label><div class="dzoft-change-actions"><button class="btn main" type="submit" data-decision="approve">'+tr(en,'Approuver cette proposition','Approve proposal')+
   '</button><button class="btn line" type="button" data-change-decline="'+esc(r.id)+'">'+tr(en,'Refuser cette proposition','Decline proposal')+'</button></div></form>';
 }
 if(r.status==='requested'||r.status==='proposed')h+='<button class="btn line sm" type="button" data-change-withdraw="'+esc(r.id)+'">'+tr(en,'Retirer ma demande','Withdraw request')+'</button>';
 if(['approved','in_progress','completed'].includes(r.status))h+='<p class="dzoft-change-confirm">'+tr(en,'Accord confirmé par ','Approved by ')+esc(r.decision_name||'')+' · '+esc(when(r.decided_at))+'. '+tr(en,'Le prix du devis d’origine reste inchangé ; cet accord autorise uniquement les prestations supplémentaires détaillées.','The original quote price remains unchanged; this approval covers only the additional work described.')+'</p>';
 return h+history(r,en)+'</article>';
}
function adminCard(r,en){
 var status=labels(en)[r.status]||r.status;
 var h='<article class="dzoft-change-item"><header><b>'+esc(r.title)+'</b><span class="dzoft-change-status">'+esc(status)+'</span></header><p>'+esc(r.description)+'</p>'+
 '<p class="dzoft-change-meta">'+tr(en,'Demande du ','Requested on ')+esc(when(r.created_at))+'</p>';
 if(r.proposed_scope)h+='<div class="dzoft-change-proposal"><b>'+tr(en,'Proposition v','Proposal v')+esc(r.proposal_version)+'</b><p>'+esc(r.proposed_scope)+'</p>'+
 '<p>'+tr(en,'Montant supplémentaire : ','Extra amount: ')+'<strong>'+cash(r.extra_price)+'</strong></p>'+
 '<p>'+tr(en,'Délai : ','Timeline: ')+esc(r.timeline_impact||'—')+'</p></div>';
 if(r.status==='requested'||r.status==='proposed'){
  h+='<details class="dzoft-change-new"><summary>'+tr(en,r.status==='proposed'?'Réviser la proposition':'Établir un devis complémentaire',r.status==='proposed'?'Revise proposal':'Prepare supplementary quote')+'</summary>'+
   '<form data-change-propose="'+esc(r.id)+'" class="dzoft-change-form"><label>'+tr(en,'Prestations supplémentaires proposées','Additional work / scope')+
   '<textarea name="scope" minlength="10" maxlength="2000" rows="3" required>'+esc(r.proposed_scope||'')+'</textarea></label>'+
   '<label>'+tr(en,'Supplément (€), même si égal à 0','Extra charge (€), including zero')+
   '<input name="amount" type="number" min="0" max="1000000" step="0.01" value="'+esc(r.extra_price==null?'':r.extra_price)+'" required></label>'+
   '<label>'+tr(en,'Conséquence sur le délai','Schedule impact')+'<input name="timeline" maxlength="600" value="'+esc(r.timeline_impact||'')+'" placeholder="'+tr(en,'Ex. : + 3 jours ; aucun changement','E.g. +3 days; no change')+'"></label>'+
   '<p>'+tr(en,'Le devis initial et les factures restent inchangés. Le client doit approuver cette proposition avant tout supplément. Une révision annule la proposition précédente.','The original quote and invoices remain unchanged. The client must approve the proposal before extra work starts. A revised proposal supersedes the previous version.')+'</p>'+
   '<button class="btn main" type="submit">'+tr(en,'Envoyer la proposition à l’espace client','Publish proposal to client workspace')+'</button></form></details>'+
   '<form data-change-reject="'+esc(r.id)+'" class="dzoft-change-form dzoft-change-reject"><label>'+tr(en,'Motif si demande non retenue','Reason if declined')+
   '<input name="reason" minlength="5" maxlength="600" placeholder="'+tr(en,'Ex. : non réalisable dans les conditions proposées','E.g. not feasible under the requested conditions')+'" required></label>'+
   '<button class="btn line sm" type="submit">'+tr(en,'Refuser la demande','Reject request')+'</button></form>';
 }
 if(['approved','in_progress','completed'].includes(r.status))h+='<p class="dzoft-change-confirm">'+tr(en,'Approuvé par ','Approved by ')+esc(r.decision_name||'')+' · '+esc(when(r.decided_at))+
 '. '+tr(en,'Vous pouvez planifier ce travail. Facturez-le séparément conformément à cet accord, sans modifier la facture initiale.','You can schedule the additional work. Invoice it separately under this agreement; do not change the original invoice.')+'</p>';
 if(r.status==='approved')h+='<button class="btn main sm" type="button" data-change-progress="'+esc(r.id)+'" data-next="in_progress">'+tr(en,'Démarrer les travaux complémentaires','Start approved additional work')+'</button>';
 if(r.status==='in_progress')h+='<button class="btn main sm" type="button" data-change-progress="'+esc(r.id)+'" data-next="completed">'+tr(en,'Marquer les travaux terminés','Mark additional work completed')+'</button>';
 if(r.status==='completed')h+='<p class="dzoft-change-meta">'+tr(en,'Travaux complémentaires terminés. La facturation complémentaire doit être faite séparément, sans modifier le devis et les paiements d’origine.','Additional work complete. Supplementary billing must be handled separately without altering the original quote or payment ledger.')+'</p>';
 return h+history(r,en)+'</article>';
}
function bindClient(root,options){
 var en=!!options.en,quoteId=options.quoteId,call=options.call,name=options.clientName||'',busy=false;
 root.innerHTML=rootMarkup(en);var records=[];
 function refresh(){return call('list_change_requests',{p_quote:quoteId}).then(function(rows){records=Array.isArray(rows)?rows:[];root.querySelector('.dzoft-change-content').innerHTML=
  '<p class="dzoft-change-help">'+tr(en,'Les changements après signature sont étudiés séparément. Aucun supplément sans votre accord.','Changes after signing are reviewed separately. No extra charge without your agreement.')+'</p>'+
  openForm(en)+(records.length?records.map(function(r){return clientCard(r,en,name);}).join(''):'<p>'+tr(en,'Aucune demande de modification pour ce projet.','No change requests for this project yet.')+'</p>');
 }).catch(function(err){banner(root,stateError(err,en),true);});}
 function perform(promise){if(busy)return;busy=true;return promise.then(function(){banner(root,tr(en,'Action enregistrée.','Action recorded.'),false);return refresh();}).catch(function(e){banner(root,stateError(e,en),true);}).finally(function(){busy=false;});}
 root.addEventListener('submit',function(ev){var form=ev.target;if(!form.matches('[data-change-create],[data-change-decision]'))return;ev.preventDefault();if(busy||!form.reportValidity())return;
  if(form.hasAttribute('data-change-create')){perform(call('create_change_request',{p_quote:quoteId,p_title:form.elements.title.value.trim(),p_description:form.elements.description.value.trim()}));return;}
  if(form.hasAttribute('data-change-decision')){var choice=ev.submitter&&ev.submitter.dataset.decision;if(choice!=='approve')return;perform(call('decide_change_request',{p_request:form.dataset.changeDecision,p_version:Number(form.dataset.version),p_approve:true,p_name:form.elements.decisionName.value.trim()}));}
 });
 root.addEventListener('click',function(ev){var btn=ev.target.closest('button');if(!btn||busy)return;
  if(btn.dataset.changeDecline){var f=btn.closest('form'),n=f.elements.decisionName.value.trim();if(!n||n.length<2){f.elements.decisionName.focus();return;}if(!global.confirm(tr(en,'Refuser cette proposition ?','Decline this proposal?')))return;
   perform(call('decide_change_request',{p_request:btn.dataset.changeDecline,p_version:Number(f.dataset.version),p_approve:false,p_name:n}));}
  if(btn.dataset.changeWithdraw){if(!global.confirm(tr(en,'Retirer la demande de modification ?','Withdraw this change request?')))return;perform(call('withdraw_change_request',{p_request:btn.dataset.changeWithdraw}));}
 });
 return refresh();
}
function bindOwner(root,options){
 var sb=options.sb,quoteId=options.quoteId,en=!!options.en,busy=false;
 if(root.__dzoftOwnerRefresh)return root.__dzoftOwnerRefresh();
 root.innerHTML=rootMarkup(en);var records=[];
 function refresh(){return sb.rpc('owner_list_change_requests',{p_quote:quoteId},true).then(function(data){records=Array.isArray(data)?data:[];root.querySelector('.dzoft-change-content').innerHTML=
 '<p class="dzoft-change-help">'+tr(en,'Une demande n’est pas une commande. Envoyez un montant et un délai proposés, puis attendez l’approbation explicite du client avant de commencer les travaux complémentaires.','A request is not an order. Propose a price and timeline, then await the client’s explicit approval before additional work begins.')+'</p>'+
 (records.length?records.map(function(r){return adminCard(r,en);}).join(''):'<p>'+tr(en,'Aucune demande pour ce projet.','No change requests for this project.')+'</p>');
 }).catch(function(err){banner(root,stateError(err,en),true);});}
 function perform(p){if(busy)return;busy=true;p.then(function(){banner(root,tr(en,'Décision enregistrée.','Decision recorded.'),false);return refresh();}).catch(function(err){banner(root,stateError(err,en),true);}).finally(function(){busy=false;});}
 root.addEventListener('click',function(ev){var button=ev.target.closest('[data-change-progress]');if(!button||busy)return;var next=button.dataset.next;if(next!=='in_progress'&&next!=='completed')return;if(!global.confirm(tr(en,'Enregistrer cette progression des travaux complémentaires ?','Record additional-work progress?')))return;perform(sb.rpc('owner_progress_change',{p_request:button.dataset.changeProgress,p_status:next},true));});
 root.addEventListener('submit',function(ev){var f=ev.target;if(!f.matches('[data-change-propose],[data-change-reject]'))return;ev.preventDefault();if(busy||!f.reportValidity())return;
  if(f.dataset.changePropose){perform(sb.rpc('owner_propose_change',{p_request:f.dataset.changePropose,p_scope:f.elements.scope.value.trim(),p_extra_price:Number(f.elements.amount.value),p_timeline:f.elements.timeline.value.trim()},true));return;}
  if(f.dataset.changeReject){if(!global.confirm(tr(en,'Refuser cette demande ?','Reject this request?')))return;perform(sb.rpc('owner_reject_change',{p_request:f.dataset.changeReject,p_reason:f.elements.reason.value.trim()},true));}
 });
 return refresh();
}
api.client=bindClient;api.owner=bindOwner;
global.DzoftChanges=api;
})(window);
