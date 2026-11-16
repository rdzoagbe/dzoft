(function(global){
'use strict';
/* DZOFT extra work after signature.
   Owner: prices the work line by line (from his price list or free lines), the server totals and numbers
   the proposal (D-…-C1), "Envoyer au client" e-mails it. Client: reads the lines and signs with a code
   received by e-mail, like the original quote, or declines. Approved work is then invoiced from its
   signed amount; the original quote, its invoices and payments never change. */
var api={};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function cash(v){return Number(v||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});}
function when(v){return v?new Date(v).toLocaleString('fr-FR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';}
function tr(en,fr,english){return en?english:fr;}
function num(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:NaN;}
function cents(v){return Math.round(num(v)*100);}
function labels(en){return {requested:tr(en,'À étudier','Awaiting review'),proposed:tr(en,'Proposition à signer','Awaiting signature'),approved:tr(en,'Signée','Signed'),declined:tr(en,'Refusée par le client','Declined by client'),rejected:tr(en,'Non retenue','Not proceeding'),withdrawn:tr(en,'Retirée','Withdrawn'),in_progress:tr(en,'Travaux en cours','In progress'),completed:tr(en,'Travaux terminés','Work completed')};}
function eventLabels(en){var l=labels(en);l.sent=tr(en,'Envoyée par e-mail','Sent by e-mail');l.approved=tr(en,'Signée','Signed');l.proposed=tr(en,'Proposition chiffrée','Priced proposal');l.requested=tr(en,'Demande','Request');return l;}
function history(r,en){var h=r.history||[],l=eventLabels(en);return '<details class="dzoft-change-history"><summary>'+tr(en,'Historique des décisions','Decision history')+' ('+h.length+')</summary><ol>'+h.map(function(e){return '<li>'+esc(l[e.event_type]||e.event_type)+' · '+esc(e.actor_type==='owner'?'DZOFT':'Client')+' · '+esc(when(e.at))+'</li>';}).join('')+'</ol></details>';}
function stateError(err,en){
 var m=(err&&err.message)||'';
 var map={'Incorrect code':tr(en,'Code incorrect.','Incorrect code.'),'Request your code first':tr(en,'Demandez d’abord votre code.','Request your code first.'),
  'Code expired: request a new one':tr(en,'Code expiré : demandez-en un nouveau.','Code expired: request a new one.'),
  'Too many attempts: request a new code':tr(en,'Trop d’essais : demandez un nouveau code.','Too many attempts: request a new code.'),
  'Approval requires the code sent by e-mail':tr(en,'La signature se fait avec le code reçu par e-mail.','Signing requires the code sent by e-mail.'),
  'Each line needs a label, a quantity and a price':tr(en,'Chaque ligne doit avoir un libellé, une quantité et un prix.','Each line needs a label, a quantity and a price.')};
 return esc(map[m]||m||tr(en,'Opération impossible. Réessayez.','Action failed. Please retry.'));
}
function banner(root,message,error){var m=root.querySelector('.dzoft-change-message');if(!m)return;m.textContent=message;m.style.color=error?'#9b2020':'#14613e';m.setAttribute('role','status');}
function rootMarkup(en){return '<div class="dzoft-change-message" role="status" aria-live="polite"></div><div class="dzoft-change-content">'+tr(en,'Chargement des demandes…','Loading requests…')+'</div>';}
function linesTable(r,en){
 var lines=Array.isArray(r.lines)?r.lines:null;
 if(!lines)return '<p>'+esc(r.proposed_scope||'')+'</p><p><strong>'+tr(en,'Supplément proposé : ','Proposed extra charge: ')+cash(r.extra_price)+'</strong></p>';
 return '<div class="dzoft-change-table"><table><thead><tr><th>'+tr(en,'Prestation','Item')+'</th><th>'+tr(en,'Qté','Qty')+'</th><th>'+tr(en,'Prix','Price')+'</th><th>'+tr(en,'Total','Total')+'</th></tr></thead><tbody>'+
  lines.map(function(l){return '<tr><td>'+esc(l.label)+(l.detail?'<small>'+esc(l.detail)+'</small>':'')+'</td><td>'+esc(String(l.qty).replace('.',','))+'</td><td>'+cash(l.price)+'</td><td>'+cash(Math.round(num(l.qty)*num(l.price)*100)/100)+'</td></tr>';}).join('')+
  '</tbody><tfoot><tr><th colspan="3">'+tr(en,'Total du complément','Extra total')+'</th><th>'+cash(r.extra_price)+'</th></tr></tfoot></table></div>';
}
function proposalBlock(r,en){
 if(!r.proposed_scope&&!r.lines)return '';
 return '<div class="dzoft-change-proposal"><b>'+(r.proposal_number?tr(en,'Proposition n° ','Proposal no. ')+esc(r.proposal_number):tr(en,'Proposition DZOFT','DZOFT proposal'))+
  (r.proposal_version>1?' · '+tr(en,'version ','version ')+esc(r.proposal_version):'')+'</b>'+linesTable(r,en)+
  '<p>'+tr(en,'Délai : ','Timeline: ')+esc(r.timeline_impact||tr(en,'aucun changement annoncé','no change specified'))+'</p>'+
  (r.already_done?'<p>'+tr(en,'Ces travaux ont déjà été réalisés à votre demande.','This work has already been done at your request.')+'</p>':'')+
  '<p class="dzoft-change-note">'+tr(en,'TVA non applicable, article 293 B du CGI. Le prix du devis d’origine reste inchangé.','VAT not applicable, article 293 B of the French tax code. The original quote price remains unchanged.')+'</p></div>';
}
function signedNote(r,en){
 return '<p class="dzoft-change-confirm">'+tr(en,'Signée par ','Signed by ')+esc(r.decision_name||'')+' · '+esc(when(r.decided_at))+
  (r.decision_method==='email'?' · '+tr(en,'code reçu par e-mail ','code received by e-mail ')+esc(r.decision_target||''):'')+'. '+
  tr(en,'Le prix du devis d’origine reste inchangé ; cette signature autorise uniquement les prestations détaillées ci-dessus.','The original quote price remains unchanged; this approval covers only the additional work described.')+'</p>';
}

/* ---------------- client ---------------- */
function openForm(en){return '<details class="dzoft-change-new"><summary>'+tr(en,'＋ Demander une modification','＋ Request a change')+'</summary><form class="dzoft-change-form" data-change-create>'+
 '<label>'+tr(en,'Objet de la demande','Request title')+'<input name="title" maxlength="120" minlength="3" required placeholder="'+tr(en,'Ex. : Ajouter une page','E.g. add a new page')+'"></label>'+
 '<label>'+tr(en,'Décrivez précisément ce que vous souhaitez ajouter ou modifier','Explain what you would like to add or change')+'<textarea name="description" minlength="10" maxlength="2000" rows="3" required></textarea></label>'+
 '<p>'+tr(en,'Vous ne payez rien en envoyant cette demande. DZOFT étudie le prix et le délai, puis vous soumet une proposition à signer avant tout supplément.','Submitting a request does not incur any charge. DZOFT will assess the cost and timeline, then ask for your signature before any extra work.')+'</p>'+
 '<button class="btn main" type="submit">'+tr(en,'Envoyer la demande','Submit request')+'</button></form></details>';}
function clientCard(r,en,name){
 var status=labels(en)[r.status]||r.status;
 var h='<article class="dzoft-change-item"><header><b>'+esc(r.title)+'</b><span class="dzoft-change-status">'+esc(status)+'</span></header>'+
 (r.description&&r.description!=='Proposition établie par DZOFT.'?'<p>'+esc(r.description)+'</p>':'')+
 '<p class="dzoft-change-meta">'+tr(en,'Créée le ','Created on ')+esc(when(r.created_at))+'</p>'+proposalBlock(r,en);
 if(r.status==='proposed'){
  h+='<form data-change-sign="'+esc(r.id)+'" data-version="'+esc(r.proposal_version)+'" class="dzoft-change-form dzoft-change-sign">'+
   '<label>'+tr(en,'Nom de la personne qui signe','Name of the person signing')+
   '<input name="decisionName" maxlength="120" minlength="2" required autocomplete="name" value="'+esc(name||'')+'"></label>'+
   '<label class="dzoft-change-check"><input type="checkbox" name="consent" required><span>'+
   tr(en,'J’ai lu les prestations, leur prix et le délai éventuel. Je comprends que ma signature autorise ces travaux et leur facturation, en complément du devis d’origine.','I have reviewed the items, their price and any timeline impact. I understand that my signature authorizes this additional work and its invoicing, on top of the original quote.')+
   '</span></label>'+
   '<div class="dzoft-change-actions"><button class="btn main" type="button" data-change-code="'+esc(r.id)+'">'+tr(en,'Recevoir mon code de signature par e-mail','Send my signing code by e-mail')+'</button></div>'+
   '<div class="dzoft-change-code" hidden><p data-code-sent></p><label>'+tr(en,'Code reçu par e-mail (6 chiffres)','Code received by e-mail (6 digits)')+
   '<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></label>'+
   '<div class="dzoft-change-actions"><button class="btn main" type="submit">'+tr(en,'Signer la proposition','Sign the proposal')+'</button></div></div>'+
   '<div class="dzoft-change-actions"><button class="btn line" type="button" data-change-decline="'+esc(r.id)+'">'+tr(en,'Refuser cette proposition','Decline proposal')+'</button></div></form>';
 }
 // Withdraw is for the client's own requests; an owner proposal is simply declined.
 if(r.status==='requested'||(r.status==='proposed'&&r.description!=='Proposition établie par DZOFT.'))h+='<button class="btn line sm" type="button" data-change-withdraw="'+esc(r.id)+'">'+tr(en,'Retirer cette demande','Withdraw request')+'</button>';
 if(['approved','in_progress','completed'].includes(r.status))h+=signedNote(r,en);
 return h+history(r,en)+'</article>';
}
function bindClient(root,options){
 var en=!!options.en,quoteId=options.quoteId,call=options.call,name=options.clientName||'',busy=false;
 root.innerHTML=rootMarkup(en);var records=[];
 function refresh(){return call('list_change_requests',{p_quote:quoteId}).then(function(rows){records=Array.isArray(rows)?rows:[];root.querySelector('.dzoft-change-content').innerHTML=
  '<p class="dzoft-change-help">'+tr(en,'Les changements après signature sont étudiés séparément. Aucun supplément sans votre accord.','Changes after signing are reviewed separately. No extra charge without your agreement.')+'</p>'+
  openForm(en)+(records.length?records.map(function(r){return clientCard(r,en,name);}).join(''):'<p>'+tr(en,'Aucune demande de modification pour ce projet.','No change requests for this project yet.')+'</p>');
 }).catch(function(err){banner(root,stateError(err,en),true);});}
 function perform(promise,done){if(busy)return;busy=true;return promise.then(function(){banner(root,done||tr(en,'Action enregistrée.','Action recorded.'),false);return refresh();}).catch(function(e){banner(root,stateError(e,en),true);}).finally(function(){busy=false;});}
 root.addEventListener('submit',function(ev){var form=ev.target;if(!form.matches('[data-change-create],[data-change-sign]'))return;ev.preventDefault();if(busy||!form.reportValidity())return;
  if(form.hasAttribute('data-change-create')){perform(call('create_change_request',{p_quote:quoteId,p_title:form.elements.title.value.trim(),p_description:form.elements.description.value.trim()}));return;}
  var code=form.elements.code.value.replace(/\D/g,'');
  if(code.length!==6){form.elements.code.focus();banner(root,tr(en,'Saisissez les 6 chiffres reçus par e-mail.','Enter the 6 digits received by e-mail.'),true);return;}
  perform(call('sign_change_request',{p_request:form.dataset.changeSign,p_version:Number(form.dataset.version),p_name:form.elements.decisionName.value.trim(),p_code:code}),
   tr(en,'Proposition signée. Merci !','Proposal signed. Thank you!'));
 });
 root.addEventListener('click',function(ev){var btn=ev.target.closest('button');if(!btn||busy)return;
  if(btn.dataset.changeCode){
   var form=btn.closest('form');if(!form.reportValidity())return;
   if(typeof options.sendCode!=='function'){banner(root,tr(en,'Envoi du code indisponible. Rechargez la page.','Code sending unavailable. Reload the page.'),true);return;}
   busy=true;btn.disabled=true;
   Promise.resolve(options.sendCode(btn.dataset.changeCode)).then(function(r){
    var box=form.querySelector('.dzoft-change-code');box.hidden=false;
    box.querySelector('[data-code-sent]').textContent=tr(en,'Code envoyé à ','Code sent to ')+((r&&r.target)||tr(en,'votre adresse e-mail','your e-mail address'))+tr(en,'. Il est valable 10 minutes.','. It is valid for 10 minutes.');
    btn.textContent=tr(en,'Renvoyer un code','Send a new code');form.elements.code.focus();
   }).catch(function(e){banner(root,stateError(e,en),true);}).finally(function(){busy=false;btn.disabled=false;});
   return;
  }
  if(btn.dataset.changeDecline){var f=btn.closest('form'),n=f.elements.decisionName.value.trim();if(!n||n.length<2){f.elements.decisionName.focus();return;}if(!global.confirm(tr(en,'Refuser cette proposition ?','Decline this proposal?')))return;
   perform(call('decide_change_request',{p_request:btn.dataset.changeDecline,p_version:Number(f.dataset.version),p_approve:false,p_name:n}));}
  if(btn.dataset.changeWithdraw){if(!global.confirm(tr(en,'Retirer la demande de modification ?','Withdraw this change request?')))return;perform(call('withdraw_change_request',{p_request:btn.dataset.changeWithdraw}));}
 });
 return refresh();
}

/* ---------------- owner ---------------- */
function words(label){return String(label||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(/[^a-z0-9]+/).filter(function(w){return w.length>3;});}
function plain(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
function lineRow(l,en){
 l=l||{};
 return '<tr data-line><td><input name="label" maxlength="160" required placeholder="'+tr(en,'Prestation','Item')+'" value="'+esc(l.label||'')+'"></td>'+
  '<td><input name="qty" type="number" min="0.01" max="1000" step="0.01" required value="'+esc(l.qty==null?1:l.qty)+'" aria-label="'+tr(en,'Quantité','Quantity')+'"></td>'+
  '<td><input name="price" type="number" min="0" max="1000000" step="0.01" required value="'+esc(l.price==null?'':l.price)+'" aria-label="'+tr(en,'Prix unitaire (€)','Unit price (€)')+'"></td>'+
  '<td data-line-total>'+cash(0)+'</td><td><button class="btn line sm" type="button" data-line-remove aria-label="'+tr(en,'Retirer la ligne','Remove line')+'">×</button></td></tr>';
}
function calculator(en,blocks,target){
 // target: null for a new proposal, or the client request being priced.
 var r=target||{};
 return '<form class="dzoft-change-form dzoft-calc" data-change-offer'+(target?' data-for="'+esc(r.id)+'"':'')+'>'+
  (target?'':'<label>'+tr(en,'Titre de la proposition','Proposal title')+'<input name="title" maxlength="120" minlength="3" required placeholder="'+tr(en,'Ex. : Ajouts réalisés depuis le devis','E.g. additions since the quote')+'"></label>')+
  '<details class="dzoft-calc-request"'+(target?' open':'')+'><summary>'+tr(en,'Repérer depuis la demande du client (facultatif)','Detect from the client request (optional)')+'</summary>'+
  '<label>'+tr(en,'Texte de la demande','Request text')+'<textarea name="request" rows="3" maxlength="4000">'+esc(target?(r.title+'\n'+(r.description||'')):'')+'</textarea></label>'+
  '<button class="btn line sm" type="button" data-calc-detect>'+tr(en,'Repérer dans ma liste de prix','Find in my price list')+'</button></details>'+
  '<div class="dzoft-calc-pick"><label>'+tr(en,'Ajouter depuis ma liste de prix','Add from my price list')+'<select name="block"><option value="">'+(blocks.length?tr(en,'— Choisir —','— Choose —'):tr(en,'Liste vide : ajoutez une ligne libre','Empty list: add a free line'))+'</option>'+
  blocks.map(function(b,i){return '<option value="'+i+'">'+esc(b.label)+' · '+cash(b.price)+'</option>';}).join('')+'</select></label>'+
  '<button class="btn line sm" type="button" data-calc-add-block>'+tr(en,'Ajouter','Add')+'</button>'+
  '<button class="btn line sm" type="button" data-calc-add-line>'+tr(en,'＋ Ligne libre','＋ Free line')+'</button></div>'+
  '<div class="dzoft-change-table"><table><thead><tr><th>'+tr(en,'Prestation','Item')+'</th><th>'+tr(en,'Qté','Qty')+'</th><th>'+tr(en,'Prix unitaire','Unit price')+'</th><th>'+tr(en,'Total','Total')+'</th><th><span class="sr-only">'+tr(en,'Retirer','Remove')+'</span></th></tr></thead>'+
  '<tbody data-calc-lines>'+lineRow(null,en)+'</tbody><tfoot><tr><th colspan="3">'+tr(en,'Total du complément','Extra total')+'</th><th data-calc-total>'+cash(0)+'</th><th></th></tr></tfoot></table></div>'+
  '<label>'+tr(en,'Conséquence sur le délai','Schedule impact')+'<input name="timeline" maxlength="600" placeholder="'+tr(en,'Ex. : aucun changement ; + 3 jours','E.g. no change; +3 days')+'"></label>'+
  '<label class="dzoft-change-check"><input type="checkbox" name="done"><span>'+tr(en,'Travaux déjà réalisés : après la signature, ils pourront être facturés directement.','Work already done: once signed, it can be invoiced directly.')+'</span></label>'+
  '<label class="dzoft-change-check"><input type="checkbox" name="keep" checked><span>'+tr(en,'Ajouter les nouvelles lignes à ma liste de prix','Add new lines to my price list')+'</span></label>'+
  '<p>'+tr(en,'Le client voit cette proposition dans son espace et la signe avec un code reçu par e-mail. Rien n’est dû tant qu’il ne l’a pas approuvée lui-même. Utilisez « Envoyer au client » pour le prévenir par e-mail.','The client sees this proposal in their workspace and signs it with a code sent by e-mail. Nothing is owed until they approve it themselves. Use “Send to client” to notify them by e-mail.')+'</p>'+
  '<button class="btn main" type="submit">'+(target?tr(en,'Chiffrer cette demande','Price this request'):tr(en,'Créer la proposition','Create the proposal'))+'</button></form>';
}
function priceList(en,blocks){
 return '<details class="dzoft-change-new dzoft-price-list"><summary>'+tr(en,'Ma liste de prix','My price list')+' ('+blocks.length+')</summary>'+
  (blocks.length?'<div class="dzoft-change-table"><table><thead><tr><th>'+tr(en,'Prestation','Item')+'</th><th>'+tr(en,'Prix','Price')+'</th><th>'+tr(en,'Mots repérés','Matching words')+'</th><th><span class="sr-only">'+tr(en,'Retirer','Remove')+'</span></th></tr></thead><tbody>'+
   blocks.map(function(b,i){return '<tr><td>'+esc(b.label)+'</td><td><input type="number" min="0" max="1000000" step="0.01" value="'+esc(b.price)+'" data-block-price="'+i+'" aria-label="'+tr(en,'Prix de ','Price of ')+esc(b.label)+'"></td>'+
    '<td><input maxlength="200" value="'+esc((b.words||[]).join(', '))+'" data-block-words="'+i+'" aria-label="'+tr(en,'Mots repérés pour ','Matching words for ')+esc(b.label)+'"></td>'+
    '<td><button class="btn line sm" type="button" data-block-remove="'+i+'" aria-label="'+tr(en,'Retirer ','Remove ')+esc(b.label)+'">×</button></td></tr>';}).join('')+'</tbody></table></div>'+
   '<button class="btn line sm" type="button" data-block-save>'+tr(en,'Enregistrer la liste','Save the list')+'</button>'
  :'<p>'+tr(en,'Votre liste se remplit quand vous créez une proposition avec « Ajouter les nouvelles lignes à ma liste de prix ».','Your list fills up when you create a proposal with “Add new lines to my price list”.')+'</p>')+'</details>';
}
function adminCard(r,en,invoice,blocks){
 var status=labels(en)[r.status]||r.status;
 var h='<article class="dzoft-change-item" data-change-card="'+esc(r.id)+'"><header><b>'+esc(r.title)+(r.proposal_number?' · '+esc(r.proposal_number):'')+'</b><span class="dzoft-change-status">'+esc(status)+'</span></header>'+
 (r.description&&r.description!=='Proposition établie par DZOFT.'?'<p>'+esc(r.description)+'</p>':'')+
 '<p class="dzoft-change-meta">'+tr(en,'Créée le ','Created on ')+esc(when(r.created_at))+'</p>'+proposalBlock(r,en);
 if(r.status==='proposed'){
  h+='<div class="dzoft-change-actions"><button class="btn main sm" type="button" data-change-send="'+esc(r.id)+'">'+(r.sent_at?tr(en,'Renvoyer au client par e-mail','Send again by e-mail'):tr(en,'Envoyer au client par e-mail','Send to client by e-mail'))+'</button></div>'+
   (r.sent_at?'<p class="dzoft-change-meta">'+tr(en,'Envoyée le ','Sent on ')+esc(when(r.sent_at))+tr(en,'. En attente de la signature du client.','. Waiting for the client’s signature.')+'</p>':'<p class="dzoft-change-meta">'+tr(en,'Visible dans l’espace du client, pas encore envoyée par e-mail.','Visible in the client space, not yet sent by e-mail.')+'</p>');
 }
 if(r.status==='requested')h+='<details class="dzoft-change-new"><summary>'+tr(en,'Chiffrer cette demande','Price this request')+'</summary>'+calculator(en,blocks,r)+'</details>';
 if(r.status==='requested'||r.status==='proposed'){
  h+='<form data-change-reject="'+esc(r.id)+'" class="dzoft-change-form dzoft-change-reject"><label>'+tr(en,'Motif si la proposition est retirée ou la demande non retenue','Reason if withdrawn or declined')+
   '<input name="reason" minlength="5" maxlength="600" placeholder="'+tr(en,'Ex. : remplacée par une nouvelle proposition','E.g. replaced by a new proposal')+'" required></label>'+
   '<button class="btn line sm" type="submit">'+tr(en,'Retirer / refuser','Withdraw / reject')+'</button></form>';
 }
 if(['approved','in_progress','completed'].includes(r.status))h+=signedNote(r,en)+'<p class="dzoft-change-meta">'+tr(en,'Facturez ce complément séparément, sans modifier la facture initiale.','Invoice this addition separately; do not change the original invoice.')+'</p>';
 if(r.status==='approved')h+='<div class="dzoft-change-actions">'+(r.already_done?'':'<button class="btn line sm" type="button" data-change-progress="'+esc(r.id)+'" data-next="in_progress">'+tr(en,'Démarrer les travaux complémentaires','Start approved additional work')+'</button>')+
  '<button class="btn main sm" type="button" data-change-progress="'+esc(r.id)+'" data-next="completed">'+tr(en,'Marquer les travaux terminés','Mark additional work completed')+'</button></div>';
 if(r.status==='in_progress')h+='<button class="btn main sm" type="button" data-change-progress="'+esc(r.id)+'" data-next="completed">'+tr(en,'Marquer les travaux terminés','Mark additional work completed')+'</button>';
 if(r.status==='completed'){
  // The invoice amount is the signed extra price; the original quote and its invoices stay untouched.
  if(invoice)h+='<p class="dzoft-change-meta">'+tr(en,'Facture complémentaire ','Supplementary invoice ')+esc(invoice.num||'')+tr(en,' émise ('+cash(invoice.amt)+'). Retrouvez-la dans « Factures » pour l’envoyer ou enregistrer son paiement.',' issued ('+cash(invoice.amt)+'). Find it under “Invoices” to send it or record its payment.')+'</p>';
  else if(Number(r.extra_price)>0)h+='<p class="dzoft-change-meta">'+tr(en,'Travaux terminés. La facture reprend exactement le montant signé par le client.','Work complete. The invoice uses exactly the amount the client signed.')+'</p>'+
   '<button class="btn main sm" type="button" data-change-invoice="'+esc(r.id)+'">'+tr(en,'Créer la facture complémentaire ('+cash(r.extra_price)+')','Create the supplementary invoice ('+cash(r.extra_price)+')')+'</button>';
  else h+='<p class="dzoft-change-meta">'+tr(en,'Travaux terminés, sans supplément : rien à facturer.','Work complete at no extra charge: nothing to invoice.')+'</p>';
 }
 return h+history(r,en)+'</article>';
}
function bindOwner(root,options){
 var sb=options.sb,quoteId=options.quoteId,en=!!options.en,busy=false;
 // The project page calls this after every reload: keep one set of listeners, refresh the options.
 root.__dzoftOwnerOptions=options;
 if(root.__dzoftOwnerRefresh&&root.__dzoftOwnerQuote===quoteId)return root.__dzoftOwnerRefresh();
 function invoiceOf(r){var list=(root.__dzoftOwnerOptions||{}).invoices||[];for(var i=0;i<list.length;i++)if(list[i]&&list[i].change===r.id)return list[i];return null;}
 root.innerHTML=rootMarkup(en);var records=[],blocks=[];
 function loadBlocks(){return Promise.resolve(sb.select('settings','select=price_blocks&id=eq.1')).then(function(rows){var b=rows&&rows[0]&&rows[0].price_blocks;blocks=Array.isArray(b)?b.filter(function(x){return x&&x.label;}):[];}).catch(function(){blocks=[];});}
 function saveBlocks(next){return Promise.resolve(sb.update('settings',1,{price_blocks:next.slice(0,200)})).then(function(){blocks=next.slice(0,200);});}
 function refresh(){return Promise.all([sb.rpc('owner_list_change_requests',{p_quote:quoteId},true),loadBlocks()]).then(function(res){records=Array.isArray(res[0])?res[0]:[];
  var keepOpen=root.querySelector('.dzoft-change-new[data-new-proposal]');keepOpen=keepOpen&&keepOpen.open;
  root.querySelector('.dzoft-change-content').innerHTML=
  '<p class="dzoft-change-help">'+tr(en,'Une demande n’est pas une commande. Chiffrez les travaux, envoyez la proposition, puis attendez la signature du client (code reçu par e-mail) avant de les facturer.','A request is not an order. Price the work, send the proposal, then wait for the client’s signature (code sent by e-mail) before invoicing.')+'</p>'+
  '<details class="dzoft-change-new" data-new-proposal'+(keepOpen?' open':'')+'><summary>'+tr(en,'＋ Proposer un complément chiffré','＋ Propose priced additional work')+'</summary>'+calculator(en,blocks,null)+'</details>'+
  priceList(en,blocks)+
  (records.length?records.map(function(r){return adminCard(r,en,invoiceOf(r),blocks);}).join(''):'<p>'+tr(en,'Aucune demande pour ce projet.','No change requests for this project.')+'</p>');
  root.querySelectorAll('form[data-change-offer]').forEach(recalc);
 }).catch(function(err){banner(root,stateError(err,en),true);});}
 function perform(p,msg){if(busy)return;busy=true;return p.then(function(){banner(root,msg||tr(en,'Décision enregistrée.','Decision recorded.'),false);return refresh();}).catch(function(err){banner(root,stateError(err,en),true);}).finally(function(){busy=false;});}
 function readLines(form){return Array.prototype.map.call(form.querySelectorAll('[data-line]'),function(row){return {label:row.querySelector('[name=label]').value.trim(),qty:num(row.querySelector('[name=qty]').value),price:num(row.querySelector('[name=price]').value)};});}
 function recalc(form){
  var total=0;
  form.querySelectorAll('[data-line]').forEach(function(row){
   var q=num(row.querySelector('[name=qty]').value),p=num(row.querySelector('[name=price]').value);
   var t=Number.isFinite(q)&&Number.isFinite(p)?Math.round(q*p*100):0;total+=t;
   row.querySelector('[data-line-total]').textContent=cash(t/100);
  });
  form.querySelector('[data-calc-total]').textContent=cash(total/100);
 }
 function addLine(form,l){
  var tbody=form.querySelector('[data-calc-lines]');
  // Replace the first empty line instead of stacking empty rows.
  var empty=Array.prototype.filter.call(tbody.querySelectorAll('[data-line]'),function(row){return !row.querySelector('[name=label]').value.trim()&&!row.querySelector('[name=price]').value;})[0];
  var holder=document.createElement('tbody');holder.innerHTML=lineRow(l,en);var row=holder.firstChild;
  if(empty&&l)tbody.replaceChild(row,empty);else tbody.appendChild(row);
  recalc(form);return row;
 }
 root.addEventListener('input',function(ev){var f=ev.target.closest('form[data-change-offer]');if(f)recalc(f);});
 root.addEventListener('click',function(ev){
  var b=ev.target.closest('button');if(!b)return;
  var form=b.closest('form[data-change-offer]');
  if(b.hasAttribute('data-calc-add-line')&&form){addLine(form,null).querySelector('[name=label]').focus();return;}
  if(b.hasAttribute('data-calc-add-block')&&form){var i=form.elements.block.value;if(i===''||!blocks[+i])return;var bl=blocks[+i];addLine(form,{label:bl.label,qty:1,price:bl.price});form.elements.block.value='';return;}
  if(b.hasAttribute('data-line-remove')&&form){var rows=form.querySelectorAll('[data-line]');if(rows.length>1)b.closest('[data-line]').remove();else{b.closest('[data-line]').querySelectorAll('input').forEach(function(x){x.value=x.name==='qty'?'1':'';});}recalc(form);return;}
  if(b.hasAttribute('data-calc-detect')&&form){
   var text=plain(form.elements.request.value),present=readLines(form).map(function(l){return l.label;}),found=0;
   blocks.forEach(function(bl){var ws=(bl.words&&bl.words.length?bl.words:words(bl.label)).map(plain);if(present.indexOf(bl.label)<0&&ws.some(function(w){return w&&text.indexOf(w)>=0;})){addLine(form,{label:bl.label,qty:1,price:bl.price});found++;}});
   banner(root,found?tr(en,found+' prestation(s) repérée(s) : vérifiez-les.',found+' item(s) found: please check them.'):tr(en,'Rien de repéré dans votre liste : ajoutez des lignes libres.','Nothing found in your list: add free lines.'),!found);return;
  }
  if(busy)return;
  if(b.dataset.changeSend){if(!global.confirm(tr(en,'Envoyer cette proposition au client par e-mail ? Il pourra la lire et la signer dans son espace.','E-mail this proposal to the client? They can read and sign it in their space.')))return;
   perform(sb.rpc('owner_send_change_proposal',{p_request:b.dataset.changeSend},true).then(function(r){if(typeof sb.fn==='function')sb.fn('process-notification-outbox',{}).catch(function(){});return r;}),tr(en,'E-mail mis en file d’envoi.','E-mail queued.'));return;}
  if(b.dataset.changeInvoice){var record=records.filter(function(r){return r.id===b.dataset.changeInvoice;})[0],issue=(root.__dzoftOwnerOptions||{}).onInvoice;if(record&&typeof issue==='function')issue(record,b);return;}
  if(b.dataset.changeProgress){var next=b.dataset.next;if(next!=='in_progress'&&next!=='completed')return;if(!global.confirm(next==='completed'?tr(en,'Confirmer que ces travaux sont terminés ? Ils pourront ensuite être facturés.','Confirm this work is complete? It can then be invoiced.'):tr(en,'Démarrer ces travaux complémentaires ?','Start this additional work?')))return;perform(sb.rpc('owner_progress_change',{p_request:b.dataset.changeProgress,p_status:next},true));return;}
  if(b.hasAttribute('data-block-remove')){var k=+b.dataset.blockRemove,copy=blocks.slice();copy.splice(k,1);perform(saveBlocks(copy),tr(en,'Liste de prix enregistrée.','Price list saved.'));return;}
  if(b.hasAttribute('data-block-save')){
   var edited=blocks.map(function(bl,i){var p=root.querySelector('[data-block-price="'+i+'"]'),w=root.querySelector('[data-block-words="'+i+'"]');
    var price=p?num(p.value):bl.price;return {label:bl.label,price:Number.isFinite(price)&&price>=0?Math.round(price*100)/100:bl.price,words:w?w.value.split(',').map(function(x){return x.trim().toLowerCase();}).filter(Boolean).slice(0,12):(bl.words||[])};});
   perform(saveBlocks(edited),tr(en,'Liste de prix enregistrée.','Price list saved.'));return;
  }
 });
 root.addEventListener('submit',function(ev){var f=ev.target;if(!f.matches('[data-change-offer],[data-change-reject]'))return;ev.preventDefault();if(busy||!f.reportValidity())return;
  if(f.hasAttribute('data-change-offer')){
   var lines=readLines(f).filter(function(l){return l.label||Number.isFinite(l.price);});
   if(!lines.length||lines.some(function(l){return l.label.length<2||!(l.qty>0)||!Number.isFinite(l.price)||l.price<0;})){banner(root,stateError({message:'Each line needs a label, a quantity and a price'},en),true);return;}
   lines=lines.map(function(l){return {label:l.label,qty:cents(l.qty)/100,price:cents(l.price)/100};});
   var total=lines.reduce(function(n,l){return n+Math.round(l.qty*l.price*100);},0)/100;
   if(!global.confirm(tr(en,'Créer cette proposition de '+cash(total)+' ? Elle sera visible dans l’espace du client, qui devra la signer.','Create this '+cash(total)+' proposal? It will be visible in the client space and must be signed by the client.')))return;
   var known=blocks.map(function(bl){return bl.label;}),fresh=f.elements.keep.checked?lines.filter(function(l){return known.indexOf(l.label)<0;}).map(function(l){return {label:l.label,price:l.price,words:words(l.label).slice(0,6)};}):[];
   var call=f.dataset.for?sb.rpc('owner_price_change_request',{p_request:f.dataset.for,p_lines:lines,p_timeline:f.elements.timeline.value.trim(),p_already_done:f.elements.done.checked},true)
    :sb.rpc('owner_create_priced_proposal',{p_quote:quoteId,p_title:f.elements.title.value.trim(),p_lines:lines,p_timeline:f.elements.timeline.value.trim(),p_already_done:f.elements.done.checked},true);
   perform(call.then(function(r){return fresh.length?saveBlocks(blocks.concat(fresh)).catch(function(){}).then(function(){return r;}):r;}),
    tr(en,'Proposition créée. Envoyez-la au client avec « Envoyer au client par e-mail ».','Proposal created. Use “Send to client by e-mail” to notify them.'));
   return;
  }
  if(f.dataset.changeReject){if(!global.confirm(tr(en,'Retirer ou refuser cette proposition ?','Withdraw or reject this proposal?')))return;perform(sb.rpc('owner_reject_change',{p_request:f.dataset.changeReject,p_reason:f.elements.reason.value.trim()},true));}
 });
 root.__dzoftOwnerRefresh=refresh;root.__dzoftOwnerQuote=quoteId;
 return refresh();
}
api.client=bindClient;api.owner=bindOwner;
global.DzoftChanges=api;
})(window);
