(function(global){
 'use strict';
 // This card translates itself (FR/EN) and is excluded from the page-wide dictionary (data-no-translate).
 var en=function(){return document.documentElement.lang==='en';};
 var t=function(fr,english){return en()?english:fr;};
 var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
 var money=function(n){return new Intl.NumberFormat(en()?'en-GB':'fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);};
 var day=function(d){var x=/^\d{4}-\d{2}-\d{2}$/.test(String(d))?new Date(d+'T12:00:00'):new Date(d);return isNaN(x)?esc(d):x.toLocaleDateString(en()?'en-GB':'fr-FR',{day:'numeric',month:'long',year:'numeric'});};
 var cents=function(n){return Math.round((Number(n)||0)*100);};
 var categories={design:['Design','Design'],accounts:['Comptes','Accounts'],venue:['Lieux','Venues'],chat:['Conversations','Conversations'],safety:['Sécurité','Safety'],other:['Autres travaux','Other work']};
 var statuses={planned:['Prévu','Planned'],working:['En cours','In progress'],built:['Construit','Built'],tested:['Testé','Tested']};
 var methods={transfer:['Virement','Bank transfer'],card:['Carte','Card'],cash:['Espèces','Cash'],other:['Autre','Other']};
 var kinds=[['Facture d’acompte','Deposit invoice'],['Facture intermédiaire','Interim invoice'],['Facture de solde','Final invoice']];
 function label(map,key){return map[key]?map[key][en()?1:0]:key;}
 function options(map){return Object.keys(map).map(function(k){return '<option value="'+k+'">'+esc(label(map,k))+'</option>';}).join('');}
 function stats(d){return '<div class="tracking-stats">'+[[t('Montant convenu','Agreed total'),d.total],[t('Reçu et confirmé','Received and confirmed'),d.received],[t('Reste à recevoir','Remaining balance'),d.remaining]].map(function(x){return '<div><span>'+x[0]+'</span><strong>'+money(x[1])+'</strong></div>';}).join('')+'</div><p class="tracking-help">'+t('Le solde suit l’échéancier convenu ; il n’est pas forcément exigible maintenant. Le suivi mensuel est séparé.','The balance follows the agreed schedule; it is not necessarily due now. Monthly maintenance is separate.')+'</p>';}
 function receipts(d){return (d.legacy>0?'<p class="tracking-help">'+t('Déjà confirmé sur les factures existantes :','Already confirmed on existing invoices:')+' '+money(d.legacy)+'. '+t('Déjà inclus dans le total reçu. Ne pas le saisir de nouveau.','Already included in the received total. Do not record it again.')+'</p>':'')+'<div class="tracking-history">'+d.receipts.map(function(r){return '<article><div><b>'+money(r.amount)+'</b><span>'+day(r.received_on)+' · '+esc(label(methods,r.method))+'</span></div><p class="tracking-invoice-status '+(r.invoice_id?'linked':'pending')+'">'+(r.invoice_id?t('✓ Facture associée','✓ Invoice linked'):t('⚠ Facture à établir','⚠ Invoice to be issued'))+'</p>'+(r.reference?'<small>'+esc(r.reference)+'</small>':'')+'</article>';}).join('')+'</div>';}
 function invoiceLinkForms(d,q,paidOn){
  var pending=d.receipts.filter(function(r){return !r.invoice_id;});
  if(!pending.length)return '';
  var rows=pending.map(function(r){
   var candidates=(q.invoices||[]).filter(function(i){return i.id&&i.num&&!i.paid&&!i.care&&Number(i.amt)-paidOn(i.id)>=Number(r.amount);});
   var invoiceOptions=candidates.map(function(i){return '<option value="'+esc(i.id)+'">'+esc(i.num+' · '+(i.n||''))+' · '+money(i.amt)+'</option>';}).join('');
   return '<details class="tracking-link" data-receipt-link="'+esc(r.id)+'"><summary>'+t('Associer une facture au paiement du ','Attach an invoice to payment received on ')+day(r.received_on)+' · '+money(r.amount)+'</summary><form>'+
    field(t('Facture officielle','Official invoice'),'<select name="linkInvoice"><option value="new">'+t('＋ Facture à créer après émission','＋ Create invoice once issued')+'</option>'+invoiceOptions+'</select>')+
    '<fieldset class="tracking-new"><legend>'+t('Informations de la facture émise','Issued invoice details')+'</legend><div class="tracking-fields">'+
    field(t('Type','Type'),'<select name="kind">'+kinds.map(function(k,i){return '<option value="'+i+'">'+esc(en()?k[1]:k[0])+'</option>';}).join('')+'</select>')+
    field(t('Numéro officiel de la facture','Official invoice number'),'<input name="num" required maxlength="40" autocomplete="off" placeholder="INV-2026-...">')+
    field(t('Montant total de la facture (€)','Invoice total (€)'),'<input name="amt" required type="number" min="'+esc(r.amount)+'" step="0.01" value="'+esc(r.amount)+'">')+
    '</div></fieldset><p class="tracking-help">'+t('Le paiement est déjà enregistré : l’association ne le compte pas une deuxième fois et ne renvoie pas de confirmation de paiement. Émettez d’abord la facture officielle.','The payment is already recorded: linking does not count it twice or resend a payment confirmation. Issue the official invoice first.')+'</p>'+
    '<button type="submit" class="btn main">'+t('Associer la facture','Link invoice')+'</button><p class="tracking-message" role="status" aria-live="polite"></p></form></details>';
  }).join('');
  return '<div class="tracking-unbilled"><p class="tracking-warning">'+t('Factures à établir : ','Invoices to issue: ')+pending.length+'</p>'+rows+'</div>';
 }
 function updates(d){var seen={};var recent=d.updates.filter(function(u){if(seen[u.category])return false;seen[u.category]=true;return true;});return '<div class="tracking-updates">'+(recent.length?recent.map(function(u){return '<article><div><b>'+esc(label(categories,u.category))+'</b><span class="tracking-status">'+esc(label(statuses,u.status))+'</span></div><p>'+esc(u.summary)+'</p><small>'+day(u.created_at)+'</small></article>';}).join(''):'<p class="tracking-help">'+t('Les prochains résumés publiés apparaîtront ici.','Published progress summaries will appear here.')+'</p>')+'</div>'+(d.updates.length>recent.length?'<details><summary>'+t('Historique des publications','Publication history')+'</summary>'+d.updates.map(function(u){return '<p><b>'+esc(label(categories,u.category))+'</b> · '+esc(label(statuses,u.status))+' · '+day(u.created_at)+'<br>'+esc(u.summary)+'</p>';}).join('')+'</details>':'');}
 function field(text,html,cls){return '<label'+(cls?' class="'+cls+'"':'')+'>'+text+html+'</label>';}
 function status(box,text,error){box.textContent=text;box.className='tracking-message'+(error?' error':'');}
 function friendly(err){var m=String(err&&err.message||'');
  if(/Invoice number already used/.test(m))return t('Ce numéro de facture existe déjà sur ce projet.','This invoice number already exists on this project.');
  if(/exceed the agreed total/.test(m))return t('Le total des factures dépasserait le montant convenu.','Invoices would exceed the agreed total.');
  if(/exceeds remaining/.test(m))return t('Le montant dépasse ce qui reste à régler sur cette facture.','The amount is more than what remains on this invoice.');
  if(/Invalid invoice/.test(m))return t('Vérifiez le numéro, le libellé et le montant de la facture.','Check the invoice number, label and amount.');
  if(/Invalid payment/.test(m))return t('Vérifiez le montant et la date (pas dans le futur).','Check the amount and the date (not in the future).');
  if(/Amount exceeds invoice balance/.test(m))return t('Le paiement dépasse le solde de cette facture.','Payment exceeds the invoice balance.');
  if(/Receipt already linked/.test(m))return t('Ce paiement est déjà associé à une facture. Rechargez le projet.','This payment has already been linked. Reload the project.');
  return t('Non enregistré. Réessayez. ','Not saved. Please retry. ')+m;}
 var last=null;
 function admin(q,sb,reload){
  last=[q,sb,reload];
  var parent=document.getElementById('c-inv'),work=document.getElementById('c-steps');if(!parent||!work||!q.accepted_at)return;
  var old=document.getElementById('tracking-admin');if(old)old.remove();var oldWork=document.getElementById('tracking-publish');if(oldWork)oldWork.remove();
  var box=document.createElement('section');box.id='tracking-admin';box.className='tracking';box.setAttribute('data-no-translate','');parent.prepend(box);
  var pub=document.createElement('section');pub.id='tracking-publish';pub.className='tracking';pub.setAttribute('data-no-translate','');work.prepend(pub);
  box.textContent=t('Chargement des paiements…','Loading payments…');
  sb.rpc('project_tracking',{p_quote:q.id},true).then(function(d){
   if(!box.isConnected)return;
   var paidOn=function(id){return d.receipts.filter(function(r){return r.invoice_id===id;}).reduce(function(n,r){return n+cents(r.amount);},0)/100;};
   var open=(q.invoices||[]).filter(function(i){return i.id&&i.num&&!i.paid&&!i.care;});
   var invoiced=(q.invoices||[]).filter(function(i){return !i.care;}).reduce(function(n,i){return n+cents(i.amt);},0)/100;
   var total=Number(d.total)||0,f=((q.accepted_data||q.data||{}).f)||{},pct=parseFloat(f.deppct)||30;
   var suggest=invoiced?Math.max(0,Math.round((total-invoiced)*100)/100):Math.round(total*pct)/100;
   var today=new Date().toLocaleDateString('en-CA');
   box.innerHTML='<h2>'+t('Paiements du projet','Project payments')+'</h2>'+stats(d)+receipts(d)+invoiceLinkForms(d,q,paidOn)+
    '<details class="tracking-editor"'+(d.receipts.length||d.legacy>0?'':' open')+'><summary>'+t('＋ Enregistrer un paiement reçu','＋ Record a received payment')+'</summary><form>'+
    field(t('Facture concernée','Invoice'),'<select name="invoice"><option value="unbilled">'+t('Sans numéro de facture — à établir','No invoice number — to be issued')+'</option>'+open.map(function(i){var rest=Math.round((Number(i.amt)-paidOn(i.id))*100)/100;return '<option value="'+esc(i.id)+'" data-rest="'+rest+'">'+esc(i.num+' · '+(i.n||''))+' · '+t('reste ','remaining ')+money(rest)+'</option>';}).join('')+'<option value="new">'+t('＋ Nouvelle facture','＋ New invoice')+'</option></select>')+
    '<fieldset class="tracking-new"><legend>'+t('Nouvelle facture','New invoice')+'</legend><div class="tracking-fields">'+
     field(t('Type','Type'),'<select name="kind">'+kinds.map(function(k,i){return '<option value="'+i+'">'+esc(en()?k[1]:k[0])+'</option>';}).join('')+'</select>')+
     field(t('N° de la facture (Revolut)','Invoice number (Revolut)'),'<input name="num" maxlength="40" autocomplete="off" placeholder="INV-1">')+
     field(t('Montant de la facture (€)','Invoice amount (€)'),'<input name="amt" type="number" min="0.01" step="0.01" value="'+(suggest||'')+'">')+
    '</div></fieldset>'+
    '<div class="tracking-fields">'+field(t('Montant reçu (€)','Amount received (€)'),'<input name="amount" type="number" min="0.01" step="0.01" required>')+field(t('Date de réception','Receipt date'),'<input name="date" type="date" required value="'+today+'" max="'+today+'">')+field(t('Mode de paiement','Payment method'),'<select name="method">'+options(methods)+'</select>')+field(t('Référence (facultatif)','Reference (optional)'),'<input name="reference" maxlength="100">')+'</div>'+
    '<label class="tracking-check"><input type="checkbox" name="notify" checked> '+t('Prévenir le client par e-mail','Email the client')+'</label>'+
    '<p class="tracking-help">'+t('À enregistrer uniquement après vérification de votre compte. Pour un paiement ancien déjà confirmé au client, décochez l’e-mail.','Record only after checking your bank account. For an earlier payment the client already knows about, untick the email.')+'</p><button class="btn main" type="submit">'+t('Confirmer la réception','Confirm receipt')+'</button></form></details><p role="status" aria-live="polite" class="tracking-message"></p>';
   var fm=box.querySelector('form'),key=crypto.randomUUID(),newKey=crypto.randomUUID(),el=fm.elements,news=box.querySelector('.tracking-new');
   function sync(){var isNew=el.invoice.value==='new',noInvoice=el.invoice.value==='unbilled';news.hidden=!isNew;el.num.required=isNew;el.amt.required=isNew;
    var opt=el.invoice.selectedOptions[0];el.amount.value=noInvoice?'':isNew?(el.amt.value||''):(opt&&opt.dataset.rest||'');
    if(isNew)el.kind.value=invoiced?((total-invoiced)>0?'2':'1'):'0';}
   el.invoice.onchange=sync;el.amt.oninput=function(){if(el.invoice.value==='new')el.amount.value=el.amt.value;};
   el.kind.onchange=function(){if(el.kind.value==='0'&&!invoiced){el.amt.value=Math.round(total*pct)/100;el.amount.value=el.amt.value;}};
   sync();
   box.querySelectorAll('details[data-receipt-link]').forEach(function(det){
     var form=det.querySelector('form'),select=form.elements.linkInvoice,fields=form.querySelector('.tracking-new');
     function update(){var fresh=select.value==='new';fields.hidden=!fresh;form.elements.num.required=fresh;form.elements.amt.required=fresh;}
     select.onchange=update;update();
     form.onsubmit=function(e){
       e.preventDefault();
       var fresh=select.value==='new',btn=form.querySelector('button[type=submit]'),note=form.querySelector('[role=status]'),invoiceKey=fresh?crypto.randomUUID():select.value;
       var data={p_quote:q.id,p_receipt:det.dataset.receiptLink,p_invoice:invoiceKey,p_new_invoice:fresh?{n:kinds[Number(form.elements.kind.value)][0],num:form.elements.num.value.trim(),amt:Number(form.elements.amt.value)}:null};
       btn.disabled=true;status(note,t('Association en cours…','Linking…'));
       sb.rpc('link_project_receipt_invoice',data,true).then(function(){
         status(note,t('Facture associée. Le paiement n’a pas été compté deux fois.','Invoice linked. The payment was not counted twice.'));
         setTimeout(reload,500);
       }).catch(function(err){btn.disabled=false;status(note,friendly(err),true);});
     };
   });
   fm.onsubmit=function(e){e.preventDefault();var b=fm.querySelector('button[type=submit]'),msg=box.querySelector('[role=status]');var isNew=el.invoice.value==='new';
    var unbilled=el.invoice.value==='unbilled';
    var payload={p_quote:q.id,p_id:key,p_amount:Number(el.amount.value),p_date:el.date.value,p_method:el.method.value,p_reference:el.reference.value.trim(),p_notify:el.notify.checked};
    if(!unbilled){payload.p_invoice=isNew?newKey:el.invoice.value;payload.p_new_invoice=isNew?{n:kinds[+el.kind.value][0],num:el.num.value.trim(),amt:Number(el.amt.value)}:null;}
    b.disabled=true;status(msg,t('Enregistrement…','Saving…'));
    sb.rpc(unbilled?'record_project_payment_unbilled':'record_project_payment',payload,true).then(function(){
     key=crypto.randomUUID();newKey=crypto.randomUUID();status(msg,payload.p_notify?t('Paiement enregistré. E-mails mis en file d’envoi.','Payment recorded. Emails queued.'):t('Paiement enregistré, sans e-mail.','Payment recorded, no email sent.'));if(payload.p_notify)notify(sb);setTimeout(reload,1200);
    }).catch(function(err){b.disabled=false;status(msg,friendly(err),true);});};
   pub.innerHTML='<h2>'+t('Avancement partagé','Shared progress')+'</h2>'+updates(d)+'<details class="tracking-editor"><summary>'+t('＋ Publier une avancée','＋ Publish progress')+'</summary><form><div class="tracking-rows"></div><button class="btn tracking-add" type="button">'+t('＋ Ajouter un groupe','＋ Add a group')+'</button><p class="tracking-help">'+t('Un résumé court par groupe, relu par vous (6 au maximum). Tous les groupes partent ensemble : une seule mise à jour dans l’espace client et un seul e-mail. Le journal privé reste privé ; « Testé » ne signifie pas « Validé par le client ».','One short summary per group, reviewed by you (up to 6). All groups are sent together: one update in the client portal and one email. The private journal stays private; “Tested” does not mean “Client approved”.')+'</p><button class="btn main" type="submit">'+t('Publier et notifier','Publish and notify')+'</button></form></details><p role="status" aria-live="polite" class="tracking-message"></p>';
   var pf=pub.querySelector('form'),rows=pf.querySelector('.tracking-rows'),add=pf.querySelector('.tracking-add'),pk=crypto.randomUUID();
   function syncRows(){var list=rows.querySelectorAll('.tracking-row');list.forEach(function(r,i){r.querySelector('legend').textContent=t('Groupe ','Group ')+(i+1);r.querySelector('.tracking-remove').hidden=list.length<2;});add.hidden=list.length>=6;}
   function addRow(){var used={};rows.querySelectorAll('select[name=category]').forEach(function(s){used[s.value]=1;});var next=Object.keys(categories).filter(function(k){return !used[k];})[0]||'other';var r=document.createElement('fieldset');r.className='tracking-row';r.innerHTML='<legend></legend><div class="tracking-fields">'+field(t('Groupe','Group'),'<select name="category">'+options(categories)+'</select>')+field(t('État réel','Actual status'),'<select name="status">'+options(statuses)+'</select>')+'</div>'+field(t('Résumé pour le client','Client summary'),'<textarea name="summary" required maxlength="220" rows="3"></textarea>')+'<button class="tracking-remove" type="button">'+t('Retirer ce groupe','Remove this group')+'</button>';r.querySelector('select[name=category]').value=next;r.querySelector('.tracking-remove').onclick=function(){r.remove();syncRows();};rows.appendChild(r);syncRows();return r;}
   addRow();add.onclick=function(){addRow().querySelector('textarea').focus();};
   pf.onsubmit=function(e){e.preventDefault();var b=pf.querySelector('button[type=submit]'),msg=pub.querySelector('[role=status]');
    var items=[].map.call(rows.querySelectorAll('.tracking-row'),function(r){return {category:r.querySelector('[name=category]').value,status:r.querySelector('[name=status]').value,summary:r.querySelector('[name=summary]').value.trim()};});
    if(items.some(function(i){return !i.summary;})){status(msg,t('Chaque groupe a besoin d’un résumé.','Each group needs a summary.'),true);return;}
    b.disabled=true;status(msg,t('Publication…','Publishing…'));
    sb.rpc('publish_project_updates',{p_quote:q.id,p_batch:pk,p_items:items},true).then(function(){rows.innerHTML='';addRow();pk=crypto.randomUUID();b.disabled=false;status(msg,items.length>1?t('Publié : '+items.length+' groupes dans une seule mise à jour. Un e-mail mis en file d’envoi.','Published: '+items.length+' groups in one update. One email queued.'):t('Publié. Notifications mises en file d’envoi.','Published. Notifications queued.'));notify(sb);setTimeout(reload,1200);}).catch(function(err){b.disabled=false;status(msg,t('Publication non confirmée. ','Publication not confirmed. ')+(err.message||''),true);});};
   // Existing invoice toggles cannot overwrite receipt-backed statuses.
   q._receiptInvoiceIds=d.receipts.map(function(r){return r.invoice_id;});lockInvoices(q);
  }).catch(function(){box.innerHTML='<p class="tracking-message error">'+t('Le suivi des paiements est indisponible. Rechargez la page ; aucun montant n’a été modifié.','Payment tracking is unavailable. Reload the page; no amounts were changed.')+'</p>';});
 }
 function notify(sb){sb.fn('process-notification-outbox',{}).catch(function(){/* Durable queue retries; never report delivery without provider confirmation. */});}
 function client(sb){document.querySelectorAll('[data-project-tracking]').forEach(function(box){if(box.dataset.loading)return;box.dataset.loading='1';box.setAttribute('data-no-translate','');sb.rpc('project_tracking',{p_quote:box.dataset.projectTracking},true).then(function(d){if(box.isConnected)box.innerHTML='<h2>'+t('Paiements & avancement','Payments & progress')+'</h2>'+stats(d)+receipts(d)+'<h3>'+t('Dernières avancées','Latest progress')+'</h3>'+updates(d);invoiceNotes(d);}).catch(function(){box.innerHTML='<p class="tracking-help">'+t('Connectez-vous ou rechargez la page pour consulter le suivi actualisé.','Sign in or reload to see the latest tracking information.')+'</p>';});});}
 function invoiceNotes(d){document.querySelectorAll('[data-invoice-id][data-invoice-total]').forEach(function(row){var amount=d.receipts.filter(function(r){return r.invoice_id===row.dataset.invoiceId;}).reduce(function(n,r){return n+cents(r.amount);},0)/100;if(!amount)return;var rest=Math.max(0,Number(row.dataset.invoiceTotal)-amount);var note=row.querySelector('.tracking-invoice-note');if(!note){note=document.createElement('p');note.className='tracking-invoice-note muted';note.setAttribute('data-no-translate','');row.appendChild(note);}note.textContent=t('Reçu et confirmé','Received and confirmed')+' '+money(amount)+' · '+t('Reste à régler sur cette facture','Remaining on this invoice')+' '+money(rest);var pill=row.querySelector('.pill');if(pill)pill.textContent=rest?t('Partiellement réglé','Partially paid'):t('Paiement reçu et confirmé','Payment received and confirmed');if(!rest){var report=row.querySelector('[data-report-payment]');if(report)report.hidden=true;}});}
 function lockInvoices(q){(q.invoices||[]).forEach(function(i,index){if((q._receiptInvoiceIds||[]).indexOf(i.id)<0)return;var row=document.querySelectorAll('#invs .invr')[index];if(row)row.querySelectorAll('.paid,.amt,.num,.rm').forEach(function(el){el.disabled=true;el.title=t('Calculé depuis les paiements reçus','Calculated from recorded receipts');});});}
 function refreshClient(){if(document.visibilityState==='hidden')return;document.querySelectorAll('[data-project-tracking]').forEach(function(box){delete box.dataset.loading;});if(global.RDsb)client(global.RDsb);}
 window.addEventListener('focus',refreshClient);setInterval(refreshClient,30000);
 // Language switch: redraw in the new language (the page dictionary skips this card).
 document.addEventListener('dzoft:locale-change',function(){if(last&&document.getElementById('tracking-admin'))admin.apply(null,last);refreshClient();});
 global.DzoftTracking={admin:admin,client:client,lockInvoices:lockInvoices};
})(window);
