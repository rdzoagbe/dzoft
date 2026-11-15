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
 function stats(d){return '<div class="tracking-stats">'+[[t('Montant convenu','Agreed total'),d.total],[t('Reçu et confirmé','Received and confirmed'),d.received],[t('Reste à recevoir','Remaining balance'),d.remaining]].map(function(x){return '<div><span>'+x[0]+'</span><strong>'+money(x[1])+'</strong></div>';}).join('')+'</div>'+(Number(d.supplements)>0?'<p class="tracking-help">'+t('Montant convenu = devis accepté '+money(d.base_total)+' + compléments approuvés et facturés '+money(d.supplements)+'.','Agreed total = accepted quote '+money(d.base_total)+' + approved, invoiced additions '+money(d.supplements)+'.')+'</p>':'')+'<p class="tracking-help">'+t('Le solde suit l’échéancier convenu ; il n’est pas forcément exigible maintenant. Le suivi mensuel est séparé.','The balance follows the agreed schedule; it is not necessarily due now. Monthly maintenance is separate.')+'</p>';}
 function invoiceArchiveAction(r,q){
   if(!r.invoice_id)return '<button class="btn sm main tracking-issue-btn" type="button" data-open-receipt-link="'+esc(r.id)+'">'+t('Générer une facture','Generate an invoice')+'</button>';
   var inv=(q&&q.invoices||[]).find(function(x){return x.id===r.invoice_id;});
   if(!inv||!inv.generatedByDzoft)return '';
   if(inv.file)return '<button class="btn sm line tracking-print-btn" type="button" data-download-receipt-invoice="'+esc(r.id)+'">'+t('Télécharger la facture PDF','Download invoice PDF')+'</button>';
   return '<button class="btn sm main tracking-issue-btn" type="button" data-archive-receipt-invoice="'+esc(r.id)+'">'+t('Archiver le PDF de cette facture','Archive invoice PDF')+'</button>';
  }
  function receipts(d,admin,q){return (d.legacy>0?'<p class="tracking-help">'+t('Déjà confirmé sur les factures existantes :','Already confirmed on existing invoices:')+' '+money(d.legacy)+'. '+t('Déjà inclus dans le total reçu. Ne pas le saisir de nouveau.','Already included in the received total. Do not record it again.')+'</p>':'')+'<div class="tracking-history">'+d.receipts.map(function(r){return '<article><div><b>'+money(r.amount)+'</b><span>'+day(r.received_on)+' · '+esc(label(methods,r.method))+'</span></div><p class="tracking-invoice-status '+(r.invoice_id?'linked':'pending')+'">'+(r.invoice_id?t('✓ Facture associée','✓ Invoice linked'):t('⚠ Facture à établir','⚠ Invoice to be issued'))+'</p>'+(r.reference?'<small>'+esc(r.reference)+'</small>':'')+(admin?'<div class="tracking-receipt-admin">'+invoiceArchiveAction(r,q)+'<p class="tracking-email-state" data-receipt-email="'+esc(r.id)+'" role="status">'+t('État de l’e-mail : chargement…','Email status: loading…')+'</p><details class="tracking-correction"><summary>'+t('Corriger le mode de paiement','Correct payment method')+'</summary><form data-correct-receipt="'+esc(r.id)+'">'+field(t('Mode réellement utilisé','Actual payment method'),'<select name="method" required>'+Object.keys(methods).map(function(k){return '<option value="'+k+'"'+(r.method===k?' selected':'')+'>'+esc(label(methods,k))+'</option>';}).join('')+'</select>')+field(t('Pourquoi corriger ? (audit)','Why correct this? (audit trail)'),'<textarea name="reason" required minlength="12" maxlength="500" rows="2" placeholder="'+t('Ex. : La remise du 4 novembre a été faite en espèces.','Example: The payment on 4 November was made in cash.')+'"></textarea>')+'<p class="tracking-help">'+t('Le montant et la date restent inchangés. Cette correction est enregistrée dans un historique privé. Aucun e-mail n’est envoyé.','Amount and receipt date stay unchanged. A private audit trail is kept. No email is sent.')+'</p><button class="btn line" type="submit">'+t('Corriger et journaliser','Correct and audit')+'</button><p class="tracking-message" role="status" aria-live="polite"></p></form></details></div>':'')+'</article>';}).join('')+'</div>'+(admin?'<details class="tracking-audit"><summary>'+t('Historique des corrections','Correction history')+' <span data-audit-count></span></summary><div data-audit-list><p class="tracking-help">'+t('Chargement…','Loading…')+'</p></div></details>':'');}
 function receiptEmailLabel(st){
  if(st==='sent')return t('E-mail accepté par le fournisseur (pas une preuve de lecture)','Email accepted by provider (not proof of delivery)');
  if(st==='queued')return t('E-mail en attente de traitement','Email queued for processing');
  if(st==='failed')return t('Échec d’envoi : consulter l’historique des e-mails','Send failed: check email history');
  if(st==='not_queued')return t('Aucun e-mail client enregistré pour ce versement','No client email recorded for this payment');
  return t('État de l’e-mail indisponible','Email status unavailable');
 }
 function wireReceiptCorrections(box,q,sb,reload){
  box.querySelectorAll('form[data-correct-receipt]').forEach(function(form){
   form.onsubmit=function(ev){
    ev.preventDefault();
    if(!form.reportValidity())return;
    var btn=form.querySelector('button[type=submit]'),notice=form.querySelector('[role=status]');
    if(!confirm(t('Confirmer cette correction du mode de paiement ? Le montant, la date et les e-mails envoyés resteront inchangés.','Confirm the payment-method correction? The amount, receipt date and previously sent emails will remain unchanged.')))return;
    btn.disabled=true;status(notice,t('Correction sécurisée en cours…','Saving audited correction…'));
    sb.rpc('correct_project_receipt_method',{
      p_quote:q.id,p_receipt:form.dataset.correctReceipt,
      p_method:form.elements.method.value,p_reason:form.elements.reason.value.trim()
    },true).then(function(){
      status(notice,t('Correction enregistrée dans l’historique. Montant inchangé.','Correction logged. Amount unchanged.'));
      setTimeout(reload,800);
    }).catch(function(err){btn.disabled=false;status(notice,friendly(err),true);});
   };
  });
  sb.rpc('project_payment_admin_meta',{p_quote:q.id},true).then(function(meta){
    if(!box.isConnected)return;
    var map={};(meta.notifications||[]).forEach(function(row){map[row.receipt_id]=row;});
    box.querySelectorAll('[data-receipt-email]').forEach(function(node){
      var r=map[node.dataset.receiptEmail],state=r?r.email_status:'unknown';
      node.textContent=receiptEmailLabel(state)+(r&&r.sent_at?' · '+day(r.sent_at):'');
      node.classList.toggle('tracking-email-failure',state==='failed');
    });
    var rows=meta.corrections||[];
    var count=box.querySelector('[data-audit-count]'),list=box.querySelector('[data-audit-list]');
    if(count)count.textContent=rows.length?'('+rows.length+')':'';
    if(list)list.innerHTML=rows.length?rows.map(function(item){
      return '<p class="tracking-audit-entry"><b>'+day(item.changed_at)+'</b> · '+esc(label(methods,item.old_method))+' → '+esc(label(methods,item.new_method))+'<br>'+esc(item.reason)+'</p>';
    }).join(''):'<p class="tracking-help">'+t('Aucune correction enregistrée.','No corrections recorded.')+'</p>';
  }).catch(function(){
    if(!box.isConnected)return;
    box.querySelectorAll('[data-receipt-email]').forEach(function(node){node.textContent=receiptEmailLabel('unknown');});
    var list=box.querySelector('[data-audit-list]');if(list)list.textContent=t('Historique indisponible. Réessayez après avoir actualisé.','History unavailable. Refresh to retry.');
  });
 }

 function invoiceLinkForms(d,q,paidOn){
  var pending=d.receipts.filter(function(r){return !r.invoice_id;});
  if(!pending.length)return '';
  var rows=pending.map(function(r){
   var candidates=(q.invoices||[]).filter(function(i){return i.id&&i.num&&!i.paid&&!i.care&&Number(i.amt)-paidOn(i.id)>=Number(r.amount);});
   var invoiceOptions=candidates.map(function(i){return '<option value="'+esc(i.id)+'">'+esc(i.num+' · '+(i.n||''))+' · '+money(i.amt)+'</option>';}).join('');
   return '<details class="tracking-link" data-receipt-link="'+esc(r.id)+'"><summary>'+t('Associer une facture au paiement du ','Attach an invoice to payment received on ')+day(r.received_on)+' · '+money(r.amount)+'</summary><form>'+
    field(t('Facture officielle','Official invoice'),'<select name="linkInvoice"><option value="auto">'+t('Générer automatiquement un numéro officiel','Generate an official invoice number automatically')+'</option><option value="new">'+t('J’ai déjà un numéro officiel','I already have an official invoice number')+'</option>'+invoiceOptions+'</select>')+
    '<fieldset class="tracking-auto"><legend>'+t('Facture générée par DZOFT','Invoice generated by DZOFT')+'</legend>'+field(t('Type de facture','Invoice type'),'<select name="autoKind">'+kinds.map(function(k,i){return '<option value="'+i+'">'+esc(en()?k[1]:k[0])+'</option>';}).join('')+'</select>')+'<p class="tracking-help">'+t('DZOFT attribue un numéro chronologique unique (F-AAAA-0001), établit la facture pour le montant de ce versement et l’associe immédiatement. Aucun deuxième paiement ni e-mail ne sera créé. Assurez-vous de ne pas utiliser la même série de numéros ailleurs.','DZOFT assigns a unique consecutive number (F-YYYY-0001), issues an invoice for this payment amount and links it immediately. No second payment or email is created. Make sure this numbering series is not in use elsewhere.')+'</p></fieldset><fieldset class="tracking-new"><legend>'+t('Facture émise hors DZOFT','Invoice issued outside DZOFT')+'</legend><div class="tracking-fields">'+
    field(t('Type','Type'),'<select name="kind">'+kinds.map(function(k,i){return '<option value="'+i+'">'+esc(en()?k[1]:k[0])+'</option>';}).join('')+'</select>')+
    field(t('Numéro officiel de la facture','Official invoice number'),'<input name="num" required maxlength="40" autocomplete="off" placeholder="INV-2026-...">')+
    field(t('Montant total de la facture (€)','Invoice total (€)'),'<input name="amt" required type="number" min="'+esc(r.amount)+'" step="0.01" value="'+esc(r.amount)+'">')+
    '</div><div class="tracking-invoice-actions"><button type="button" class="btn line" data-preview-invoice>'+t('Préparer / enregistrer la facture en PDF','Prepare / save invoice as PDF')+'</button><p class="tracking-help">'+t('DZOFT prépare une page imprimable. Vérifiez le numéro officiel, la date, l’adresse et les mentions légales avant de l’enregistrer en PDF. Le PDF doit ensuite être joint au projet.','DZOFT prepares a printable page. Check the official number, date, addresses and legal details before saving as PDF. Attach the PDF to the project afterwards.')+'</p><label class="tracking-check"><input type="checkbox" name="issued" required> '+t('Je confirme avoir émis cette facture officielle avec un numéro valide.','I confirm this official invoice has been issued with a valid number.')+'</label></div></fieldset><p class="tracking-help">'+t('Ce paiement est déjà enregistré : aucune somme ne sera comptée deux fois et aucun nouvel e-mail de paiement ne sera envoyé.','This payment is already recorded: no amount will be counted twice and no new payment email will be sent.')+'</p>'+
    '<button type="submit" class="btn main">'+t('Valider et associer la facture','Confirm and link invoice')+'</button><p class="tracking-message" role="status" aria-live="polite"></p></form></details>';
  }).join('');
  return '<div class="tracking-unbilled"><p class="tracking-warning">'+t('Paiements à facturer : ','Payments awaiting invoices: ')+pending.length+'</p><p class="tracking-help">'+t('Les versements sont bien reçus. Il manque seulement les factures officielles correspondantes. Cliquez sur le bouton « Créer / associer une facture » de chaque paiement, ou ouvrez une ligne ci-dessous.','Payments are confirmed. Only their official invoices are missing. Use “Create / link an invoice” on each payment, or expand a row below.')+'</p>'+rows+'</div>';
 }
 function paymentStatusLabel(s){return s==='sent_by_client'?t('Envoyé selon le client · à vérifier','Client says sent · awaiting verification'):s==='pending'?t('En attente','Pending'):s==='received'?t('Reçu et confirmé','Received and confirmed'):t('Annulé','Cancelled');}
 function paymentStatuses(d,admin){
  var claims=(d.payment_statuses||[]).filter(function(c){return admin||c.status!=='cancelled';});
  var outstanding=claims.filter(function(c){return c.status==='pending'||c.status==='sent_by_client';});
  var totalPending=outstanding.reduce(function(n,c){return n+cents(c.amount);},0)/100;
  var text='<section class="tracking-claims"><div class="tracking-claims-title"><h3>'+t('Suivi des versements','Payment status tracking')+'</h3>'+
    '<span class="tracking-status-pill pending">'+t('En cours de vérification : ','Awaiting verification: ')+money(totalPending)+'</span></div>'+
    '<p class="tracking-help">'+t('Un paiement signalé ou en attente ne réduit pas le solde. Il est ajouté aux sommes reçues uniquement après confirmation de l’encaissement.','A reported or pending payment does not reduce the balance. It counts as received only after you confirm the funds arrived.')+'</p>'+
    '<div class="tracking-claims-list">';
  if(!claims.length)text+='<p class="tracking-help">'+t('Aucun virement en attente déclaré.','No pending transfers reported.')+'</p>';
  claims.forEach(function(c){
    var active=c.status==='pending'||c.status==='sent_by_client';
    text+='<article class="tracking-claim"><div class="tracking-claim-head"><b>'+money(c.amount)+' · '+esc(label(methods,c.method))+'</b>'+
      '<span class="tracking-status-pill '+(active?'pending':(c.status==='received'?'received':'cancelled'))+'">'+paymentStatusLabel(c.status)+'</span></div>'+
      (c.reported_on?'<p class="tracking-help">'+t('Date signalée : ','Reported date: ')+day(c.reported_on)+'</p>':'')+
      (c.reference?'<p class="tracking-help">'+t('Référence : ','Reference: ')+esc(c.reference)+'</p>':'')+
      (admin&&active?'<div class="tracking-claim-actions">'+
         '<form data-status-id="'+esc(c.id)+'">'+
          field(t('Avancement du paiement','Payment status'),'<select name="status"><option value="pending"'+(c.status==='pending'?' selected':'')+'>'+t('En attente','Pending')+'</option><option value="sent_by_client"'+(c.status==='sent_by_client'?' selected':'')+'>'+t('Confirmé envoyé par le client','Client confirmed sent')+'</option><option value="cancelled">'+t('Annuler cette attente','Cancel pending payment')+'</option></select>')+
          field(t('Date annoncée par le client','Date reported by client'),'<input name="reportedOn" type="date" value="'+esc(c.reported_on||'')+'">')+
          '<button type="submit" class="btn line">'+t('Mettre à jour le statut','Update status')+'</button><span role="status" class="tracking-message" aria-live="polite"></span>'+
         '</form>'+
         '<details class="tracking-confirm"><summary>'+t('✓ Confirmer la réception réelle','✓ Confirm funds received')+'</summary><form data-confirm-id="'+esc(c.id)+'">'+
           field(t('Date d’encaissement réel','Actual date received'),'<input name="receivedOn" type="date" required>')+
           '<label class="tracking-check"><input type="checkbox" name="notify" checked> '+t('Informer le client du paiement reçu et du solde','Email the client: payment received and balance')+'</label>'+
           '<p class="tracking-confirm-preview">'+t('Après confirmation : reçu ','After confirmation: received ')+money(Number(d.received)+Number(c.amount))+' · '+t('reste ','remaining ')+money(Math.max(0,Number(d.remaining)-Number(c.amount)))+'</p>'+
           '<p class="tracking-help">'+t('À utiliser seulement après vérification du crédit bancaire ou de la remise des espèces. L’envoi au client est facultatif.','Only confirm after checking cleared funds or cash in hand. Notifying the client is optional.')+'</p>'+
           '<button type="submit" class="btn main">'+t('Confirmer et enregistrer le paiement','Confirm and record payment')+'</button><span role="status" class="tracking-message" aria-live="polite"></span>'+
         '</form></details></div>':'')+
      '</article>';
  });
  text+='</div>';
  if(admin)text+='<details class="tracking-editor tracking-report-editor"><summary>'+t('＋ Ajouter un paiement en attente / annoncé','＋ Add pending / client-reported payment')+'</summary>'+
     '<form data-status-create>'+
      '<div class="tracking-fields">'+
       field(t('Montant (€)','Amount (€)'),'<input name="amount" type="number" min="0.01" step="0.01" required>')+
       field(t('Mode de paiement','Payment method'),'<select name="method" required><option value="">'+t('Choisir…','Choose…')+'</option>'+options(methods)+'</select>')+
       field(t('État du paiement','Payment state'),'<select name="status"><option value="pending">'+t('En attente','Pending')+'</option><option value="sent_by_client">'+t('Le client confirme l’envoi','Client confirms sent')+'</option></select>')+
       field(t('Date annoncée (si envoyé)','Date reported (if sent)'),'<input name="reportedOn" type="date">')+
       field(t('Référence (facultatif)','Reference (optional)'),'<input name="reference" maxlength="100">')+
      '</div>'+
      '<p class="tracking-help">'+t('Facture Revolut facultative : aucun numéro de facture nécessaire à cette étape. Vous pouvez émettre et joindre la facture officielle plus tard.','Revolut invoice optional: no invoice number is required at this stage. You can issue and attach the official invoice later.')+'</p>'+
      '<button type="submit" class="btn main">'+t('Enregistrer le statut (sans confirmer la réception)','Save status (do not confirm receipt)')+'</button><span role="status" aria-live="polite" class="tracking-message"></span>'+
     '</form></details>';
  return text+'</section>';
 }
 function wirePaymentStatuses(box,q,sb,reload){
  var create=box.querySelector('form[data-status-create]');
  if(create){
   var state=create.elements.status,reported=create.elements.reportedOn;
   function sync(){reported.required=state.value==='sent_by_client';}
   state.onchange=sync;sync();
   var key=crypto.randomUUID();
   create.onsubmit=function(e){
    e.preventDefault();var b=create.querySelector('button[type=submit]'),msg=create.querySelector('[role=status]');
    var data={p_quote:q.id,p_id:key,p_amount:Number(create.elements.amount.value),p_method:create.elements.method.value,
      p_status:state.value,p_reported_on:reported.value||null,p_reference:create.elements.reference.value.trim()};
    b.disabled=true;status(msg,t('Enregistrement…','Saving…'));
    sb.rpc('create_project_payment_status',data,true).then(function(){
     key=crypto.randomUUID();status(msg,t('Statut enregistré. Aucun paiement reçu ajouté.','Status saved. No received payment recorded.'));setTimeout(reload,650);
    }).catch(function(err){b.disabled=false;status(msg,friendly(err),true);});
   };
  }
  box.querySelectorAll('form[data-status-id]').forEach(function(form){
    var select=form.elements.status,reported=form.elements.reportedOn,key=form.dataset.statusId;
    function sync(){reported.required=select.value==='sent_by_client';}
    select.onchange=sync;sync();
    form.onsubmit=function(e){
     e.preventDefault();var b=form.querySelector('button[type=submit]'),msg=form.querySelector('[role=status]');
     if(select.value==='cancelled'&&!confirm(t('Annuler ce paiement en attente ? Aucun paiement reçu ne sera supprimé.','Cancel this pending payment? No confirmed receipt will be deleted.')))return;
     b.disabled=true;status(msg,t('Mise à jour…','Updating…'));
     sb.rpc('update_project_payment_status',{p_quote:q.id,p_id:key,p_status:select.value,p_reported_on:reported.value||null},true).then(function(){
       status(msg,t('Statut actualisé. Encaissement non confirmé.','Status updated. Receipt not confirmed.'));setTimeout(reload,650);
     }).catch(function(err){b.disabled=false;status(msg,friendly(err),true);});
    };
  });
  box.querySelectorAll('form[data-confirm-id]').forEach(function(form){
    var id=form.dataset.confirmId,date=form.elements.receivedOn;
    date.value=new Date().toLocaleDateString('en-CA');
    date.max=new Date().toLocaleDateString('en-CA');
    form.onsubmit=function(e){
      e.preventDefault();var b=form.querySelector('button[type=submit]'),msg=form.querySelector('[role=status]');
      if(!form.reportValidity())return;
      b.disabled=true;status(msg,t('Confirmation de la réception…','Confirming funds received…'));
      var shouldNotify=form.elements.notify.checked;
      sb.rpc('confirm_project_payment_status',{p_quote:q.id,p_id:id,p_received_on:date.value,p_notify:shouldNotify},true).then(function(){
        status(msg,shouldNotify?t('Paiement reçu et enregistré. Notification mise en file.','Payment confirmed. Notification queued.'):t('Paiement reçu et enregistré, sans e-mail.','Payment confirmed, no email.'));
        if(shouldNotify)notify(sb);setTimeout(reload,850);
      }).catch(function(err){b.disabled=false;status(msg,friendly(err),true);});
    };
  });
 }
 function updates(d){var seen={};var recent=d.updates.filter(function(u){if(seen[u.category])return false;seen[u.category]=true;return true;});return '<div class="tracking-updates">'+(recent.length?recent.map(function(u){return '<article><div><b>'+esc(label(categories,u.category))+'</b><span class="tracking-status">'+esc(label(statuses,u.status))+'</span></div><p>'+esc(u.summary)+'</p><small>'+day(u.created_at)+'</small></article>';}).join(''):'<p class="tracking-help">'+t('Les prochains résumés publiés apparaîtront ici.','Published progress summaries will appear here.')+'</p>')+'</div>'+(d.updates.length>recent.length?'<details><summary>'+t('Historique des publications','Publication history')+'</summary>'+d.updates.map(function(u){return '<p><b>'+esc(label(categories,u.category))+'</b> · '+esc(label(statuses,u.status))+' · '+day(u.created_at)+'<br>'+esc(u.summary)+'</p>';}).join('')+'</details>':'');}
 function field(text,html,cls){return '<label'+(cls?' class="'+cls+'"':'')+'>'+text+html+'</label>';}
 function status(box,text,error){box.textContent=text;box.className='tracking-message'+(error?' error':'');}
 function friendly(err){var m=String(err&&err.message||'');
  if(/Payment method unchanged/.test(m))return t('Le mode de paiement est déjà celui sélectionné.','That is already the recorded payment method.');
   if(/Invalid correction details/.test(m))return t('Veuillez préciser une justification d’au moins 12 caractères.','Please enter a correction reason of at least 12 characters.');
   if(/Owner access required/.test(m))return t('Accès administrateur requis. Reconnectez-vous.','Admin access required. Sign in again.');
   if(/Invoice number already used/.test(m))return t('Ce numéro de facture existe déjà sur ce projet.','This invoice number already exists on this project.');
  if(/exceed the agreed total/.test(m))return t('Le total des factures dépasserait le montant convenu.','Invoices would exceed the agreed total.');
  if(/exceeds remaining/.test(m))return t('Le montant dépasse ce qui reste à régler sur cette facture.','The amount is more than what remains on this invoice.');
  if(/Invalid invoice/.test(m))return t('Vérifiez le numéro, le libellé et le montant de la facture.','Check the invoice number, label and amount.');
  if(/Invalid payment/.test(m))return t('Vérifiez le montant et la date (pas dans le futur).','Check the amount and the date (not in the future).');
  if(/Amount exceeds invoice balance/.test(m))return t('Le paiement dépasse le solde de cette facture.','Payment exceeds the invoice balance.');
  if(/Pending payments exceed remaining/.test(m))return t('Les paiements en attente dépasseraient le solde restant.','Pending payments would exceed the remaining balance.');
  if(/Invalid payment status/.test(m))return t('Vérifiez le statut et la date annoncée.','Check payment status and reported date.');
  if(/finalized payment status/.test(m))return t('Ce statut finalisé ne peut pas être modifié.','This finalized status cannot be changed.');
  if(/Cancelled payments cannot be confirmed/.test(m))return t('Un paiement annulé ne peut pas être encaissé.','A cancelled payment cannot be confirmed.');
  if(/Receipt already linked/.test(m))return t('Ce paiement est déjà associé à une facture. Rechargez le projet.','This payment has already been linked. Reload the project.');
  return t('Non enregistré. Réessayez. ','Not saved. Please retry. ')+m;}
 var last=null;
 function admin(q,sb,reload){
  last=[q,sb,reload];
  var parent=document.getElementById('c-inv'),work=document.getElementById('c-steps');if(!parent||!work||!q.accepted_at)return;
  var old=document.getElementById('tracking-admin');if(old)old.remove();var oldWork=document.getElementById('tracking-publish');if(oldWork)oldWork.remove();
  var box=document.createElement('section');box.id='tracking-admin';box.className='tracking';box.setAttribute('data-no-translate','');var paymentSlot=parent.querySelector('#iv-payments-slot');if(paymentSlot)paymentSlot.appendChild(box);else parent.prepend(box);
  var pub=document.createElement('section');pub.id='tracking-publish';pub.className='tracking';pub.setAttribute('data-no-translate','');work.prepend(pub);
  box.textContent=t('Chargement des paiements…','Loading payments…');
  sb.rpc('project_tracking',{p_quote:q.id},true).then(function(d){
   if(!box.isConnected)return;
   var paymentTruth=document.getElementById('iv-payment-truth');
   if(paymentTruth){
     var confirmed=Number(d.received),outstanding=Number(d.remaining),contract=Number(d.total);
     if([confirmed,outstanding,contract].every(Number.isFinite)){
       paymentTruth.replaceChildren();
       var title=document.createElement('strong');
       title.textContent=t('Paiements réellement reçus','Payments actually received');
       var values=document.createElement('div');values.className='invoice-payment-numbers';
       var paid=document.createElement('span');paid.textContent=t('Confirmé : ','Confirmed: ')+money(confirmed);
       var due=document.createElement('b');due.id='iv-payment-outstanding';due.textContent=t('Encore à recevoir : ','Still outstanding: ')+money(outstanding);
       values.append(paid,due);paymentTruth.append(title,values);
       var note=document.createElement('small');
       note.textContent=t('Une facture émise n’est pas un paiement. Les changements proposés ne s’ajoutent au prix qu’après l’accord explicite du client.','An issued invoice is not a payment. Proposed changes are added only after explicit client approval.');
       paymentTruth.appendChild(note);
     } else {
       paymentTruth.textContent=t('Montants encaissés indisponibles. Vérifiez les paiements dans le détail.','Payment data unavailable. Check the detailed receipts.');
     }
   }
   // The payment summary is based on verified, bank/cash-confirmed receipts,
   // never on the mere existence of a numbered invoice or a paid flag.
   if(paymentTruth && [d.received,d.remaining,d.total].every(function(v){return Number.isFinite(Number(v));})){
     var receiptHeading=document.createElement('b');
     receiptHeading.className='invoice-receipt-heading';
     receiptHeading.textContent=t('Détail des encaissements confirmés','Confirmed payment history');
     paymentTruth.appendChild(receiptHeading);
     var receiptList=document.createElement('ul');receiptList.className='invoice-receipt-list';
     (d.receipts||[]).forEach(function(receipt){
       var item=document.createElement('li');
       var description=document.createElement('span');
       description.textContent=day(receipt.received_on)+' · '+label(methods,receipt.method);
       var sum=document.createElement('strong');sum.textContent=money(receipt.amount);
       item.append(description,sum);receiptList.appendChild(item);
     });
     if(Number(d.legacy)>0){
       var old=document.createElement('li');old.className='invoice-receipt-legacy';
       old.textContent=t('Versements historiques déjà confirmés : ','Previously confirmed legacy payments: ')+money(d.legacy);
       receiptList.appendChild(old);
     }
     if(!receiptList.children.length){
       var none=document.createElement('li');
       none.textContent=t('Aucun paiement confirmé pour le moment.','No payments confirmed yet.');
       receiptList.appendChild(none);
     }
     paymentTruth.appendChild(receiptList);
   }
   (q.invoices||[]).forEach(function(inv,index){
     var card=document.querySelector('#invs .invoice-record[data-i="'+index+'"]');
     if(!card)return;
     var pill=card.querySelector('.invoice-record-status');if(!pill)return;
     var amount=cents(inv.amt);
     var confirmed=(d.receipts||[]).filter(function(receipt){return receipt.invoice_id===inv.id;})
       .reduce(function(n,receipt){return n+cents(receipt.amount);},0);
     pill.classList.remove('is-paid');
     card.classList.remove('paid');
     if(amount>0&&confirmed>=amount){
       pill.textContent=t('Paiement reçu et confirmé','Payment received and confirmed');
       pill.classList.add('is-paid');card.classList.add('paid');
     }else if(confirmed>0){
       pill.textContent=t('Paiement partiel confirmé : ','Partial payment confirmed: ')+money(confirmed);
     }else if(Number(d.legacy)>0&&inv.paid){
       pill.textContent=t('Paiement historique : vérifier le détail','Historical payment: check records');
     }else{
       pill.textContent=t('Aucun paiement reçu sur cette facture','No payment confirmed for this invoice');
     }
   });
   var paidOn=function(id){return d.receipts.filter(function(r){return r.invoice_id===id;}).reduce(function(n,r){return n+cents(r.amount);},0)/100;};
   var open=(q.invoices||[]).filter(function(i){return i.id&&i.num&&!i.paid&&!i.care;});
   var invoiced=(q.invoices||[]).filter(function(i){return !i.care;}).reduce(function(n,i){return n+cents(i.amt);},0)/100;
   var total=Number(d.total)||0,f=((q.accepted_data||q.data||{}).f)||{},pct=parseFloat(f.deppct)||30;
   var suggest=invoiced?Math.max(0,Math.round((total-invoiced)*100)/100):Math.round(total*pct)/100;
   var today=new Date().toLocaleDateString('en-CA');
   box.innerHTML='<h2>'+t('Paiements du projet','Project payments')+'</h2>'+stats(d)+paymentStatuses(d,true)+receipts(d,true,q)+invoiceLinkForms(d,q,paidOn)+
    '<details class="tracking-editor"'+(d.receipts.length||d.legacy>0?'':' open')+'><summary>'+t('＋ Enregistrer un paiement reçu','＋ Record a received payment')+'</summary><form>'+
    field(t('Facture concernée (facultative)','Invoice (optional)'),'<select name="invoice"><option value="unbilled">'+t('Sans numéro de facture — à établir','No invoice number — to be issued')+'</option>'+open.map(function(i){var rest=Math.round((Number(i.amt)-paidOn(i.id))*100)/100;return '<option value="'+esc(i.id)+'" data-rest="'+rest+'">'+esc(i.num+' · '+(i.n||''))+' · '+t('reste ','remaining ')+money(rest)+'</option>';}).join('')+'<option value="new">'+t('＋ Nouvelle facture','＋ New invoice')+'</option></select>')+
    '<p class="tracking-help tracking-unbilled-tip">'+t('Vous pouvez confirmer l’encaissement maintenant et associer le numéro officiel de facture plus tard, sans compter le paiement deux fois.','Confirm the received money now and attach the official invoice number later, without counting the payment twice.')+'</p>'+'<fieldset class="tracking-new"><legend>'+t('Nouvelle facture','New invoice')+'</legend><div class="tracking-fields">'+
     field(t('Type','Type'),'<select name="kind">'+kinds.map(function(k,i){return '<option value="'+i+'">'+esc(en()?k[1]:k[0])+'</option>';}).join('')+'</select>')+
     field(t('N° officiel (Revolut ou autre)','Official invoice number (Revolut or other)'),'<input name="num" maxlength="40" autocomplete="off" placeholder="INV-1">')+
     field(t('Montant de la facture (€)','Invoice amount (€)'),'<input name="amt" type="number" min="0.01" step="0.01" value="'+(suggest||'')+'">')+
    '</div></fieldset>'+
    '<div class="tracking-fields">'+field(t('Montant reçu (€)','Amount received (€)'),'<input name="amount" type="number" min="0.01" step="0.01" required>')+field(t('Date de réception','Receipt date'),'<input name="date" type="date" required value="'+today+'" max="'+today+'">')+field(t('Mode de paiement','Payment method'),'<select name="method" required><option value="">'+t('Sélectionner le mode réellement reçu','Select actual payment method')+'</option>'+options(methods)+'</select>')+field(t('Référence (facultatif)','Reference (optional)'),'<input name="reference" maxlength="100">')+'</div>'+
    '<label class="tracking-check"><input type="checkbox" name="notify" checked> '+t('Prévenir le client par e-mail','Email the client')+'</label>'+
    '<p class="tracking-help">'+t('Confirmez uniquement l’argent réellement reçu (espèces remises, virement crédité ou carte encaissée). Pour un paiement ancien déjà annoncé, décochez l’e-mail.','Confirm only money actually received (cash in hand, transfer credited or card settled). For a previously reported payment, untick the email.')+'</p><button class="btn main" type="submit">'+t('Confirmer la réception','Confirm receipt')+'</button></form></details><p role="status" aria-live="polite" class="tracking-message"></p>';
   // Invoice-link forms render BEFORE the new-payment form as soon as one receipt exists.
   // Always scope controls to the payment editor: otherwise the wrong form throws
   // and the entire payment panel appears unavailable even though the receipt saved.
   wirePaymentStatuses(box,q,sb,reload);
    wireReceiptCorrections(box,q,sb,reload);
   box.querySelectorAll('[data-download-receipt-invoice]').forEach(function(btn){btn.onclick=function(){
     var receipt=d.receipts.find(function(r){return r.id===btn.dataset.downloadReceiptInvoice;}),inv=receipt&&(q.invoices||[]).find(function(i){return i.id===receipt.invoice_id;});
     if(!inv||!inv.file)return;var w=global.open('about:blank','_blank');
     sb.files.link(inv.file,true).then(function(url){if(w)w.location=url;else global.open(url,'_blank');}).catch(function(err){if(w)w.close();alert(err.message||'Download unavailable');});
   };});
   box.querySelectorAll('[data-archive-receipt-invoice]').forEach(function(btn){btn.onclick=function(){
     var receipt=d.receipts.find(function(r){return r.id===btn.dataset.archiveReceiptInvoice;}),inv=receipt&&(q.invoices||[]).find(function(i){return i.id===receipt.invoice_id;});
     if(!receipt||!inv||!inv.generatedByDzoft||inv.file)return;
     btn.disabled=true;btn.textContent=t('Archivage sécurisé…','Archiving securely…');
     archiveInvoice(q,sb,receipt,{id:inv.id,num:inv.num,amt:inv.amt,n:inv.n,issuedOn:inv.issuedOn})
       .then(function(){btn.textContent=t('PDF archivé','PDF archived');setTimeout(reload,550);})
       .catch(function(err){btn.disabled=false;btn.textContent=t('Réessayer l’archivage PDF','Retry PDF archive');alert(err.message||'PDF archive failed');});
   };});
   var fm=box.querySelector('details.tracking-editor:not(.tracking-report-editor) > form'),key=crypto.randomUUID(),newKey=crypto.randomUUID(),el=fm.elements,news=fm.querySelector('.tracking-new');
   function sync(){var isNew=el.invoice.value==='new',noInvoice=el.invoice.value==='unbilled';news.hidden=!isNew;el.num.required=isNew;el.amt.required=isNew;
    var tip=box.querySelector('.tracking-unbilled-tip');if(tip)tip.hidden=!noInvoice;
    var opt=el.invoice.selectedOptions[0];el.amount.value=noInvoice?'':isNew?(el.amt.value||''):(opt&&opt.dataset.rest||'');
    if(isNew)el.kind.value=invoiced?((total-invoiced)>0?'2':'1'):'0';}
   el.invoice.onchange=sync;el.amt.oninput=function(){if(el.invoice.value==='new')el.amount.value=el.amt.value;};
   el.kind.onchange=function(){if(el.kind.value==='0'&&!invoiced){el.amt.value=Math.round(total*pct)/100;el.amount.value=el.amt.value;}};
   sync();
   box.querySelectorAll('[data-open-receipt-link]').forEach(function(btn){btn.onclick=function(){var id=btn.dataset.openReceiptLink;box.querySelectorAll('details[data-receipt-link]').forEach(function(det){if(det.dataset.receiptLink===id){det.open=true;det.scrollIntoView({behavior:'smooth',block:'center'});var next=det.querySelector('select[name=linkInvoice]');if(next)next.focus({preventScroll:true});}});};});
   box.querySelectorAll('details[data-receipt-link]').forEach(function(det){
     var form=det.querySelector('form'),select=form.elements.linkInvoice,fields=form.querySelector('.tracking-new'),autoFields=form.querySelector('.tracking-auto');
     function update(){var fresh=select.value==='new',automatic=select.value==='auto';fields.hidden=!fresh;autoFields.hidden=!automatic;form.elements.num.required=fresh;form.elements.amt.required=fresh;form.elements.issued.required=fresh;form.querySelector('button[type=submit]').textContent=automatic?t('Générer et associer la facture','Generate and link invoice'):t('Valider et associer la facture','Confirm and link invoice');}
     select.onchange=update;update();
     form.querySelector('[data-preview-invoice]').onclick=function(){
       var note=form.querySelector('[role=status]'),receipt=d.receipts.find(function(x){return x.id===det.dataset.receiptLink;});
       if(!receipt||!form.elements.num.value.trim()||!form.elements.amt.value||Number(form.elements.amt.value)<Number(receipt.amount)){
         status(note,t('Renseignez un numéro et un montant corrects.','Enter a valid number and amount.'),true);return;
       }
       if(!global.DzoftInvoicePreview){status(note,t('Préparation PDF indisponible. Rechargez la page.','PDF preparation unavailable. Reload the page.'),true);return;}
       // Open synchronously from the click; Android Chrome blocks popups opened after an async request.
       var popup=global.open('about:blank','_blank');
       if(!popup){status(note,t('Autorisez la fenêtre d’aperçu.','Allow the invoice preview window.'),true);return;}
       var inv={num:form.elements.num.value.trim(),amt:Number(form.elements.amt.value),label:kinds[Number(form.elements.kind.value)][0]};
       sb.select('settings','select=payment&id=eq.1').catch(function(){return [];}).then(function(rows){
         var payment=rows&&rows[0]&&rows[0].payment||{};
         global.DzoftInvoicePreview.open({quote:q,receipt:receipt,invoice:inv,payment:payment,popup:popup});
         status(note,t('Aperçu ouvert. Enregistrez le PDF, puis confirmez son émission.','Preview opened. Save the PDF, then confirm issuance.'));
       }).catch(function(err){popup.close();status(note,err.message||t('Impossible de créer l’aperçu.','Could not prepare preview.'),true);});
     }
     form.onsubmit=function(e){
       e.preventDefault();
       var fresh=select.value==='new',automatic=select.value==='auto',btn=form.querySelector('button[type=submit]'),note=form.querySelector('[role=status]'),invoiceKey=fresh?crypto.randomUUID():select.value;
       if(automatic){
         if(!confirm(t('Émettre une facture officielle numérotée maintenant pour ce paiement ? Le numéro ne pourra pas être réutilisé. Vérifiez que DZOFT utilise une série de numérotation distincte de tout autre système de facturation.','Issue a permanently numbered official invoice for this payment now? Its number cannot be reused. Confirm DZOFT’s numbering series does not conflict with another invoicing system.')))return;
         btn.disabled=true;status(note,t('Génération du numéro et de la facture…','Issuing numbered invoice…'));
         sb.rpc('auto_issue_project_receipt_invoice',{p_quote:q.id,p_receipt:det.dataset.receiptLink,p_kind:['deposit','interim','final'][Number(form.elements.autoKind.value)]},true).then(function(out){
           var receipt=d.receipts.find(function(r){return r.id===det.dataset.receiptLink;});
           var kind=kinds[Number(form.elements.autoKind.value)][0];
           status(note,t('Facture n° ','Invoice no. ')+esc(out.number)+t(' émise. Archivage du PDF…',' issued. Archiving PDF…'));
           return archiveInvoice(q,sb,receipt,{id:out.invoice_id,num:out.number,amt:receipt.amount,n:kind,issuedOn:out.issued_on}).then(function(){
             status(note,t('Facture archivée et accessible au client.','Invoice archived and accessible to the client.'));
             setTimeout(reload,650);
           }).catch(function(err){
             status(note,t('Facture émise, mais PDF non archivé. Utilisez « Archiver le PDF » après actualisation. ','Invoice issued, but PDF not yet archived. Use “Archive invoice PDF” after refreshing. ')+(err.message||''),true);
             setTimeout(reload,2500);
           });
         }).catch(function(err){btn.disabled=false;status(note,friendly(err),true);});
         return;
       }
       if(fresh&&!form.elements.issued.checked){status(note,t('Confirmez d’abord que la facture officielle a été émise.','First confirm that the official invoice has been issued.'),true);return;}
       var data={p_quote:q.id,p_receipt:det.dataset.receiptLink,p_invoice:invoiceKey,p_new_invoice:fresh?{n:kinds[Number(form.elements.kind.value)][0],num:form.elements.num.value.trim(),amt:Number(form.elements.amt.value)}:null};
       btn.disabled=true;status(note,t('Association en cours…','Linking…'));
       sb.rpc('link_project_receipt_invoice',data,true).then(function(){
         status(note,t('Facture associée, sans double comptage. Joignez son PDF dans « Factures officielles et détails ».','Invoice linked without duplicate payment. Attach its PDF under “Official invoices and details”.'));
         setTimeout(reload,500);
       }).catch(function(err){btn.disabled=false;status(note,friendly(err),true);});
     };
   });
   fm.onsubmit=function(e){e.preventDefault();var b=fm.querySelector('button[type=submit]'),msg=box.querySelector(':scope > [role="status"]');var isNew=el.invoice.value==='new';
    var unbilled=el.invoice.value==='unbilled';
    var payload={p_quote:q.id,p_id:key,p_amount:Number(el.amount.value),p_date:el.date.value,p_method:el.method.value,p_reference:el.reference.value.trim(),p_notify:el.notify.checked};
    if(!unbilled){payload.p_invoice=isNew?newKey:el.invoice.value;payload.p_new_invoice=isNew?{n:kinds[+el.kind.value][0],num:el.num.value.trim(),amt:Number(el.amt.value)}:null;}
    b.disabled=true;status(msg,t('Enregistrement…','Saving…'));
    sb.rpc(unbilled?'record_project_payment_unbilled':'record_project_payment',payload,true).then(function(){
     key=crypto.randomUUID();newKey=crypto.randomUUID();status(msg,payload.p_notify?t('Paiement enregistré. E-mails mis en file d’envoi.','Payment recorded. Emails queued.'):t('Paiement enregistré, sans e-mail.','Payment recorded, no email sent.'));if(payload.p_notify)notify(sb);setTimeout(reload,1200);
    }).catch(function(err){b.disabled=false;status(msg,friendly(err),true);});};
   pub.innerHTML='<h2>'+t('Visibilité de l’avancement','Progress visibility')+'</h2>'+
    '<p class="tracking-help tracking-private-intro">'+t('Le journal privé et les brouillons GitHub ne sont pas visibles par le client. Seules vos mises à jour explicitement publiées ci-dessous sont partagées.','Private journal notes and GitHub drafts are not visible to the client. Only updates you explicitly publish below are shared.')+'</p>'+
    '<h3 class="tracking-shared-heading">'+t('Déjà partagé avec le client','Already shared with the client')+'</h3>'+updates(d)+
    '<details class="tracking-editor"><summary>'+t('＋ Préparer une mise à jour','＋ Prepare an update')+'</summary><form>'+
    '<div class="tracking-rows"></div><button class="btn tracking-add" type="button">'+t('＋ Ajouter un groupe','＋ Add a group')+'</button>'+
    '<p class="tracking-help">'+t('Vérifiez chaque réalisation et chaque statut. Un brouillon préparé automatiquement ne prouve ni une livraison, ni un test réussi.','Verify every achievement and status. An automatically prepared draft is not proof of delivery or successful testing.')+'</p>'+
    '<fieldset class="tracking-audience"><legend>'+t('Qui peut voir cette mise à jour ?','Who can see this update?')+'</legend>'+
    '<label><input type="radio" name="audience" value="private" checked> '+t('Moi uniquement — enregistrer un brouillon privé','Only me — save as private draft')+'</label>'+
    '<label><input type="radio" name="audience" value="client"> '+t('Partager au client et envoyer une notification','Share with the client and send a notification')+'</label></fieldset>'+
    '<label class="tracking-review-check" hidden><input type="checkbox" name="verified"> '+t('J’ai vérifié ces informations et je souhaite les partager avec le client.','I have verified these details and want to share them with the client.')+'</label>'+
    '<button class="btn main" type="submit" data-sharing-submit>'+t('Enregistrer le brouillon privé','Save private draft')+'</button></form></details>'+
    '<p role="status" aria-live="polite" class="tracking-message"></p>';
   var pf=pub.querySelector('form'),rows=pf.querySelector('.tracking-rows'),add=pf.querySelector('.tracking-add'),pk=crypto.randomUUID();
   function syncRows(){var list=rows.querySelectorAll('.tracking-row');list.forEach(function(r,i){r.querySelector('legend').textContent=t('Groupe ','Group ')+(i+1);r.querySelector('.tracking-remove').hidden=list.length<2;});add.hidden=list.length>=6;}
   var activeAutoHash=null;
   function prefill(items){rows.innerHTML='';items.forEach(function(u){var r=addRow();r.querySelector('[name=category]').value=u.category;r.querySelector('[name=status]').value=u.status;r.querySelector('[name=summary]').value=u.summary.trim().slice(0,220);});syncRows();}
   function offerAuto(doc){
     var old=pf.querySelector('.tracking-auto-draft');if(old)old.remove();
     if(!doc||!doc.configured||!Array.isArray(doc.updates)||!doc.updates.length||doc.source_hash===doc.published_hash)return;
     var box=document.createElement('div');box.className='tracking-auto-draft';
     var title=document.createElement('b');title.textContent=t('Brouillon GitHub préparé automatiquement','Automatically prepared GitHub draft');
     var explanation=document.createElement('p');explanation.textContent=t('Activité GitHub détectée dans '+doc.updates.length+' domaines. À vérifier avant de déclarer une livraison ou des tests.','GitHub activity found in '+doc.updates.length+' areas. Verify before claiming delivery or testing.');
     var use=document.createElement('button');use.type='button';use.className='btn sm line';use.textContent=t('Utiliser ce brouillon','Use this draft');
     use.onclick=function(){
       if(rows.dataset.edited==='true'&&!confirm(t('Remplacer les champs actuels par le brouillon GitHub ?','Replace current fields with the GitHub draft?')))return;
       prefill(doc.updates);activeAutoHash=doc.source_hash;rows.dataset.edited='false';
       use.textContent=t('Brouillon GitHub sélectionné ✓','GitHub draft selected ✓');
       var panel=pub.querySelector('details.tracking-editor');if(panel)panel.open=true;
     };
     box.append(title,explanation,use);pf.insertBefore(box,rows);
     // Never auto-select a GitHub draft: the owner must review it first.
   }
   function addRow(){var used={};rows.querySelectorAll('select[name=category]').forEach(function(s){used[s.value]=1;});var next=Object.keys(categories).filter(function(k){return !used[k];})[0]||'other';var r=document.createElement('fieldset');r.className='tracking-row';r.innerHTML='<legend></legend><div class="tracking-fields">'+field(t('Groupe','Group'),'<select name="category">'+options(categories)+'</select>')+field(t('État réel','Actual status'),'<select name="status">'+options(statuses)+'</select>')+'</div>'+field(t('Résumé pour le client','Client summary'),'<textarea name="summary" required maxlength="220" rows="3"></textarea>')+'<button class="tracking-remove" type="button">'+t('Retirer ce groupe','Remove this group')+'</button>';r.querySelector('select[name=category]').value=next;r.querySelector('.tracking-remove').onclick=function(){r.remove();syncRows();};rows.appendChild(r);syncRows();return r;}
   addRow();add.onclick=function(){addRow().querySelector('textarea').focus();rows.dataset.edited='true';activeAutoHash=null;};
   rows.addEventListener('input',function(){rows.dataset.edited='true';});
   rows.addEventListener('change',function(){rows.dataset.edited='true';});
   // A draft prepared from the private journal fills the form. Nothing is sent until the owner presses « Publier et notifier ».
   var draft=q.progress_draft&&Array.isArray(q.progress_draft.updates)?q.progress_draft.updates.filter(function(u){return u&&categories[u.category]&&statuses[u.status]&&typeof u.summary==='string'&&u.summary.trim();}).slice(0,6):[];
   function keepSteps(){var d=q.progress_draft||{};return Array.isArray(d.steps)&&d.steps.length?{prepared:d.prepared||null,steps:d.steps}:null;}
   function dropDraft(){var next=keepSteps();return sb.update('quotes',q.id,{progress_draft:next}).then(function(){q.progress_draft=next;});}
   if(draft.length){
    prefill(draft);
    var note=document.createElement('div');note.className='tracking-draft';
    var when=q.progress_draft.prepared?day(q.progress_draft.prepared):'';
    var text=document.createElement('p');text.textContent=t('Brouillon préparé à partir du journal'+(when?' le '+when:'')+'. Relisez, corrigez si besoin, puis publiez. Rien n’est envoyé au client avant.','Draft prepared from the journal'+(when?' on '+when:'')+'. Review, correct if needed, then publish. Nothing is sent to the client before that.');
    var skip=document.createElement('button');skip.type='button';skip.className='btn sm ghost';skip.textContent=t('Ignorer ce brouillon','Discard this draft');
    skip.onclick=function(){skip.disabled=true;dropDraft().then(function(){note.remove();rows.innerHTML='';addRow();},function(){skip.disabled=false;});};
    note.append(text,skip);pf.insertBefore(note,rows);pub.querySelector('details.tracking-editor').open=true;
   }
   function refreshAuto(){
     if(q.id!=='c8a50cee-3856-4539-98a3-f5df201dbff0')return Promise.resolve(null);
     return sb.rpc('owner_refresh_github_progress_draft',{p_quote:q.id},true).then(function(doc){
       if(pub.isConnected)offerAuto(doc);return doc;
     }).catch(function(err){var m=pub.querySelector('[role=status]');if(m)status(m,t('Brouillon GitHub non actualisé. ','GitHub draft unavailable. ')+(err.message||''),true);return null;});
   }
   global.DzoftTracking.refreshGithubDraft=refreshAuto;
   if(q.id==='c8a50cee-3856-4539-98a3-f5df201dbff0'){
     var refresh=document.createElement('button');refresh.type='button';refresh.className='btn sm line tracking-github-refresh';
     refresh.textContent=t('↻ Actualiser depuis GitHub','↻ Refresh from GitHub');
     refresh.onclick=function(){
       refresh.disabled=true;refresh.textContent=t('Synchronisation…','Syncing…');
       var task=global.DzoftGithubJournal&&global.DzoftGithubJournal.refresh?global.DzoftGithubJournal.refresh():refreshAuto();
       Promise.resolve(task).finally(function(){refresh.disabled=false;refresh.textContent=t('↻ Actualiser depuis GitHub','↻ Refresh from GitHub');});
     };
     pf.insertBefore(refresh,rows); // Opt-in only: do not refresh on view load.
   }
   var audience=pf.querySelectorAll('[name=audience]'),check=pf.querySelector('[name=verified]');
   function syncAudience(){
     var shared=pf.querySelector('[name=audience]:checked').value==='client';
     check.closest('label').hidden=!shared;
     pf.querySelector('[data-sharing-submit]').textContent=shared?
       t('Vérifier puis partager au client','Review and share with client'):
       t('Enregistrer le brouillon privé','Save private draft');
     if(!shared)check.checked=false;
   }
   audience.forEach(function(input){input.addEventListener('change',syncAudience);});syncAudience();
   pf.onsubmit=function(e){
     e.preventDefault();
     var b=pf.querySelector('button[type=submit]'),msg=pub.querySelector('[role=status]');
     var items=[].map.call(rows.querySelectorAll('.tracking-row'),function(r){return {
       category:r.querySelector('[name=category]').value,
       status:r.querySelector('[name=status]').value,
       summary:r.querySelector('[name=summary]').value.trim()};});
     if(items.some(function(i){return !i.summary;})){
       status(msg,t('Chaque groupe a besoin d’un résumé.','Each group needs a summary.'),true);return;
     }
     var shared=pf.querySelector('[name=audience]:checked').value==='client';
     if(!shared){
       b.disabled=true;status(msg,t('Enregistrement du brouillon privé…','Saving private draft…'));
       // Read the latest draft first to preserve separately prepared private milestones.
       sb.select('quotes','select=progress_draft&id=eq.'+encodeURIComponent(q.id)).then(function(found){
         var latest=found&&found[0]&&found[0].progress_draft||{};
         var next={prepared:new Date().toISOString(),updates:items};
         if(Array.isArray(latest.steps)&&latest.steps.length)next.steps=latest.steps;
         return sb.update('quotes',q.id,{progress_draft:next}).then(function(){
           q.progress_draft=next;draft=items.slice();
         });
       }).then(function(){
         b.disabled=false;rows.dataset.edited='false';
         status(msg,t('Brouillon enregistré. Le client ne voit rien et aucun e-mail n’a été envoyé.','Private draft saved. Nothing is visible to the client and no email was sent.'));
       }).catch(function(err){
         b.disabled=false;status(msg,t('Le brouillon n’a pas été enregistré : ','Private draft was not saved: ')+(err.message||''),true);
       });
       return;
     }
     if(!check.checked){
       status(msg,t('Cochez la confirmation après avoir vérifié tous les statuts.','Check the confirmation after verifying all statuses.'),true);
       return;
     }
     var preview=items.map(function(i){return label(categories,i.category)+' · '+label(statuses,i.status)+' : '+i.summary;}).join('\n\n');
     if(!confirm(t('Partager ces mises à jour dans l’espace client et envoyer une notification ?\\n\\n','Share these updates in the client portal and send a notification?\\n\\n')+preview))return;
     b.disabled=true;status(msg,t('Publication vers le client…','Publishing to the client…'));
     var viaAuto=!!activeAutoHash,action=viaAuto?'owner_publish_github_progress_draft':'publish_project_updates';
     var payload={p_quote:q.id,p_batch:pk,p_items:items};if(viaAuto)payload.p_hash=activeAutoHash;
     sb.rpc(action,payload,true).then(function(){
       if(draft.length&&!viaAuto){draft=[];var dn=pf.querySelector('.tracking-draft');if(dn)dn.remove();dropDraft().catch(function(){});}
       activeAutoHash=null;rows.innerHTML='';addRow();rows.dataset.edited='false';pk=crypto.randomUUID();b.disabled=false;
       check.checked=false;
       status(msg,t('Publié dans l’espace client. Un e-mail de notification est mis en file.','Published to the client portal. An email notification has been queued.'));
       notify(sb);setTimeout(reload,1200);
     }).catch(function(err){
       b.disabled=false;status(msg,t('Publication non confirmée. ','Publication not confirmed. ')+(err.message||''),true);
     });
   };
   // Existing invoice toggles cannot overwrite receipt-backed statuses.
   q._receiptInvoiceIds=d.receipts.map(function(r){return r.invoice_id;});lockInvoices(q);
  }).catch(function(err){console.error('DZOFT: project payment panel could not load or render',err);var paymentTruth=document.getElementById('iv-payment-truth');if(paymentTruth)paymentTruth.textContent=t('Paiements indisponibles pour le moment : ne pas considérer les factures comme réglées.','Payment data unavailable: do not assume invoices are paid.');if(box.isConnected)box.innerHTML='<p class="tracking-message error">'+t('Le suivi des paiements ne peut pas être affiché. Les paiements déjà enregistrés sont conservés. Rechargez la page.','Payment tracking cannot be displayed. Previously saved payments are preserved. Reload the page.')+'</p>';});
 }
 function archiveInvoice(q,sb,receipt,inv){
   if(!global.DzoftInvoicePdf)return Promise.reject(new Error('PDF generator unavailable; reload the page'));
   if(!q.client_id)return Promise.reject(new Error('Client account is missing'));
   // receipt is null for an invoice issued from the accepted quote or an approved change (no payment yet).
   if(!inv)return Promise.reject(new Error('Invoice unavailable'));
   return Promise.all([
     sb.select('clients','select=user_id&id=eq.'+encodeURIComponent(q.client_id)),
     sb.select('settings','select=payment&id=eq.1').catch(function(){return [];})
   ]).then(function(results){
     var rows=results[0],payment=results[1]&&results[1][0]&&results[1][0].payment||{};
     var uid=rows&&rows[0]&&rows[0].user_id;
     if(!uid||!/^[-0-9a-f]{36}$/i.test(uid))throw new Error('Le client doit disposer d’un compte DZOFT pour recevoir son PDF privé.');
     if(!/^F-[0-9]{4}-[0-9]+$/.test(inv.num))throw new Error('Invalid DZOFT invoice number');
     var pdf=global.DzoftInvoicePdf.build({quote:q,receipt:receipt,invoice:inv,payment:payment});
     var path='u/'+uid+'/factures/'+q.id+'/'+inv.num+'.pdf';
     return sb.files.upload(path,pdf).catch(function(err){if(err&&err.status===409)return;throw err;})
       .then(function(){return sb.rpc('attach_generated_invoice_pdf',{
          p_quote:q.id,p_invoice:inv.id,p_path:path,p_size:pdf.size
       },true);});
   });
  }
  function notify(sb){sb.fn('process-notification-outbox',{}).catch(function(){/* Durable queue retries; never report delivery without provider confirmation. */});}
 function client(sb){document.querySelectorAll('[data-project-tracking]').forEach(function(box){if(box.dataset.loading)return;box.dataset.loading='1';box.setAttribute('data-no-translate','');sb.rpc('project_tracking',{p_quote:box.dataset.projectTracking},true).then(function(d){if(box.isConnected)box.innerHTML='<h2>'+t('Paiements & avancement','Payments & progress')+'</h2>'+stats(d)+paymentStatuses(d,false)+receipts(d,false)+'<h3>'+t('Dernières avancées','Latest progress')+'</h3>'+updates(d);invoiceNotes(d);}).catch(function(){box.innerHTML='<p class="tracking-help">'+t('Connectez-vous ou rechargez la page pour consulter le suivi actualisé.','Sign in or reload to see the latest tracking information.')+'</p>';});});}
 function invoiceNotes(d){document.querySelectorAll('[data-invoice-id][data-invoice-total]').forEach(function(row){var amount=d.receipts.filter(function(r){return r.invoice_id===row.dataset.invoiceId;}).reduce(function(n,r){return n+cents(r.amount);},0)/100;if(!amount)return;var rest=Math.max(0,Number(row.dataset.invoiceTotal)-amount);var note=row.querySelector('.tracking-invoice-note');if(!note){note=document.createElement('p');note.className='tracking-invoice-note muted';note.setAttribute('data-no-translate','');row.appendChild(note);}note.textContent=t('Reçu et confirmé','Received and confirmed')+' '+money(amount)+' · '+t('Reste à régler sur cette facture','Remaining on this invoice')+' '+money(rest);var pill=row.querySelector('.pill');if(pill)pill.textContent=rest?t('Partiellement réglé','Partially paid'):t('Paiement reçu et confirmé','Payment received and confirmed');if(!rest){var report=row.querySelector('[data-report-payment]');if(report)report.hidden=true;}});}
 function lockInvoices(q){(q.invoices||[]).forEach(function(i,index){if((q._receiptInvoiceIds||[]).indexOf(i.id)<0)return;var row=document.querySelectorAll('#invs .invr')[index];if(row)row.querySelectorAll(i.generatedByDzoft?'.paid,.amt,.num,.n,.rm':'.paid,.amt,.num,.rm').forEach(function(el){el.disabled=true;el.title=t('Calculé depuis les paiements reçus','Calculated from recorded receipts');});});}
 function refreshClient(){if(document.visibilityState==='hidden')return;document.querySelectorAll('[data-project-tracking]').forEach(function(box){delete box.dataset.loading;});if(global.RDsb)client(global.RDsb);}
 window.addEventListener('focus',refreshClient);setInterval(refreshClient,30000);
 // Language switch: redraw in the new language (the page dictionary skips this card).
 document.addEventListener('dzoft:locale-change',function(){if(last&&document.getElementById('tracking-admin'))admin.apply(null,last);refreshClient();});
 global.DzoftTracking={admin:admin,client:client,lockInvoices:lockInvoices,archive:archiveInvoice};
})(window);
