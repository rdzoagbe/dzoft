(function(global){
'use strict';
/* DZOFT extra work after signature.
   Owner: prices the work line by line (from his price list or free lines), the server totals and numbers
   the proposal (D-…-C1), owner reviews and shares from Outlook/WhatsApp, then confirms sharing. Client signs with a code
   received by e-mail, like the original quote, or declines. Approved work is then invoiced from its
   signed amount; the original quote, its invoices and payments never change. */
var api={};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function cash(v){return Number(v||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});}
function when(v){return v?new Date(v).toLocaleString('fr-FR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';}
function tr(en,fr,english){return en?english:fr;}
function num(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:NaN;}
function cents(v){return Math.round(num(v)*100);}
// Prices and quantities: at most two decimals, comma or point (what the server accepts).
function amount(v){var t=String(v==null?'':v).trim();return /^-?\d{1,7}(?:[.,]\d{1,2})?$/.test(t)?num(t):NaN;}
function labels(en){return {requested:tr(en,'À étudier','Awaiting review'),proposed:tr(en,'Proposition à signer','Awaiting signature'),approved:tr(en,'Signée','Signed'),declined:tr(en,'Refusée par le client','Declined by client'),rejected:tr(en,'Non retenue','Not proceeding'),withdrawn:tr(en,'Retirée','Withdrawn'),in_progress:tr(en,'Travaux en cours','In progress'),completed:tr(en,'Travaux terminés','Work completed')};}
function eventLabels(en){var l=labels(en);l.sent=tr(en,'Partage déclaré','Sharing recorded');l.approved=tr(en,'Signée','Signed');l.proposed=tr(en,'Proposition chiffrée','Priced proposal');l.requested=tr(en,'Demande','Request');return l;}
function history(r,en){var h=r.history||[],l=eventLabels(en);return '<details class="dzoft-change-history"><summary>'+tr(en,'Historique des décisions','Decision history')+' ('+h.length+')</summary><ol>'+h.map(function(e){return '<li>'+esc(l[e.event_type]||e.event_type)+' · '+esc(e.actor_type==='owner'?'DZOFT':'Client')+' · '+esc(when(e.at))+'</li>';}).join('')+'</ol></details>';}
function stateError(err,en){
 var m=(err&&err.message)||'';
 var map={'Incorrect code':tr(en,'Code incorrect.','Incorrect code.'),'Request your code first':tr(en,'Demandez d’abord votre code.','Request your code first.'),
  'Code expired: request a new one':tr(en,'Code expiré : demandez-en un nouveau.','Code expired: request a new one.'),
  'Too many attempts: request a new code':tr(en,'Trop d’essais : demandez un nouveau code.','Too many attempts: request a new code.'),
  'Approval requires the code sent by e-mail':tr(en,'La signature se fait avec le code reçu par e-mail.','Signing requires the code sent by e-mail.'),
  'Each line needs a label, a quantity and a price':tr(en,'Chaque ligne doit avoir un libellé, une quantité et un prix (deux décimales au plus).','Each line needs a label, a quantity and a price (two decimals at most).')};
 return esc(map[m]||m||tr(en,'Opération impossible. Réessayez.','Action failed. Please retry.'));
}
function banner(root,message,error){var m=root.querySelector('.dzoft-change-message');if(!m)return;m.textContent=message;m.style.color=error?'#9b2020':'#14613e';m.setAttribute('role','status');}
function rootMarkup(en){return '<div class="dzoft-change-message" role="status" aria-live="polite"></div><div class="dzoft-change-content">'+tr(en,'Chargement des demandes…','Loading requests…')+'</div>';}
function linesTable(r,en){
 var lines=Array.isArray(r.lines)?r.lines:null;
 if(!lines)return '<p>'+esc(r.proposed_scope||'')+'</p><p><strong>'+tr(en,'Supplément proposé : ','Proposed extra charge: ')+cash(r.extra_price)+'</strong></p>';
 return '<div class="dzoft-change-table"><table><thead><tr><th>'+tr(en,'Prestation','Item')+'</th><th>'+tr(en,'Qté','Qty')+'</th><th>'+tr(en,'Prix','Price')+'</th><th>'+tr(en,'Total','Total')+'</th></tr></thead><tbody>'+
  lines.map(function(l){var free=Number(l.price)===0;return '<tr><td>'+esc(l.label)+(l.detail?'<small>'+esc(l.detail)+'</small>':'')+'</td><td>'+esc(String(l.qty).replace('.',','))+'</td><td>'+(free?tr(en,'Offert','Free'):cash(l.price))+'</td><td>'+(free?tr(en,'Offert','Free'):cash(Math.round(num(l.qty)*num(l.price)*100)/100))+'</td></tr>';}).join('')+
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
 '<div class="dzoft-change-actions"><button class="btn main" type="submit">'+tr(en,'Envoyer la demande','Submit request')+'</button><button class="btn line" type="button" data-form-cancel>'+tr(en,'Annuler','Cancel')+'</button></div></form></details>';}
function termsLine(en,terms){
 // The proposal extends the signed quote and follows its general terms (Code civil art. 1119).
 var link='<a href="'+esc(terms&&terms.url||'../cgv.html')+'" target="_blank" rel="noopener">'+tr(en,'conditions générales de vente (CGV)','general terms of sale (CGV)')+'</a>';
 var quote=terms&&terms.quote?' '+esc(terms.quote):'';
 return tr(en,' Ce complément s’ajoute au devis'+quote+' et suit ses '+link+', que j’accepte.',' This addition extends quote'+quote+' and follows its '+link+', which I accept.');
}
function clientCard(r,en,name,terms){
 var status=labels(en)[r.status]||r.status;
 var h='<article class="dzoft-change-item"><header><b>'+esc(r.title)+'</b><span class="dzoft-change-status">'+esc(status)+'</span></header>'+
 (r.description&&r.description!=='Proposition établie par DZOFT.'?'<p>'+esc(r.description)+'</p>':'')+
 '<p class="dzoft-change-meta">'+tr(en,'Créée le ','Created on ')+esc(when(r.created_at))+'</p>'+proposalBlock(r,en);
 if(r.status==='proposed'){
  h+='<form data-change-sign="'+esc(r.id)+'" data-version="'+esc(r.proposal_version)+'" class="dzoft-change-form dzoft-change-sign">'+
   '<label>'+tr(en,'Nom de la personne qui signe','Name of the person signing')+
   '<input name="decisionName" maxlength="120" minlength="2" required autocomplete="name" value="'+esc(name||'')+'"></label>'+
   '<label class="dzoft-change-check"><input type="checkbox" name="consent" required><span>'+
   tr(en,'J’ai lu les prestations, leur prix et le délai éventuel. Je comprends que ma signature autorise ces travaux et leur facturation, en complément du devis d’origine.','I have reviewed the items, their price and any timeline impact. I understand that my signature authorizes this additional work and its invoicing, on top of the original quote.')+termsLine(en,terms)+
   '</span></label>'+
   '<div class="dzoft-change-actions"><button class="btn main" type="button" data-change-code="'+esc(r.id)+'">'+tr(en,'Recevoir mon code de signature par e-mail','Send my signing code by e-mail')+'</button></div>'+
   '<div class="dzoft-change-code" hidden><p data-code-sent></p><label>'+tr(en,'Code reçu par e-mail (6 chiffres)','Code received by e-mail (6 digits)')+
   '<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></label>'+
   '<div class="dzoft-change-actions"><button class="btn main" type="submit">'+tr(en,'Signer la proposition','Sign the proposal')+'</button></div></div>'+
   '<div class="dzoft-change-actions"><button class="btn line" type="button" data-form-cancel="later">'+tr(en,'Plus tard','Later')+'</button><button class="btn line" type="button" data-change-decline="'+esc(r.id)+'">'+tr(en,'Refuser cette proposition','Decline proposal')+'</button></div></form>';
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
  openForm(en)+(records.length?records.map(function(r){return clientCard(r,en,name,options.terms);}).join(''):'<p>'+tr(en,'Aucune demande de modification pour ce projet.','No change requests for this project yet.')+'</p>');
 }).catch(function(err){banner(root,stateError(err,en),true);});}
 function perform(promise,done){if(busy)return;busy=true;root.__dzoftChangeBusy=true;return promise.then(function(){banner(root,done||tr(en,'Action enregistrée.','Action recorded.'),false);return refresh();}).catch(function(e){banner(root,stateError(e,en),true);}).finally(function(){busy=false;root.__dzoftChangeBusy=false;});}
 root.addEventListener('submit',function(ev){var form=ev.target;if(!form.matches('[data-change-create],[data-change-sign]'))return;ev.preventDefault();if(busy||!form.reportValidity())return;
  if(form.hasAttribute('data-change-create')){perform(call('create_change_request',{p_quote:quoteId,p_title:form.elements.title.value.trim(),p_description:form.elements.description.value.trim()}));return;}
  var code=form.elements.code.value.replace(/\D/g,'');
  if(code.length!==6){form.elements.code.focus();banner(root,tr(en,'Saisissez les 6 chiffres reçus par e-mail.','Enter the 6 digits received by e-mail.'),true);return;}
  perform(call('sign_change_request',{p_request:form.dataset.changeSign,p_version:Number(form.dataset.version),p_name:form.elements.decisionName.value.trim(),p_code:code,p_terms:(options.terms&&options.terms.version)||''}),
   tr(en,'Proposition signée. Merci !','Proposal signed. Thank you!'));
 });
 root.addEventListener('click',function(ev){var btn=ev.target.closest('button');if(!btn||busy)return;
  if(btn.dataset.changeCode){
   var form=btn.closest('form');if(!form.reportValidity())return;
   if(typeof options.sendCode!=='function'){banner(root,tr(en,'Envoi du code indisponible. Rechargez la page.','Code sending unavailable. Reload the page.'),true);return;}
   busy=true;root.__dzoftChangeBusy=true;btn.disabled=true;
   Promise.resolve(options.sendCode(btn.dataset.changeCode)).then(function(r){
    var box=form.querySelector('.dzoft-change-code');box.hidden=false;
    box.querySelector('[data-code-sent]').textContent=tr(en,'Code envoyé à ','Code sent to ')+((r&&r.target)||tr(en,'votre adresse e-mail','your e-mail address'))+tr(en,'. Il est valable 10 minutes.','. It is valid for 10 minutes.');
    btn.textContent=tr(en,'Renvoyer un code','Send a new code');form.elements.code.focus();
   }).catch(function(e){banner(root,stateError(e,en),true);}).finally(function(){busy=false;root.__dzoftChangeBusy=false;btn.disabled=false;});
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
function tierDetail(t,when){return t?(t.label+' : '+t.rule+(when?' · '+when:'')).slice(0,300):(when||'');}
// Percentage of a discount line: given, or read from its label « … (10 %) » when an existing proposal is edited.
function discountPct(l){if(l.pct!=null&&l.pct!=='')return String(l.pct).replace('.',',');var m=/\((\d+(?:[.,]\d{1,2})?)\s*%\)\s*$/.exec(String(l.label||''));return m?m[1]:'';}
// A discount saved in euros (older proposals, no « (x %) » in its label) keeps its exact amount while the percentage
// shown for it is left as is; typing another percentage switches it to a percentage discount (Codex review, 18 Nov 2026).
function fixedCents(row){var pf=row.querySelector('[name=pct]');return pf&&pf.dataset.fixed&&pf.value===pf.dataset.shown?Math.round(Number(pf.dataset.fixed)*100):NaN;}
function lineRow(l,en,tiers){
 l=l||{};tiers=tiers||[];var discount=Number(l.price)<0||l.discount;
 var level=discount?'':'<select name="level" aria-label="'+tr(en,'Niveau de la prestation','Level of the item')+'"><option value="">'+tr(en,'Prix libre','Free price')+'</option>'+
  tiers.map(function(t){return '<option value="'+esc(t.key)+'"'+(l.level===t.key?' selected':'')+'>'+esc(t.label)+' · '+cash(t.price)+'</option>';}).join('')+'</select>';
 return '<tr data-line'+(discount?' data-discount':'')+' data-when="'+esc(l.when||'')+'"><td><input name="label" maxlength="160" required placeholder="'+tr(en,'Prestation','Item')+'" value="'+esc(l.label||'')+'">'+
  '<input type="hidden" name="source" value="'+esc(l.source||'')+'"><input type="hidden" name="detail" value="'+esc(l.detail||'')+'">'+level+
  '<small data-line-detail>'+esc(l.detail||'')+'</small>'+(l.origin?'<small class="dzoft-calc-origin" data-line-origin>'+esc(l.origin)+'</small>':'')+'</td>'+
  (discount?'<td><input name="qty" type="hidden" value="1">1</td>':'<td><input name="qty" type="text" inputmode="decimal" autocomplete="off" required value="'+esc(l.qty==null?1:l.qty)+'" aria-label="'+tr(en,'Quantité','Quantity')+'"></td>')+
  (discount
   // Commercial discount as a percentage of the other lines (18 Nov 2026); the euro amount is computed and sent.
   ?'<td class="dzoft-calc-pct"><span class="dzoft-calc-minus" aria-hidden="true">−</span><input name="pct" type="text" inputmode="decimal" autocomplete="off" required value="'+esc(discountPct(l))+'" aria-label="'+tr(en,'Remise en pourcentage du total','Discount as a percentage of the total')+'" placeholder="10"><span aria-hidden="true">%</span>'+
    '<input type="hidden" name="price" value="'+esc(l.price==null||l.price===''?'':String(Math.abs(Number(l.price))))+'"'+(discountPct(l)===''&&Number(l.price)<0?' data-amount="'+esc(String(Math.abs(Number(l.price))))+'"':'')+'></td>'
   :'<td><input name="price" type="text" inputmode="decimal" autocomplete="off" required value="'+esc(l.price==null||l.price===''?'':String(Math.abs(Number(l.price))).replace('.',','))+'" aria-label="'+tr(en,'Prix unitaire (€)','Unit price (€)')+'"'+(l.price==null||l.price===''?' data-unpriced':'')+'></td>')+
  '<td data-line-total>'+cash(0)+'</td><td><button class="btn line sm" type="button" data-line-remove aria-label="'+tr(en,'Retirer la ligne','Remove line')+'">×</button></td></tr>';
}
function calculator(en,blocks,target,tiers,edit){
 // target: null for a new proposal, or the client request being priced.
 // edit (18 Nov 2026): the unsent draft itself, opened with its lines so the owner can change them; same number kept.
 var r=target||{},rows=edit&&Array.isArray(r.lines)&&r.lines.length?r.lines.map(function(l){return lineRow(l,en,tiers);}).join(''):lineRow(null,en,tiers);
 return '<form class="dzoft-change-form dzoft-calc" data-change-offer'+(target?' data-for="'+esc(r.id)+'"':'')+(edit?' data-edit':'')+'>'+
  (target?'':'<label>'+tr(en,'Titre de la proposition','Proposal title')+'<input name="title" maxlength="120" minlength="3" required placeholder="'+tr(en,'Ex. : Ajouts réalisés depuis le devis','E.g. additions since the quote')+'"></label>')+
  (edit?'':'<details class="dzoft-calc-request"'+(target?' open':'')+'><summary>'+tr(en,'Repérer depuis la demande du client (facultatif)','Detect from the client request (optional)')+'</summary>'+
  '<label>'+tr(en,'Texte de la demande','Request text')+'<textarea name="request" rows="3" maxlength="4000">'+esc(target?(r.title+'\n'+(r.description||'')):'')+'</textarea></label>'+
  '<button class="btn line sm" type="button" data-calc-detect>'+tr(en,'Repérer dans ma liste de prix','Find in my price list')+'</button></details>')+
  (target?'':'<div class="dzoft-calc-auto"><div class="dzoft-calc-dates"><label class="dzoft-calc-since">'+tr(en,'Du (facultatif)','From (optional)')+'<input type="date" name="since" aria-describedby="dzoft-calc-since-help"></label>'+
  '<label class="dzoft-calc-since">'+tr(en,'Au (facultatif)','To (optional)')+'<input type="date" name="until" aria-describedby="dzoft-calc-since-help"></label></div>'+
  '<small id="dzoft-calc-since-help">'+tr(en,'« Du » vide : depuis votre dernier supplément, ou depuis la signature. « Au » vide : jusqu’à aujourd’hui.','Empty “From”: since your last extra-work proposal, or since signature. Empty “To”: up to today.')+'</small>'+
  '<button class="btn main" type="button" data-calc-journal>'+tr(en,'⚡ Calculer depuis le suivi du projet','⚡ Calculate from project tracking')+'</button>'+
  '<p>'+tr(en,'Reprend les demandes du client réalisées depuis votre dernier supplément (ou depuis la signature s’il n’y en a pas), chiffrées dans cet ordre : le niveau noté dans le journal, sinon une prestation de votre liste dont les mots figurent dans la demande, sinon votre prix par défaut. Vérifiez chaque ligne : retirez ce qui était prévu au devis ou ce qui venait de vous, et tapez votre prix si besoin (« Prix libre »).','Takes the client requests completed since your last extra-work proposal (or since signature if there is none), priced in this order: the level noted in the journal, else an item of your list whose words appear in the request, else your default price. Check every line: remove what the quote already covered or what was your own idea, and type your own price if needed (“Free price”).')+'</p>'+
  '<div data-calc-summary class="dzoft-calc-summary" hidden></div></div>')+
  '<div class="dzoft-calc-pick"><label>'+tr(en,'Ajouter depuis ma liste de prix','Add from my price list')+'<select name="block"><option value="">'+(blocks.length?tr(en,'— Choisir —','— Choose —'):tr(en,'Liste vide : ajoutez une ligne libre','Empty list: add a free line'))+'</option>'+
  blocks.map(function(b,i){return '<option value="'+i+'">'+esc(b.label)+' · '+cash(b.price)+'</option>';}).join('')+'</select></label>'+
  '<button class="btn line sm" type="button" data-calc-add-block>'+tr(en,'Ajouter','Add')+'</button>'+
  '<button class="btn line sm" type="button" data-calc-add-line>'+tr(en,'＋ Ligne libre','＋ Free line')+'</button>'+
  '<button class="btn line sm" type="button" data-calc-discount>'+tr(en,'－ Remise commerciale','－ Commercial discount')+'</button></div>'+
  '<div class="dzoft-change-table"><table><thead><tr><th>'+tr(en,'Prestation','Item')+'</th><th>'+tr(en,'Qté','Qty')+'</th><th>'+tr(en,'Prix unitaire','Unit price')+'</th><th>'+tr(en,'Total','Total')+'</th><th><span class="sr-only">'+tr(en,'Retirer','Remove')+'</span></th></tr></thead>'+
  '<tbody data-calc-lines>'+rows+'</tbody><tfoot><tr><th colspan="3">'+tr(en,'Total du complément','Extra total')+'</th><th data-calc-total>'+cash(0)+'</th><th></th></tr></tfoot></table></div>'+
  // Cancel on an edited draft puts its saved lines back (nothing was sent to the server).
  (edit?'<template data-calc-original>'+rows+'</template>':'')+
  '<label>'+tr(en,'Conséquence sur le délai','Schedule impact')+'<input name="timeline" maxlength="600" value="'+esc(edit?r.timeline_impact||'':'')+'" placeholder=""'+tr(en,'Ex. : aucun changement ; + 3 jours','E.g. no change; +3 days')+'"></label>'+
  '<label class="dzoft-change-check"><input type="checkbox" name="done"'+(edit&&r.already_done?' checked':'')+'><span>'+tr(en,'Travaux déjà réalisés : après la signature, ils pourront être facturés directement.','Work already done: once signed, it can be invoiced directly.')+'</span></label>'+
  '<label class="dzoft-change-check"><input type="checkbox" name="keep"'+(edit?'':' checked')+'><span>'+tr(en,'Ajouter les nouvelles lignes à ma liste de prix','Add new lines to my price list')+'</span></label>'+
  '<p>'+tr(en,'« Créer le brouillon » : vous seul le voyez. Relisez, envoyez votre explication depuis Outlook ou WhatsApp, puis confirmez le partage manuel : le client pourra consulter et signer la proposition. Rien n’est dû sans son accord.','“Create draft”: only you can see it. Review, send your explanation from Outlook or WhatsApp, then confirm manual sharing so the client can review and sign. Nothing is owed without approval.')+'</p>'+
  '<div class="dzoft-change-actions"><button class="btn main" type="submit">'+(edit?tr(en,'Enregistrer le brouillon modifié','Save the edited draft'):target?tr(en,'Chiffrer cette demande','Price this request'):tr(en,'Créer le brouillon','Create the draft'))+'</button><button class="btn line" type="button" data-form-cancel="calc">'+tr(en,'Annuler','Cancel')+'</button></div></form>';
}
function priceList(en,blocks,defaultPrice,tiers){
 var scopes=[
  {key:'extra',fr:'Toujours en supplément',en:'Always extra'},
  {key:'pwa',fr:'Inclus dans PWA',en:'Included in PWA'},
  {key:'mobile',fr:'Inclus dans application mobile',en:'Included in mobile app'},
  {key:'both',fr:'Inclus dans PWA et mobile',en:'Included in PWA & mobile'}
 ];
 function scopeOptions(value){return scopes.map(function(x){return '<option value="'+x.key+'"'+((value||'extra')===x.key?' selected':'')+'>'+esc(tr(en,x.fr,x.en))+'</option>';}).join('');}
 return '<div class="dzoft-price-list">'+
  '<h4>'+tr(en,'Niveaux de prix','Price levels')+'</h4><p class="dzoft-change-note">'+tr(en,'Chaque ligne affiche au client son niveau et sa règle. Prix proposés en proportion de votre premier devis signé : modifiez-les librement.','Each line shows the client its level and rule. Default prices are proportional to your first signed quote: change them freely.')+'</p>'+
  '<div class="dzoft-change-table"><table><thead><tr><th>'+tr(en,'Niveau','Level')+'</th><th>'+tr(en,'Règle montrée au client','Rule shown to the client')+'</th><th>'+tr(en,'Prix','Price')+'</th></tr></thead><tbody>'+
  tiers.map(function(t,i){return '<tr><td>'+esc(t.label)+'</td><td>'+esc(t.rule)+'</td><td><input type="number" min="0" max="1000000" step="0.01" value="'+esc(t.price)+'" data-tier-price="'+i+'" aria-label="'+tr(en,'Prix du niveau ','Price of level ')+esc(t.label)+'"></td></tr>';}).join('')+
  '</tbody></table></div><button class="btn line sm" type="button" data-tier-save>'+tr(en,'Enregistrer les niveaux','Save levels')+'</button>'+
  '<h4>'+tr(en,'Prestations connues','Known items')+'</h4>'+
  '<p class="dzoft-change-note">'+tr(en,'Les mots-clés permettent de repérer une demande. Le forfait indique quand la prestation est déjà incluse au devis initial ; il ne change pas le calcul des suppléments après signature.','Matching words detect a request. Package scope marks work already included in an initial quote; it never changes pricing for approved supplements.')+'</p>'+
  '<div class="dzoft-calc-pick"><label>'+tr(en,'Prix par défaut d’une demande absente de la liste (€)','Default price of a request not in the list (€)')+
  '<input type="number" min="0" max="1000000" step="0.01" data-default-price value="'+esc(defaultPrice==null?'':defaultPrice)+'" placeholder="'+tr(en,'Vide : à chiffrer à la main','Empty: priced by hand')+'"></label>'+
  '<button class="btn line sm" type="button" data-default-save>'+tr(en,'Enregistrer','Save')+'</button></div>'+
  (blocks.length?'<div class="dzoft-change-table"><table><thead><tr><th>'+tr(en,'Prestation','Item')+'</th><th>'+tr(en,'Prix','Price')+'</th><th>'+tr(en,'Description','Description')+'</th><th>'+tr(en,'Forfait','Package')+'</th><th>'+tr(en,'Mots repérés','Matching words')+'</th><th><span class="sr-only">'+tr(en,'Retirer','Remove')+'</span></th></tr></thead><tbody>'+
   blocks.map(function(b,i){return '<tr><td>'+esc(b.label)+'</td><td><input type="number" min="0" max="1000000" step="0.01" value="'+esc(b.price)+'" data-block-price="'+i+'" aria-label="'+tr(en,'Prix de ','Price of ')+esc(b.label)+'"></td>'+
    '<td><input maxlength="400" value="'+esc(b.description||'')+'" data-block-description="'+i+'" aria-label="'+tr(en,'Description de ','Description of ')+esc(b.label)+'"></td>'+
    '<td><select data-block-scope="'+i+'" aria-label="'+tr(en,'Forfait de ','Package for ')+esc(b.label)+'">'+scopeOptions(b.scope)+'</select></td>'+
    '<td><input maxlength="200" value="'+esc((Array.isArray(b.words)?b.words:[]).join(', '))+'" data-block-words="'+i+'" aria-label="'+tr(en,'Mots repérés pour ','Matching words for ')+esc(b.label)+'"></td>'+
    '<td><button class="btn line sm" type="button" data-block-remove="'+i+'" aria-label="'+tr(en,'Retirer ','Remove ')+esc(b.label)+'">×</button></td></tr>';}).join('')+'</tbody></table></div>'+
   '<button class="btn line sm" type="button" data-block-save>'+tr(en,'Enregistrer la liste','Save the list')+'</button>'
  :'<p>'+tr(en,'Votre liste est vide : ajoutez une prestation ci-dessous.','Your list is empty: add an item below.')+'</p>')+
  '<fieldset class="dzoft-block-new"><legend>'+tr(en,'Ajouter une prestation','Add a service')+'</legend>'+
  '<label>'+tr(en,'Nom','Name')+'<input data-new-block-label maxlength="140" placeholder="'+tr(en,'Ex. : Galerie photo','E.g. Photo gallery')+'"></label>'+
  '<label>'+tr(en,'Prix (€)','Price (€)')+'<input data-new-block-price inputmode="decimal" placeholder="100,00"></label>'+
  '<label>'+tr(en,'Inclus dans','Included in')+'<select data-new-block-scope>'+scopeOptions('extra')+'</select></label>'+
  '<label>'+tr(en,'Description','Description')+'<input data-new-block-description maxlength="400" placeholder="'+tr(en,'Ce qui sera réalisé','What will be delivered')+'"></label>'+
  '<label>'+tr(en,'Mots-clés (séparés par une virgule)','Matching words (comma separated)')+'<input data-new-block-words maxlength="200" placeholder="'+tr(en,'galerie, photos','gallery, photos')+'"></label>'+
  '<button type="button" class="btn main" data-block-add>'+tr(en,'Ajouter à mon catalogue','Add to my catalogue')+'</button></fieldset></div>';
}

function adminCard(r,en,invoice,blocks,tiers){
 // A proposal is a draft, seen only by the owner, until explicit manual-share acknowledgement (server enforced).
 var draft=r.status==='proposed'&&!r.sent_at,status=draft?tr(en,'Brouillon · visible par vous seul','Draft · only you can see it'):(r.status==='proposed'&&r.sent_at?tr(en,'Partagée · signature attendue','Shared · awaiting signature'):(labels(en)[r.status]||r.status));
 var h='<article class="dzoft-change-item'+(draft?' dzoft-change-draft':'')+'" data-change-card="'+esc(r.id)+'"><header><b>'+esc(r.title)+(r.proposal_number?' · '+esc(r.proposal_number):'')+'</b><span class="dzoft-change-status">'+esc(status)+'</span></header>'+
 (r.description&&r.description!=='Proposition établie par DZOFT.'?'<p>'+esc(r.description)+'</p>':'')+
 '<p class="dzoft-change-meta">'+tr(en,'Créée le ','Created on ')+esc(when(r.created_at))+'</p>'+proposalBlock(r,en);
 if(r.status==='proposed'){
  h+='<div class="dzoft-change-actions"><button class="btn main sm" type="button" data-change-send="'+esc(r.id)+'">'+(r.sent_at?tr(en,'Préparer une explication dans Outlook / WhatsApp','Prepare an explanation in Outlook / WhatsApp'):tr(en,'Relire et préparer mon message','Review and prepare my message'))+'</button></div>'+
   (r.sent_at?'<p class="dzoft-change-meta">'+tr(en,'Partagée le ','Shared on ')+esc(when(r.sent_at))+tr(en,'. Signature non encore enregistrée. L’ouverture d’un brouillon n’envoie rien.','. Signature not yet recorded. Opening a draft does not send anything.')+'</p>':
   '<p class="dzoft-change-meta dzoft-change-draft-note">'+tr(en,'Brouillon privé : relisez le supplément, envoyez votre explication depuis Outlook ou WhatsApp, puis confirmez séparément le partage manuel. Aucun e-mail automatique.','Private draft: review the proposal, send your explanation from Outlook or WhatsApp, then confirm manual sharing separately. No automatic email.')+'</p>');
 }
 if(r.status==='requested')h+='<details class="dzoft-change-new"><summary>'+tr(en,'Chiffrer cette demande','Price this request')+'</summary>'+calculator(en,blocks,r,tiers)+'</details>';
 // An unsent draft can be changed in place (lines, prices, discount): the server keeps its number and it stays a draft.
 if(draft)h+='<details class="dzoft-change-new dzoft-change-edit"><summary>'+tr(en,'✎ Modifier ce brouillon','✎ Edit this draft')+'</summary>'+calculator(en,blocks,r,tiers,true)+'</details>';
 if(r.status==='requested'||r.status==='proposed'){
  h+='<form data-change-reject="'+esc(r.id)+'" class="dzoft-change-form dzoft-change-reject"><label>'+tr(en,'Motif si la proposition est retirée ou la demande non retenue','Reason if withdrawn or declined')+
   '<input name="reason" minlength="5" maxlength="600" placeholder="'+tr(en,'Ex. : remplacée par une nouvelle proposition','E.g. replaced by a new proposal')+'" required></label>'+
   '<button class="btn line sm" type="submit">'+tr(en,'Retirer / refuser','Withdraw / reject')+'</button><button class="btn ghost sm" type="button" data-form-cancel>'+tr(en,'Annuler','Cancel')+'</button></form>';
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
/* Professionally formatted proposal explanation. Source of truth is the saved
 * proposal lines; zero-price gifts and negative discounts stay separate.
 * No example client amounts or descriptions are hard-coded into this template.
 */
function proposalExplanation(proposal,opt,portal,en){
 var all=Array.isArray(proposal.lines)?proposal.lines:[];
 var groups=[
  {fr:'Interface et présentation',en:'Interface and presentation',items:[]},
  {fr:'Fonctionnalités et expérience utilisateur',en:'Features and user experience',items:[]},
  {fr:'Administration et suivi',en:'Administration and tracking',items:[]},
  {fr:'Autres prestations',en:'Other services',items:[]}
 ];
 function category(label){
  var t=String(label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/logo|onglet|titre|mise en page|affich|photo|visuel|liste du lieu|couleur|design|interface graphique/.test(t))return groups[0];
  if(/compte|connex|portail|tutoi|vouvoi|pass|validation|face id|empreinte|qr code|duree|evenement|etablissement|visite|authentif/.test(t))return groups[1];
  if(/administr|menu admin|fiche|retour|tableau de bord|suivi/.test(t))return groups[2];
  return groups[3];
 }
 function money(v){return Number(v).toLocaleString(en?'en-GB':'fr-FR',{style:'currency',currency:'EUR'});}
 function rowAmount(l){
  var qty=Number(l.qty),price=Number(l.price);
  return Number.isFinite(qty)&&Number.isFinite(price)?Math.round(qty*price*100):null;
 }
 var gifts=[],discounts=[],subtotal=0,hasUnpriced=false;
 all.forEach(function(l){
  if(!l)return;
  var amount=rowAmount(l),name=String(l.label||'').trim();
  if(!name)return;
  if(amount===null){hasUnpriced=true;category(name).items.push('• '+name+' — '+(en?'price not specified':'prix non précisé'));return;}
  var desc='• '+name+(Number(l.qty)!==1?' (× '+String(l.qty)+')':'');
  if(amount<0){discounts.push({name:name,amount:amount});return;}
  if(amount===0){gifts.push(desc);return;}
  subtotal+=amount;
  category(name).items.push(desc+' : '+money(amount/100));
 });
 var first=String(opt.clientName||'').trim().split(/\s+/)[0]||'';
 var greeting=en?'Hello'+(first?' '+first:'')+',':'Bonjour'+(first?' '+first:'')+',';
 var result=[greeting,'',en?'I hope you are doing well.':'J’espère que vous allez bien.','',
  en?'Following the approval of our original quote '+String(opt.quoteNumber||'')+
  ', you requested additional changes and improvements. To keep our agreement clear, these items are priced separately from the initial contract.':
  'À la suite de la validation de notre devis initial '+String(opt.quoteNumber||'')+
  ', plusieurs modifications et améliorations ont été demandées. Afin de conserver une parfaite transparence, je vous présente une proposition complémentaire, distincte de notre accord initial.','',
  en?'1. ADDITIONAL WORK':'1. PRESTATIONS COMPLÉMENTAIRES',''];
 groups.forEach(function(group){
  if(!group.items.length)return;
  result.push((en?group.en:group.fr).toUpperCase());
  group.items.forEach(function(line){result.push(line);});
  result.push('');
 });
 if(gifts.length){
  result.push(en?'2. SERVICES INCLUDED AT NO CHARGE':'2. PRESTATIONS OFFERTES','');
  gifts.forEach(function(line){result.push(line+' — '+(en?'Included':'Offert'));});
  result.push('');
 }
 var total=Number(proposal.extra_price),validTotal=Number.isFinite(total);
 var discountsTotal=discounts.reduce(function(sum,l){return sum+l.amount;},0);
 result.push(en?'3. FINANCIAL SUMMARY':'3. RÉCAPITULATIF FINANCIER','');
 if(!hasUnpriced)result.push((en?'Additional work before discount: ':'Total des prestations complémentaires : ')+money(subtotal/100));
 discounts.forEach(function(d){result.push(d.name+' : '+money(d.amount/100));});
 // If individual rows disagree with the server-calculated total, do not silently
 // present a misleading reconciliation: clearly flag it for owner review.
 if(validTotal){
  result.push((en?'TOTAL PROPOSED: ':'MONTANT TOTAL PROPOSÉ : ')+money(total));
  if(!hasUnpriced&&Math.abs((subtotal+discountsTotal)-Math.round(total*100))>1)
   result.push(en?'IMPORTANT: The line totals differ from the recorded proposal total. Please verify before sending.':
    'ATTENTION : le total des lignes diffère du montant de la proposition enregistrée. Vérifiez avant tout envoi.');
 }else result.push(en?'Total to be confirmed in the proposal':'Montant total à vérifier dans la proposition');
 result.push('',en?'4. YOUR AGREEMENT':'4. VOTRE ACCORD','',
  en?'The initial quote and payments already received remain unchanged. Only the additional work listed above is concerned.':
  'Le montant du devis initial ainsi que les paiements déjà effectués restent inchangés. Cette proposition concerne uniquement les prestations complémentaires détaillées ci-dessus.','',
  en?'You can review the proposal in your client area:':'Vous pouvez consulter la proposition dans votre espace client :',portal,'',
  en?'No supplementary invoice will be issued without your prior agreement and signature.':
  'Aucune facture complémentaire ne sera émise sans votre accord préalable et votre signature.','',
  en?'Please feel free to contact me if you would like to discuss any of these items. Thank you for your trust.':
  'Je reste naturellement disponible pour échanger sur ces éléments et répondre à vos questions. Je vous remercie pour votre confiance.','',
  en?'Kind regards,':'Bien cordialement,','Roland','DZOFT — Développement web & solutions digitales');
 return result.join('\n');
}
function bindOwner(root,options){
 var sb=options.sb,quoteId=options.quoteId,en=!!options.en,busy=false;
 // The project page calls this after every reload: keep one set of listeners, refresh the options.
 root.__dzoftOwnerOptions=options;
 if(root.__dzoftOwnerRefresh&&root.__dzoftOwnerQuote===quoteId)return root.__dzoftOwnerRefresh();
 function invoiceOf(r){var list=(root.__dzoftOwnerOptions||{}).invoices||[];for(var i=0;i<list.length;i++)if(list[i]&&list[i].change===r.id)return list[i];return null;}
 root.innerHTML=rootMarkup(en);var records=[],blocks=[],defaultPrice=null,tiers=[];
 function loadBlocks(){return Promise.resolve(sb.select('settings','select=price_blocks,default_line_price,price_tiers&id=eq.1')).then(function(rows){var row=rows&&rows[0]||{},b=row.price_blocks;blocks=Array.isArray(b)?b.filter(function(x){return x&&x.label;}):[];defaultPrice=row.default_line_price==null?null:Number(row.default_line_price);
  tiers=Array.isArray(row.price_tiers)?row.price_tiers.filter(function(t){return t&&t.key&&t.label;}).map(function(t){return {key:String(t.key),label:String(t.label),rule:String(t.rule||''),price:Number(t.price)||0};}):[];root.__dzoftTiers=tiers;}).catch(function(){blocks=[];tiers=[];});}
 function tierOf(key){for(var i=0;i<tiers.length;i++)if(tiers[i].key===key)return tiers[i];return null;}
 function saveBlocks(next){return Promise.resolve(sb.update('settings',1,{price_blocks:next.slice(0,200)})).then(function(){blocks=next.slice(0,200);});}
 function refresh(){return Promise.all([sb.rpc('owner_list_change_requests',{p_quote:quoteId},true),loadBlocks()]).then(function(res){records=Array.isArray(res[0])?res[0]:[];
  var keepOpen=root.querySelector('.dzoft-change-new[data-new-proposal]');keepOpen=keepOpen&&keepOpen.open;
  root.querySelector('.dzoft-change-content').innerHTML=
  '<p class="dzoft-change-help">'+tr(en,'Une demande n’est pas une commande. Chiffrez les travaux, relisez et expliquez-les depuis Outlook ou WhatsApp. Après votre envoi manuel, confirmez le partage pour permettre la signature du client avant toute facturation.','A request is not an order. Price the work and explain it using Outlook or WhatsApp. After sending manually, confirm sharing to enable client signature before any invoicing.')+'</p>'+
  '<details class="dzoft-change-new" data-new-proposal'+(keepOpen?' open':'')+'><summary>'+tr(en,'＋ Proposer un complément chiffré','＋ Propose priced additional work')+'</summary>'+calculator(en,blocks,null,tiers)+'</details>'+
  '<p class="dzoft-change-note dzoft-price-link">'+tr(en,'Ma liste de prix ('+blocks.length+' prestation(s), '+tiers.length+' niveau(x)) se gère dans ','My price list ('+blocks.length+' item(s), '+tiers.length+' level(s)) is managed in ')+'<a href="./#/catalogue">'+tr(en,'Catalogue (Prestations)','Service catalogue')+'</a>.</p>'+
  (records.length?records.map(function(r){return adminCard(r,en,invoiceOf(r),blocks,tiers);}).join(''):'<p>'+tr(en,'Aucune demande pour ce projet.','No change requests for this project.')+'</p>');
  root.querySelectorAll('form[data-change-offer]').forEach(recalc);
 }).catch(function(err){banner(root,stateError(err,en),true);});}
 function perform(p,msg){if(busy)return;busy=true;root.__dzoftChangeBusy=true;return p.then(function(){banner(root,msg||tr(en,'Décision enregistrée.','Decision recorded.'),false);return refresh();}).catch(function(err){banner(root,stateError(err,en),true);}).finally(function(){busy=false;root.__dzoftChangeBusy=false;});}
 function readLines(form){return Array.prototype.map.call(form.querySelectorAll('[data-line]'),function(row){var disc=row.hasAttribute('data-discount'),p=amount(row.querySelector('[name=price]').value),pc=disc?amount((row.querySelector('[name=pct]')||{}).value):NaN,lb=row.querySelector('[name=label]').value.trim();
   // The client sees the euro amount; the label says the percentage, e.g. « Remise commerciale (10 %) ».
   // The base label is shortened so the label with its percentage stays within the server's 160 characters.
   var fx=disc?fixedCents(row):NaN;
   if(disc&&Number.isFinite(fx))return {label:lb,qty:1,price:-fx/100,source:row.querySelector('[name=source]').value,detail:row.querySelector('[name=detail]').value,level:''};
   if(disc&&Number.isFinite(pc)){var suf=' ('+String(pc).replace('.',',')+' %)';lb=lb.replace(/\s*\(\d+(?:[.,]\d{1,2})?\s*%\)\s*$/,'').slice(0,160-suf.length).trim()+suf;}
   if(disc&&!(pc>0&&pc<100))p=NaN;
   return {label:lb,qty:disc?1:amount(row.querySelector('[name=qty]').value),price:disc&&Number.isFinite(p)?-Math.abs(p):(p<0?NaN:p),source:row.querySelector('[name=source]').value,detail:row.querySelector('[name=detail]').value,level:(row.querySelector('[name=level]')||{}).value||''};});}
 /* « Calculer depuis le suivi » : the client requests completed since signature, from the private journal.
    A request is billed once: its origin is kept on the line and skipped if already in a live proposal. */
 function hash(t){var h=2166136261;for(var i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(36);}
 function fromJournal(form,btn){
  if(busy)return;busy=true;root.__dzoftChangeBusy=true;btn.disabled=true;
  Promise.all([sb.select('quotes','select=journal,accepted_at,client_id&id=eq.'+encodeURIComponent(quoteId)),
   Promise.resolve(sb.rpc('list_project_work_items',{p_quote:quoteId},true)).catch(function(){return [];})]).then(function(res){
   var q=res[0]&&res[0][0]||{};
   // The client's name is removed from the start of journal lines ("<prénom> … : notifications…").
   return (q.client_id?Promise.resolve(sb.select('clients','select=nom&id=eq.'+encodeURIComponent(q.client_id))).catch(function(){return [];}):Promise.resolve([])).then(function(c){q.clientName=c&&c[0]&&c[0].nom||'';return [q,res[1]];});
  }).then(function(res){
   var q=res[0],work=Array.isArray(res[1])?res[1]:[],signed=String(q.accepted_at||'').slice(0,10),since=signed;
   var used={},holder={},lastDay='';records.forEach(function(r){if(['declined','rejected','withdrawn'].indexOf(r.status)<0){
     // Which proposal already holds a journal line (named in the summary, so a forgotten draft is easy to find).
     var name=(r.proposal_number||r.title||tr(en,'proposition','proposal'))+(r.status==='proposed'&&!r.sent_at?tr(en,' (brouillon non envoyé du ',' (unsent draft of ')+String(r.proposed_at||r.created_at||'').slice(0,10).split('-').reverse().join('/')+')':'');
     (r.lines||[]).forEach(function(l){if(l.source){used[l.source]=1;holder[l.source]=name;}});
     // Only priced extra work moves the start (a client's unpriced request does not), dated when it was proposed.
     if(['proposed','approved','in_progress','completed'].indexOf(r.status)>=0){var c=String(r.proposed_at||r.created_at||'').slice(0,10);if(c>lastDay)lastDay=c;}}});
   /* Only what is new (17 Nov 2026): requests done since the last extra-work proposal still open or signed (or since
      the signature when there is none). Proposals made before the calculator, or typed by hand, carry no link to the
      journal: without this, their requests would come back every time. Older requests are listed apart, never added. */
   if(lastDay>since)since=lastDay;
   // A date chosen by the owner replaces the automatic start (never before the signature).
   var chosen=form.elements.since&&/^\d{4}-\d{2}-\d{2}$/.test(form.elements.since.value)?form.elements.since.value:'';
   if(chosen)since=signed&&chosen<signed?signed:chosen;
   // Optional end date (18 Nov 2026): only requests done up to that day; empty = up to today.
   var until=form.elements.until&&/^\d{4}-\d{2}-\d{2}$/.test(form.elements.until.value)?form.elements.until.value:'';
   // Empty « Au » means today (local date): a journal line dated in the future is never added.
   var today=new Date(),upto=until||(today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0'));
   if(until&&since&&until<since){var bad=form.querySelector('[data-calc-summary]');bad.hidden=false;bad.innerHTML='<p class="dzoft-calc-warn">'+tr(en,'La date « Au » est avant la date « Du ». Corrigez les dates puis recalculez.','The “To” date is before the “From” date. Fix the dates, then calculate again.')+'</p>';return;}
   // Calculating again with a later start: lines imported earlier from the journal and now before the start are removed
   // (lines typed by hand have no journal origin and stay).
   Array.prototype.forEach.call(form.querySelectorAll('[data-line]'),function(row){var src=(row.querySelector('[name=source]')||{}).value||'',m=/^journal:(\d{4}-\d{2}-\d{2}):/.exec(src);
     if(m&&((since&&m[1]<since)||m[1]>upto)){if(form.querySelectorAll('[data-line]').length>1)row.remove();else row.querySelectorAll('input').forEach(function(x){x.value=x.name==='qty'?'1':'';});}});
   recalc(form);
   readLines(form).forEach(function(l){if(l.source)used[l.source]=1;});
   var clientName=plain(q.clientName||'').split(/\s+/)[0];
   var added=0,priced=0,skipped=0,offered=0,byLevel=0,byList=0,byDefault=0,later=[],included=[],earlier=[],after=[],holders={};
   (Array.isArray(q.journal)?q.journal:[]).filter(function(e){
     if(!(e&&e.k==='demande'&&/^\d{4}-\d{2}-\d{2}$/.test(e.d||'')&&(!signed||e.d>=signed)))return false;
     if(since&&e.d<since){var t=String(e.t||'').trim();if(/:\s*fait\b/i.test(t)&&!/^pas encore/i.test(t))earlier.push(t.replace(/\s*:\s*fait\b.*$/i,'').trim()+' ('+e.d.split('-').reverse().join('/')+')');return false;}
     if(e.d>upto){var u=String(e.t||'').trim();if(/:\s*fait\b/i.test(u)&&!/^pas encore/i.test(u))after.push(u.replace(/\s*:\s*fait\b.*$/i,'').trim()+' ('+e.d.split('-').reverse().join('/')+')');return false;}
     return true;})
    .sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0;}).forEach(function(e){
     var text=String(e.t||'').trim(),done=/:\s*fait\b/i.test(text)&&!/^pas encore/i.test(text);
     // Drop "<client name> : " at the start and ": fait…" at the end.
     var label=text.replace(/\s*:\s*fait\b.*$/i,'').trim();
     var head=label.indexOf(' : ');if(head>0&&head<46&&clientName&&plain(label.slice(0,head)).indexOf(clientName)>=0)label=label.slice(head+3).trim();
     label=label.replace(/^pas encore construit\s*:\s*/i,'');
     label=label.charAt(0).toUpperCase()+label.slice(1);if(label.length>160)label=label.slice(0,157)+'…';
     if(!done){later.push(label);return;}
     var source='journal:'+e.d+':'+hash(e.d+'|'+text).slice(0,16);
     if(used[source]){skipped++;if(holder[source])holders[holder[source]]=(holders[holder[source]]||0)+1;return;}
     // The level recorded in the journal decides: "inclus" (already in the quote, or a correction) is never billed.
     if(e.lvl==='inclus'){included.push(label+(e.why?' — '+e.why:''));return;}
     used[source]=1;
     var day=new Date(e.d+'T12:00:00').toLocaleDateString(en?'en-GB':'fr-FR',{day:'numeric',month:'long',year:'numeric'});
     var when=tr(en,'réalisé le ','done on ')+day,tier=tierOf(e.lvl),price=null,level='',origin='';
     // Where the price comes from, in this order: the level noted in the journal, a known item
     // of the price list whose words appear in the request, the default price, else nothing.
     if(tier){price=tier.price;level=tier.key;origin=tr(en,'Prix : niveau « ','Price: level “')+tier.label+tr(en,' » noté dans le journal (',"” noted in the journal (")+cash(tier.price)+').';byLevel++;}
     else{var t=plain(text),best=null,score=0,bestWords=[];
      blocks.forEach(function(bl){var ws=(bl.words&&bl.words.length?bl.words:words(bl.label)).map(plain),hits=ws.filter(function(w){return w&&t.indexOf(w)>=0;});if(hits.length>score){score=hits.length;best=bl;bestWords=hits;}});
      if(best){price=best.price;byList++;origin=tr(en,'Prix : « ','Price: “')+best.label+tr(en,' » de votre liste (','” from your list (')+cash(best.price)+tr(en,'), car la demande contient « ','), because the request contains “')+bestWords.join(', ')+tr(en,' ». À vérifier.','”. Please check.');}
      else if(defaultPrice!=null){price=defaultPrice;byDefault++;origin=tr(en,'Prix par défaut (','Default price (')+cash(defaultPrice)+tr(en,') : aucun niveau noté, aucune prestation reconnue. À vérifier.','): no level noted, no known item found. Please check.');}
      else origin=tr(en,'Aucun prix trouvé : choisissez un niveau ou tapez un prix.','No price found: pick a level or type a price.');}
     if(price!=null)priced++;if(tier&&tier.key==='offert')offered++;
     var qty=Number(e.qty)>0&&Number(e.qty)<=1000?Number(e.qty):1;
     addLine(form,{label:label.length>=2?label:tr(en,'Demande du ','Request of ')+day,qty:qty,price:price,source:source,level:level,when:when,origin:origin,detail:tier?tierDetail(tier,when):tr(en,'Demandé et ','Requested and ')+when});added++;
   });
   var days={};work.forEach(function(w){if(w.source_date&&(!signed||w.source_date>=signed))days[w.source_date]=1;});
   var box=form.querySelector('[data-calc-summary]');box.hidden=false;
   box.innerHTML='<p><strong>'+added+' '+tr(en,'demande(s) réalisée(s) ajoutée(s)','completed request(s) added')+'</strong>'+
    (added?' · '+priced+' '+tr(en,'chiffrée(s)','priced')+(added-priced?' · <span class="dzoft-calc-warn">'+(added-priced)+' '+tr(en,'à chiffrer (prix vide)','to price (empty price)')+'</span>':''):'')+
    (offered?' · '+offered+' '+tr(en,'offerte(s)','offered'):'')+(skipped?' · '+skipped+' '+tr(en,'déjà dans une proposition','already in a proposal'):'')+'</p>'+
    (priced?'<p>'+tr(en,'Origine des prix : ','Where prices come from: ')+[byLevel?byLevel+' '+tr(en,'par le niveau noté dans le journal','from the level noted in the journal'):'',byList?byList+' '+tr(en,'par votre liste de prix','from your price list'):'',byDefault?byDefault+' '+tr(en,'par le prix par défaut','from the default price'):''].filter(Boolean).join(' · ')+tr(en,'. Le détail est sous chaque ligne (visible par vous seul).','. Details under each line (only you see them).')+'</p>':'')+
    (included.length?'<details><summary>'+included.length+' '+tr(en,'demande(s) incluse(s) au devis ou corrections, non facturée(s)','request(s) included in the quote or fixes, not billed')+'</summary><ul>'+included.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></details>':'')+
    (Object.keys(holders).length?'<details><summary>'+skipped+' '+tr(en,'demande(s) déjà dans une autre proposition, non reprise(s)','request(s) already in another proposal, not added')+'</summary><ul>'+Object.keys(holders).map(function(h){return '<li>'+esc(h)+' : '+holders[h]+'</li>';}).join('')+'</ul><p>'+tr(en,'Pour les reprendre ici, modifiez ou refusez d’abord cette proposition.','To add them here, first edit or reject that proposal.')+'</p></details>':'')+
    (chosen||until?'<p>'+(chosen?tr(en,'Du ','From ')+since.split('-').reverse().join('/'):tr(en,'Depuis le ','Since ')+since.split('-').reverse().join('/'))+(until?tr(en,' au ',' to ')+until.split('-').reverse().join('/'):tr(en,' à aujourd’hui',' to today'))+tr(en,' (dates choisies).',' (chosen dates).')+'</p>':since!==signed?'<p>'+tr(en,'Depuis le dernier supplément, du ','Since the last extra-work proposal, of ')+since.split('-').reverse().join('/')+'.</p>':'')+
    (earlier.length?'<details><summary>'+earlier.length+' '+(chosen?tr(en,'demande(s) réalisée(s) avant cette date, non reprise(s)','request(s) done before this date, not added'):tr(en,'demande(s) réalisée(s) avant le dernier supplément, non reprise(s)','request(s) done before the last extra-work proposal, not added'))+'</summary><ul>'+earlier.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></details>':'')+
    '<p>'+tr(en,'Activité Git sur le projet depuis la signature : ','Git activity on the project since signature: ')+Object.keys(days).length+' '+tr(en,'jour(s) de travail.','working day(s).')+'</p>'+
    (after.length?'<details><summary>'+after.length+' '+tr(en,'demande(s) réalisée(s) après la date « Au », non reprise(s)','request(s) done after the “To” date, not added')+'</summary><ul>'+after.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></details>':'')+
    (later.length?'<details><summary>'+later.length+' '+tr(en,'demande(s) pas encore réalisée(s), non incluse(s)','request(s) not done yet, not included')+'</summary><ul>'+later.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></details>':'');
   if(!form.elements.title||!form.elements.title.value)if(form.elements.title)form.elements.title.value='Ajouts demandés depuis la signature du devis';
   form.elements.done.checked=true;
   var firstEmpty=form.querySelector('[data-unpriced]');if(firstEmpty)firstEmpty.focus();
  }).catch(function(err){banner(root,stateError(err,en),true);}).finally(function(){busy=false;root.__dzoftChangeBusy=false;btn.disabled=false;});
 }
 function recalc(form){
  var total=0,rows=form.querySelectorAll('[data-line]'),sub=0;
  // Items first: a discount is a percentage of their total, never of another discount.
  rows.forEach(function(row){if(row.hasAttribute('data-discount'))return;var q=amount(row.querySelector('[name=qty]').value),p=amount(row.querySelector('[name=price]').value);if(Number.isFinite(q)&&Number.isFinite(p))sub+=Math.round(q*p*100);});
  rows.forEach(function(row){
   var disc=row.hasAttribute('data-discount'),q=disc?1:amount(row.querySelector('[name=qty]').value),p;
   if(disc){var pi0=row.querySelector('[name=price]'),pf=row.querySelector('[name=pct]');
    // An older discount saved in euros: shown once as the matching percentage.
    if(pf&&pf.value===''&&pi0.dataset.amount&&sub>0){pf.value=String(Math.round(Number(pi0.dataset.amount)*10000/sub)/100).replace('.',',');pf.dataset.fixed=pi0.dataset.amount;pf.dataset.shown=pf.value;delete pi0.dataset.amount;}
    var pc=amount(pf?pf.value:''),fx=fixedCents(row),c=Number.isFinite(fx)?fx:pc>0&&pc<100?Math.round(sub*pc/100):NaN;
    pi0.value=Number.isFinite(c)?String(c/100):'';p=Number.isFinite(c)?-c/100:NaN;}
   else p=amount(row.querySelector('[name=price]').value);
   var t=Number.isFinite(q)&&Number.isFinite(p)?Math.round(q*p*100):0;total+=t;
   var pi=row.querySelector('[name=price]');if(pi.value!=='')pi.removeAttribute('data-unpriced');
   row.querySelector('[data-line-total]').textContent=cash(t/100);
  });
  form.querySelector('[data-calc-total]').textContent=cash(total/100);
 }
 function addLine(form,l){
  var tbody=form.querySelector('[data-calc-lines]');
  // Replace the first empty line instead of stacking empty rows.
  var empty=Array.prototype.filter.call(tbody.querySelectorAll('[data-line]'),function(row){return !row.querySelector('[name=label]').value.trim()&&!row.querySelector('[name=price]').value;})[0];
  var holder=document.createElement('tbody');holder.innerHTML=lineRow(l,en,tiers);var row=holder.firstChild;
  if(empty&&l)tbody.replaceChild(row,empty);else tbody.appendChild(row);
  recalc(form);return row;
 }
 root.addEventListener('input',function(ev){var f=ev.target.closest('form[data-change-offer]');if(!f)return;
  if(ev.target.name==='price'){var row=ev.target.closest('[data-line]'),sel=row&&row.querySelector('select[name=level]'),t=sel&&tierOf(sel.value);
   if(t&&cents(ev.target.value)!==cents(t.price)){sel.value='';var d=row.dataset.when||'';row.querySelector('[name=detail]').value=d;row.querySelector('[data-line-detail]').textContent=d;}
   var o=row&&row.querySelector('[data-line-origin]');if(o)o.remove();}
  recalc(f);});
 // Choosing a level sets the unit price and the rule shown to the client under the line.
 root.addEventListener('change',function(ev){var sel=ev.target;if(!sel.matches||!sel.matches('select[name=level]'))return;var row=sel.closest('[data-line]'),t=tierOf(sel.value);
  var d=t?tierDetail(t,row.dataset.when):(row.dataset.when||'');row.querySelector('[name=detail]').value=d;row.querySelector('[data-line-detail]').textContent=d;
  var pr=row.querySelector('[name=price]');if(t){pr.value=String(t.price).replace('.',',');}else{pr.value='';pr.setAttribute('data-unpriced','');pr.focus();}
  var o=row.querySelector('[data-line-origin]');if(o)o.remove();recalc(sel.closest('form'));});
 function openManualShare(proposal){
  if(document.getElementById('dzoft-change-manual-share'))return;
  var opt=root.__dzoftOwnerOptions||{},email=String(opt.clientEmail||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))email='';
  var number=String(opt.clientPhone||'').replace(/[\s().-]/g,'').replace(/^00/,'').replace(/^\+/,'');
  if(/^0[67]\d{8}$/.test(number))number='33'+number.slice(1);
  if(!/^[1-9]\d{7,14}$/.test(number))number='';
  var secretMode=!opt.clientUserId&&!!opt.clientPortalToken;
  var url=secretMode?(sb.PORTAL||'')+'#'+encodeURIComponent(String(opt.clientPortalToken)):
    (sb.PORTAL||'')+'?projet='+encodeURIComponent(quoteId);
  // The customer's message language is independent of the admin interface language.
  // The signed quotation for this project is in French: default to French even
  // when the owner's interface is set to English.
  var lang='fr',subject='DZOFT | Proposition complémentaire au devis '+String(opt.quoteNumber||'');
  var message=proposalExplanation(proposal,opt,url,false);
  var t=function(fr,english){return lang==='en'?english:fr;};
  var d=document.createElement('dialog');d.id='dzoft-change-manual-share';d.className='dzoft-change-manual-dialog dzoft-change-manual-v2';
  d.setAttribute('aria-labelledby','dzoft-change-dialog-title');
  d.innerHTML=
    '<header class="dzoft-share-header"><div><p class="dzoft-share-eyebrow">DZOFT · '+esc(proposal.proposal_number||'')+'</p>'+
      '<h2 id="dzoft-change-dialog-title">Préparer une explication</h2>'+
      '<p class="dzoft-share-intro">Relisez votre proposition complémentaire avant de l’ouvrir dans Outlook ou WhatsApp. Aucun envoi automatique.</p></div>'+
      '<span class="dzoft-share-badge'+(proposal.sent_at?' dzoft-share-badge-shared':'')+'">'+(proposal.sent_at?'Proposition déjà partagée':'Brouillon non envoyé')+'</span></header>' +
    '<div class="dzoft-share-topbar"><div class="dzoft-share-amount"><span>Montant proposé</span><strong>'+esc(cash(proposal.extra_price))+'</strong></div>'+
      '<label class="dzoft-share-language">Langue du client<select data-share-language aria-label="Langue du message"><option value="fr" selected>Français</option><option value="en">English</option></select></label></div>'+
    '<div class="dzoft-share-fields"><label>Destinataire e-mail<input data-share-email type="email" value="'+esc(email)+'" placeholder="client@example.com"'+(secretMode?' readonly':'')+'></label>'+
      '<label>Objet<input data-share-subject type="text" maxlength="240" value="'+esc(subject)+'"></label></div>'+
    (secretMode?'<p class="dzoft-share-security">Lien privé : le destinataire e-mail est verrouillé pour protéger l’accès au dossier du client.</p>':'')+
    '<div class="dzoft-share-compose-grid">'+
      '<section class="dzoft-share-preview-panel" aria-label="Aperçu du message"><div class="dzoft-share-panel-title"><strong>Aperçu du message</strong><span>Tel qu’il sera préparé</span></div>'+
        '<div class="dzoft-share-preview" data-share-preview role="region" aria-label="Message proposé"></div></section>'+
      '<section class="dzoft-share-editor-panel"><div class="dzoft-share-panel-title"><strong>Modifier le message</strong><span>Vous gardez le contrôle du texte</span></div>'+
        '<label class="dzoft-share-edit-label" for="dzoft-share-message">Texte modifiable</label>'+
        '<textarea data-share-body id="dzoft-share-message" rows="18" maxlength="12000"></textarea>'+
        '<p class="dzoft-share-edit-hint">Vos modifications s’affichent immédiatement dans l’aperçu.</p></section>'+
    '</div>'+
    '<div class="dzoft-share-actions"><div class="dzoft-share-channel"><strong>Ouvrir votre brouillon</strong>'+
      '<span>Vérifiez votre compte Hotmail, puis cliquez vous-même sur Envoyer.</span></div>'+
      '<div class="dzoft-share-buttons"><button type="button" class="btn main" data-share-outlook>Ouvrir dans Outlook (Hotmail)</button>'+
      '<button type="button" class="btn line" data-share-wa>Ouvrir dans WhatsApp</button></div></div>'+
    '<div class="dzoft-share-whatsapp"><label>Numéro WhatsApp du client<input data-share-phone type="tel" value="'+esc(number?'+'+number:'')+'" placeholder="+336…"></label>'+
      '<small>WhatsApp n’envoie rien avant votre confirmation dans l’application.</small></div>'+
    (!proposal.sent_at?'<div class="dzoft-change-manual-confirm"><label><input type="checkbox" data-share-checked> J’ai personnellement envoyé ce message au client.</label>'+
      '<button type="button" class="btn main" data-share-confirm disabled>Confirmer mon envoi manuel</button></div>':
      '<p class="dzoft-share-sent-note">Cette proposition est déjà visible dans l’espace client. Préparer un nouveau message ne déclenche aucun envoi automatique.</p>')+
    '<p data-share-status role="status" class="dzoft-share-status" aria-live="polite"></p>'+
    '<footer class="dzoft-share-footer"><span>Aucun envoi n’est effectué par DZOFT.</span>'+
      '<button type="button" class="btn line" data-share-close>Fermer</button></footer>';
  document.body.appendChild(d);
  var q=function(css){return d.querySelector(css);};
  function updatePreview(){
    // Render the editable plain-text message as a readable document. All
    // client-supplied service labels remain text nodes, never HTML.
    var preview=q('[data-share-preview]');
    preview.replaceChildren();
    q('[data-share-body]').value.split(/\r?\n/).forEach(function(line,index){
      var node=document.createElement('div'),trimmed=line.trim();
      node.className='dzoft-share-preview-line';
      if(!trimmed)node.classList.add('dzoft-share-preview-space');
      else if(/^\d+[.]\s+[A-ZÀ-Ÿ]/.test(trimmed))node.classList.add('dzoft-share-preview-section');
      else if(trimmed==='TOTAL PROPOSÉ :'||/^MONTANT TOTAL PROPOSÉ|^TOTAL PROPOSED/.test(trimmed))node.classList.add('dzoft-share-preview-total');
      else if(/^•|^–\s/.test(trimmed))node.classList.add('dzoft-share-preview-item');
      else if(trimmed===trimmed.toLocaleUpperCase()&&trimmed.length>7&&!/^https?:/.test(trimmed))node.classList.add('dzoft-share-preview-category');
      else if(/^https?:/.test(trimmed))node.classList.add('dzoft-share-preview-link');
      else if(index===0)node.classList.add('dzoft-share-preview-greeting');
      node.textContent=line;
      preview.appendChild(node);
    });
  }
  q('[data-share-body]').value=message;
  updatePreview();
  q('[data-share-body]').addEventListener('input',updatePreview);
  q('[data-share-language]').onchange=function(){
    var next=this.value;
    if(next===lang)return;
    // Re-generating a draft is destructive to edits; ask first if it changed.
    if(q('[data-share-body]').value!==message&&!global.confirm('Changer la langue remplacera vos modifications du texte. Continuer ?')){
      this.value=lang;return;
    }
    lang=next;
    subject=(lang==='en'?'DZOFT | Supplementary proposal for quote ':'DZOFT | Proposition complémentaire au devis ')+String(opt.quoteNumber||'');
    message=proposalExplanation(proposal,opt,url,lang==='en');
    q('[data-share-subject]').value=subject;
    q('[data-share-body]').value=message;
    updatePreview();
  };
  q('[data-share-close]').onclick=function(){d.close();};
  d.addEventListener('close',function(){d.remove();});
  q('[data-share-outlook]').onclick=function(){
    var to=q('[data-share-email]').value.trim(),title=q('[data-share-subject]').value.trim(),body=q('[data-share-body]').value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!title||!body){
      q('[data-share-status]').textContent='Vérifiez le destinataire, l’objet et le message.';return;
    }
    var compose='https://outlook.live.com/mail/0/deeplink/compose?to='+encodeURIComponent(to)+'&subject='+encodeURIComponent(title)+'&body='+encodeURIComponent(body);
    var w=global.open(compose,'_blank');if(w)w.opener=null;
    else q('[data-share-status]').textContent='Autorisez les fenêtres contextuelles pour ouvrir Outlook.';
  };
  q('[data-share-wa]').onclick=function(){
    var digits=q('[data-share-phone]').value.replace(/[\s().-]/g,'').replace(/^00/,'').replace(/^\+/,'');
    if(/^0[67]\d{8}$/.test(digits))digits='33'+digits.slice(1);
    if(!/^[1-9]\d{7,14}$/.test(digits)){
      q('[data-share-status]').textContent='Indiquez un numéro WhatsApp valide.';return;
    }
    var body=q('[data-share-body]').value.trim();if(!body)return;
    if(secretMode&&!global.confirm('Ce message contient un lien privé donnant accès au dossier. Avez-vous vérifié que ce numéro est bien celui du client ?'))return;
    var w=global.open('https://wa.me/'+digits+'?text='+encodeURIComponent(body),'_blank');
    if(w)w.opener=null;else q('[data-share-status]').textContent='Autorisez les fenêtres contextuelles pour ouvrir WhatsApp.';
  };
  if(!proposal.sent_at){
    q('[data-share-checked]').onchange=function(){q('[data-share-confirm]').disabled=!this.checked;};
    q('[data-share-confirm]').onclick=function(){
      if(!q('[data-share-checked]').checked||busy)return;
      if(!global.confirm('Avez-vous réellement envoyé ce message vous-même ? Le client pourra ensuite consulter et signer la proposition. DZOFT n’enverra pas d’e-mail.'))return;
      q('[data-share-confirm]').disabled=true;busy=true;root.__dzoftChangeBusy=true;
      sb.rpc('owner_mark_change_shared_manually',{p_request:proposal.id,p_version:proposal.proposal_version},true)
        .then(function(){
          if(d.open)d.close();
          banner(root,tr(en,'Partage manuel confirmé, sans e-mail automatique.','Manual sharing confirmed without automatic email.'),false);
          return refresh();
        }).catch(function(err){
          q('[data-share-status]').textContent=stateError(err,en);
          q('[data-share-confirm]').disabled=false;
        }).finally(function(){busy=false;root.__dzoftChangeBusy=false;});
    };
  }
  d.showModal();
 }
 root.addEventListener('click',function(ev){
  var b=ev.target.closest('button');if(!b)return;
  var form=b.closest('form[data-change-offer]');
  if(b.hasAttribute('data-calc-add-line')&&form){addLine(form,null).querySelector('[name=label]').focus();return;}
  if(b.hasAttribute('data-calc-add-block')&&form){var i=form.elements.block.value;if(i===''||!blocks[+i])return;var bl=blocks[+i];addLine(form,{label:bl.label,qty:1,price:bl.price});form.elements.block.value='';return;}
  if(b.hasAttribute('data-line-remove')&&form){var rows=form.querySelectorAll('[data-line]');if(rows.length>1)b.closest('[data-line]').remove();else{b.closest('[data-line]').querySelectorAll('input').forEach(function(x){x.value=x.name==='qty'?'1':'';});}recalc(form);return;}
  if(b.hasAttribute('data-calc-discount')&&form){/* Text sent to the client stays in French (the proposal, like the quote, is in French), whatever the admin language. */var d=addLine(form,{label:'Remise commerciale',qty:1,price:'',discount:true});d.querySelector('[name=pct]').focus();return;}
  if(b.hasAttribute('data-calc-journal')&&form){fromJournal(form,b);return;}
  if(b.hasAttribute('data-calc-detect')&&form){
   var text=plain(form.elements.request.value),present=readLines(form).map(function(l){return l.label;}),found=0;
   blocks.forEach(function(bl){var ws=(bl.words&&bl.words.length?bl.words:words(bl.label)).map(plain);if(present.indexOf(bl.label)<0&&ws.some(function(w){return w&&text.indexOf(w)>=0;})){addLine(form,{label:bl.label,qty:1,price:bl.price});found++;}});
   banner(root,found?tr(en,found+' prestation(s) repérée(s) : vérifiez-les.',found+' item(s) found: please check them.'):tr(en,'Rien de repéré dans votre liste : ajoutez des lignes libres.','Nothing found in your list: add free lines.'),!found);return;
  }
  if(busy)return;
  if(b.dataset.changeSend){
    var proposal=records.filter(function(r){return r.id===b.dataset.changeSend;})[0];
    if(proposal)openManualShare(proposal);
    return;
   }
   if(b.dataset.changeInvoice){var record=records.filter(function(r){return r.id===b.dataset.changeInvoice;})[0],issue=(root.__dzoftOwnerOptions||{}).onInvoice;if(record&&typeof issue==='function')issue(record,b);return;}
  if(b.dataset.changeProgress){var next=b.dataset.next;if(next!=='in_progress'&&next!=='completed')return;if(!global.confirm(next==='completed'?tr(en,'Confirmer que ces travaux sont terminés ? Ils pourront ensuite être facturés.','Confirm this work is complete? It can then be invoiced.'):tr(en,'Démarrer ces travaux complémentaires ?','Start this additional work?')))return;perform(sb.rpc('owner_progress_change',{p_request:b.dataset.changeProgress,p_status:next},true));return;}
 });
 root.addEventListener('submit',function(ev){var f=ev.target;if(!f.matches('[data-change-offer],[data-change-reject]'))return;ev.preventDefault();if(busy||!f.reportValidity())return;
  if(f.hasAttribute('data-change-offer')){
   recalc(f);
   if(Array.prototype.some.call(f.querySelectorAll('[data-discount] [name=pct]'),function(x){var v=amount(x.value);return !Number.isFinite(fixedCents(x.closest('[data-line]')))&&!(v>0&&v<100);})){banner(root,tr(en,'La remise est un pourcentage : tapez un nombre entre 0 et 100 (ex. 10).','The discount is a percentage: type a number between 0 and 100 (e.g. 10).'),true);return;}
   var lines=readLines(f).filter(function(l){return l.label||Number.isFinite(l.price);});
   if(!lines.length||lines.some(function(l){return l.label.length<2||!(l.qty>0)||l.qty>1000||!Number.isFinite(l.price)||Math.abs(l.price)>1000000;})){banner(root,stateError({message:'Each line needs a label, a quantity and a price'},en),true);return;}
   lines=lines.map(function(l){var o={label:l.label,qty:cents(l.qty)/100,price:cents(l.price)/100};if(l.source)o.source=l.source;if(l.detail)o.detail=l.detail;if(l.level)o.level=l.level;return o;});
   var total=lines.reduce(function(n,l){return n+Math.round(l.qty*l.price*100);},0)/100;
   if(!(total>0)){banner(root,tr(en,'Le total doit rester positif après la remise.','The total must stay positive after the discount.'),true);return;}
   if(!global.confirm(f.hasAttribute('data-edit')?tr(en,'Enregistrer ce brouillon à '+cash(total)+' ? Il reste privé jusqu’à la confirmation d’un partage manuel.','Save this draft at '+cash(total)+'? It stays private until you confirm manual sharing.'):tr(en,'Créer ce brouillon de '+cash(total)+' ? Vous seul le voyez : le client ne le voit pas avant votre confirmation d’envoi manuel.','Create this '+cash(total)+' draft? Only you can see it: the client cannot see it before you confirm manual sharing.')))return;
   var known=blocks.map(function(bl){return bl.label;}),fresh=f.elements.keep.checked?lines.filter(function(l){return l.price>0&&!l.source&&known.indexOf(l.label)<0;}).map(function(l){return {label:l.label,price:l.price,words:words(l.label).slice(0,6)};}):[];
   var call=f.dataset.for?sb.rpc('owner_price_change_request',{p_request:f.dataset.for,p_lines:lines,p_timeline:f.elements.timeline.value.trim(),p_already_done:f.elements.done.checked},true)
    :sb.rpc('owner_create_priced_proposal',{p_quote:quoteId,p_title:f.elements.title.value.trim(),p_lines:lines,p_timeline:f.elements.timeline.value.trim(),p_already_done:f.elements.done.checked},true);
   perform(call.then(function(r){return fresh.length?saveBlocks(blocks.concat(fresh)).catch(function(){}).then(function(){return r;}):r;}),
    f.hasAttribute('data-edit')?tr(en,'Brouillon modifié : relisez-le ci-dessous, puis préparez un message Outlook ou WhatsApp.','Draft updated: check it below, then prepare an Outlook or WhatsApp message.'):tr(en,'Brouillon créé : relisez-le ci-dessous, puis « Envoyer au client ».','Draft created: check it below, then “Send to client”.'));
   return;
  }
  if(f.dataset.changeReject){if(!global.confirm(tr(en,'Retirer ou refuser cette proposition ?','Withdraw or reject this proposal?')))return;perform(sb.rpc('owner_reject_change',{p_request:f.dataset.changeReject,p_reason:f.elements.reason.value.trim()},true));}
 });
 root.__dzoftOwnerRefresh=refresh;root.__dzoftOwnerQuote=quoteId;
 return refresh();
}
/* ---------------- price list (Catalogue page) ----------------
   One place for the owner's prices, shared by every project: price levels (settings.price_tiers), known items
   (settings.price_blocks) and the default price of an unknown request (settings.default_line_price).
   Projects only read them in their calculator. */
function readPriceSettings(sb){
 return Promise.resolve(sb.select('settings','select=price_blocks,default_line_price,price_tiers&id=eq.1')).then(function(rows){
  var row=rows&&rows[0]||{},b=row.price_blocks;
  return {blocks:Array.isArray(b)?b.filter(function(x){return x&&x.label;}):[],defaultPrice:row.default_line_price==null?null:Number(row.default_line_price),
   tiers:Array.isArray(row.price_tiers)?row.price_tiers.filter(function(t){return t&&t.key&&t.label;}).map(function(t){return {key:String(t.key),label:String(t.label),rule:String(t.rule||''),price:Number(t.price)||0};}):[]};
 });
}
function bindPrices(root,options){
 var sb=options.sb,en=!!options.en,busy=false,data={blocks:[],defaultPrice:null,tiers:[]};
 root.__dzoftPricesEn=en;
 if(root.__dzoftPricesBound)return root.__dzoftPricesRefresh();
 root.__dzoftPricesBound=true;
 root.innerHTML=rootMarkup(en);
 function refresh(){en=!!root.__dzoftPricesEn;return readPriceSettings(sb).then(function(d){data=d;
  root.querySelector('.dzoft-change-content').innerHTML='<h2 class="dzoft-price-title">'+tr(en,'Mes tarifs','My prices')+'</h2>'+
   '<p class="dzoft-change-help">'+tr(en,'Utilisés par le calculateur « Créer un supplément » de chaque projet. Modifier un prix ici ne change aucune proposition déjà envoyée ni aucune facture.','Used by the “Create extra work” calculator of every project. Changing a price here does not change any proposal already sent or any invoice.')+'</p>'+
   priceList(en,data.blocks,data.defaultPrice,data.tiers);
 }).catch(function(err){banner(root,stateError(err,en),true);});}
 function perform(p,msg){if(busy)return;busy=true;return p.then(function(){banner(root,msg,false);return refresh();}).catch(function(err){banner(root,stateError(err,en),true);}).finally(function(){busy=false;});}
 function saveBlocks(next){return Promise.resolve(sb.update('settings',1,{price_blocks:next.slice(0,200)}));}
 root.addEventListener('click',function(ev){
  var b=ev.target.closest('button');if(!b||busy)return;
  if(b.hasAttribute('data-tier-save')){var next=data.tiers.map(function(t,i){var inp=root.querySelector('[data-tier-price="'+i+'"]'),v=inp?num(inp.value):t.price;return {key:t.key,label:t.label,rule:t.rule,price:Number.isFinite(v)&&v>=0?Math.round(v*100)/100:t.price};});
   perform(Promise.resolve(sb.update('settings',1,{price_tiers:next})),tr(en,'Niveaux de prix enregistrés.','Price levels saved.'));return;}
  if(b.hasAttribute('data-default-save')){var v=root.querySelector('[data-default-price]').value.trim(),dp=v===''?null:Math.round(num(v)*100)/100;
   if(dp!==null&&!(dp>=0)){banner(root,tr(en,'Prix par défaut invalide.','Invalid default price.'),true);return;}
   perform(Promise.resolve(sb.update('settings',1,{default_line_price:dp})),tr(en,'Prix par défaut enregistré.','Default price saved.'));return;}
  if(b.hasAttribute('data-block-remove')){var k=+b.dataset.blockRemove,copy=data.blocks.slice();if(!global.confirm(tr(en,'Retirer « '+(copy[k]&&copy[k].label||'')+' » de la liste ?','Remove “'+(copy[k]&&copy[k].label||'')+'” from the list?')))return;copy.splice(k,1);perform(saveBlocks(copy),tr(en,'Liste de prix enregistrée.','Price list saved.'));return;}
  if(b.hasAttribute('data-block-add')){
   var name=root.querySelector('[data-new-block-label]').value.trim(),
    price=root.querySelector('[data-new-block-price]').value.trim()===''?NaN:num(root.querySelector('[data-new-block-price]').value),
    scope=root.querySelector('[data-new-block-scope]').value,
    desc=root.querySelector('[data-new-block-description]').value.trim(),
    words=root.querySelector('[data-new-block-words]').value.split(',').map(function(x){return x.trim().toLowerCase();}).filter(Boolean).slice(0,12);
   if(name.length<2||name.length>140||!Number.isFinite(price)||price<0||price>1000000||!['extra','pwa','mobile','both'].includes(scope)){
    banner(root,tr(en,'Nom, tarif ou forfait incorrect.','Invalid name, price or package.'),true);return;
   }
   if(!words.length){banner(root,tr(en,'Ajoutez au moins un mot-clé pour repérer cette prestation.','Add at least one matching word.'),true);return;}
   if(data.blocks.length>=200){banner(root,tr(en,'Catalogue limité à 200 prestations.','Catalogue limit: 200 items.'),true);return;}
   if(data.blocks.some(function(x){return String(x.label||'').trim().toLowerCase()===name.toLowerCase();})){
    banner(root,tr(en,'Une prestation porte déjà ce nom.','An item already has that name.'),true);return;
   }
   var item={label:name,price:Math.round(price*100)/100,description:desc.slice(0,400),scope:scope,words:words};
   perform(saveBlocks(data.blocks.concat([item])),tr(en,'Prestation ajoutée au Catalogue.','Item added to catalogue.'));return;
  }
  if(b.hasAttribute('data-block-save')){
   var valid=true;
   var edited=data.blocks.map(function(bl,i){
    var p=root.querySelector('[data-block-price="'+i+'"]'),
     w=root.querySelector('[data-block-words="'+i+'"]'),
     d=root.querySelector('[data-block-description="'+i+'"]'),
     sc=root.querySelector('[data-block-scope="'+i+'"]');
    var price=p?(p.value.trim()===''?NaN:num(p.value)):Number(bl.price);
    var scope=sc?sc.value:(bl.scope||'extra');
    if(!Number.isFinite(price)||price<0||price>1000000||!['extra','pwa','mobile','both'].includes(scope))valid=false;
    return Object.assign({},bl,{
     price:Math.round(price*100)/100,
     description:d?d.value.trim().slice(0,400):String(bl.description||'').slice(0,400),
     scope:scope,
     words:w?w.value.split(',').map(function(x){return x.trim().toLowerCase();}).filter(Boolean).slice(0,12):(bl.words||[])
    });
   });
   if(!valid){banner(root,tr(en,'Corrigez les prix ou les forfaits invalides.','Correct invalid prices or packages.'),true);return;}
   perform(saveBlocks(edited),tr(en,'Liste de prix enregistrée.','Price list saved.'));return;
  }
 });
 root.__dzoftPricesRefresh=refresh;
 return refresh();
}
/* Cancel buttons (18 Nov 2026): close or clear a form without sending or saving anything.
   « Plus tard » on a proposal to sign only hides the code step; the proposal stays to sign later. */
if(global.document)global.document.addEventListener('click',function(ev){
 var b=ev.target.closest&&ev.target.closest('[data-form-cancel]');if(!b)return;
 var f=b.closest('form'),d=b.closest('details'),kind=b.dataset.formCancel;if(!f)return;
 // A request or proposal may still be committing. A Cancel cannot undo that RPC.
 // Do not pretend an in-flight server action was discarded by resetting its form.
 var scope=b.closest('#dzoft-owner-changes, #dzoft-client-changes');
 if(scope&&scope.__dzoftChangeBusy)return;
 var en=document.documentElement.lang==='en';
 if(kind==='calc'&&f.hasAttribute('data-edit')){
  var orig=f.querySelector('template[data-calc-original]');
  f.reset();if(orig)f.querySelector('[data-calc-lines]').innerHTML=orig.innerHTML;
  f.dispatchEvent(new Event('input',{bubbles:true}));
 }else if(kind==='calc'){
  var rows=f.querySelectorAll('[data-calc-lines] [data-line]'),filled=Array.prototype.some.call(rows,function(r){return (r.querySelector('[name=label]')||{}).value;});
  if(filled&&!global.confirm(tr(en,'Effacer ce calcul ? Rien n’a été enregistré.','Clear this calculation? Nothing was saved.')))return;
  // Reset first (it restores pre-filled lines), then empty the kept row, defaults included, so nothing comes back.
  // A fresh blank line replaces them all: no note, origin, period or discount kept from a removed line.
  f.reset();
  var owner=b.closest('#dzoft-owner-changes'),fresh=document.createElement('tbody');fresh.innerHTML=lineRow({},en,owner&&owner.__dzoftTiers||[]);
  Array.prototype.forEach.call(rows,function(r,i){if(i)r.remove();else r.parentNode.replaceChild(fresh.firstChild,r);});
  var sum=f.querySelector('[data-calc-summary]');if(sum){sum.hidden=true;sum.innerHTML='';}
  f.dispatchEvent(new Event('input',{bubbles:true}));
 }else if(kind==='later'){
  var code=f.querySelector('.dzoft-change-code');if(code)code.hidden=true;if(f.elements.code)f.elements.code.value='';
  b.closest('.dzoft-change-item').scrollIntoView({block:'nearest'});
 }else f.reset();
 if(d)d.open=false;
});
api.client=bindClient;api.owner=bindOwner;api.prices=bindPrices;
global.DzoftChanges=api;
})(window);
