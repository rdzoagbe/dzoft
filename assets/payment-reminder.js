(function () {
  'use strict';
  var busy = false;
  var en = function () { return document.documentElement.lang === 'en'; };
  var t = function (fr, eng) { return en() ? eng : fr; };
  var escape = function (v) { return String(v || '').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var errorText = function (message) { if (!en()) return message; var errors = {
    'Ajoutez d’abord une facture impayée avec son numéro officiel et son montant dans la fiche projet.':'First add an unpaid invoice with its official number and amount to the project record.',
    'Le devis doit être accepté et visible dans l’espace client.':'The quote must be accepted and visible in the client workspace.',
    'Une relance a déjà été préparée ou envoyée par ce canal dans les 30 dernières minutes. Vérifiez l’historique avant de recommencer.':'A reminder was already prepared or sent through this channel in the last 30 minutes. Check the history before trying again.',
    'Session administrateur expirée : reconnectez-vous':'Your admin session has expired. Please sign in again.',
    'Ajoutez l’adresse e-mail à la fiche client.':'Add an email address to the client record.',
    'PDF indisponible ou supérieur à 7 Mo':'The PDF is unavailable or larger than 7 MB.',
    'PDF privé indisponible':'The private PDF is unavailable.',
    'Relance déjà en cours ou journal indisponible.':'A reminder is already being processed, or the activity log is unavailable.',
    'Traitement en cours — résultat à vérifier':'Processing — check the result',
    'Service e-mail non configuré':'The email service is not configured.'
  }; return errors[message] || 'Unable to complete this action. Check the invoice details and your connection, then try again.'; };
  window.DzoftReminder = { open: async function (quoteId, invoiceId) {
    if (document.getElementById('payment-reminder')) return;
    var dialog = document.createElement('dialog'); dialog.id = 'payment-reminder';
    dialog.style.cssText = 'width:min(580px,calc(100vw - 32px));max-height:90vh;overflow:auto;border:1px solid #cbd5e1;border-radius:20px;padding:24px;color:#172033;background:#fff;box-sizing:border-box';
    dialog.innerHTML = '<h2>' + t('Relance de paiement','Payment reminder') + '</h2><div data-content role="status">' + t('Chargement…','Loading…') + '</div><p><button type="button" class="btn line" data-close>' + t('Fermer','Close') + '</button></p>';
    document.body.appendChild(dialog); dialog.showModal();
    dialog.querySelector('[data-close]').onclick = function(){if(!busy) dialog.close();};
    dialog.addEventListener('cancel',function(e){if(busy)e.preventDefault();});
    dialog.addEventListener('close',function(){dialog.remove();});
    var box=dialog.querySelector('[data-content]'); var messageLanguage=en()?'en':'fr';
    var call=function(action,extra){return window.RDsb.fn('payment-reminder',Object.assign({action:action,quote_id:quoteId,invoice_id:invoiceId,lang:messageLanguage},extra||{}));};
    async function load(){
      try {
        var p=await call('preview'); invoiceId=p.invoice_id;
        box.innerHTML='<p><b>'+escape(p.client)+'</b> · '+escape(p.amount)+'</p><label>'+(p.deposit_only?t('Acompte prévu au devis accepté','Deposit from the accepted quote'):t('Facture','Invoice'))+'<select data-invoice style="width:100%">'+p.invoices.map(function(i){return '<option value="'+escape(i.id)+'"'+(i.id===invoiceId?' selected':'')+'>'+escape(i.label)+'</option>';}).join('')+'</select></label>'+
          '<p><label><input type="checkbox" data-email '+(p.email?'checked':'disabled')+'> E-mail · '+escape(p.email||t('Adresse manquante dans la fiche client','Add an email to the client record'))+'</label></p>'+
          '<p><label><input type="checkbox" data-wa> WhatsApp</label></p><label>'+t('Numéro WhatsApp du client (+33…)','Client WhatsApp number (+33…)')+'<input data-phone type="tel" value="'+escape(p.phone?('+'+p.phone):'')+'" style="width:100%;box-sizing:border-box"></label>'+
          '<p style="font-size:13px">'+t('WhatsApp utilise le compte connecté sur cet appareil. Vérifiez qu’il s’agit de votre numéro professionnel, puis appuyez sur Envoyer dans WhatsApp.','WhatsApp uses the account signed in on this device. Check that it is your business number, then tap Send in WhatsApp.')+'</p>'+
          '<label>'+t('Langue du message','Message language')+'<select data-message-language><option value="fr"'+(messageLanguage==='fr'?' selected':'')+'>Français</option><option value="en"'+(messageLanguage==='en'?' selected':'')+'>English</option></select></label><label>'+t('Message au client','Client message')+'<textarea data-message maxlength="3000" rows="7" style="width:100%;box-sizing:border-box">'+escape(p.message)+'</textarea></label>'+
          '<p><label><input type="checkbox" data-pdf '+(p.has_pdf?'checked':'disabled')+'> '+t('Joindre le PDF à l’e-mail (si disponible, 7 Mo max.)','Attach invoice PDF to email (if available, max. 7 MB)')+'</label></p>'+
          '<button type="button" class="btn main" data-send>'+t('Envoyer la relance','Send reminder')+'</button><p data-result role="status" style="white-space:pre-wrap"></p><h3>'+t('Dernières relances','Recent reminders')+'</h3><div>'+ (p.history.length?p.history.map(function(h){return '<p style="font-size:13px">'+escape(new Date(h.created_at).toLocaleString())+' · '+(h.kind==='payment_whatsapp'?'WhatsApp': 'E-mail')+' · '+escape(h.kind==='payment_whatsapp'&&h.ok?t('Préparé, envoi à confirmer dans WhatsApp','Prepared; confirm sending in WhatsApp'):h.ok?t('Accepté par le service e-mail (réception non confirmée)','Accepted by email service (delivery not confirmed)'):errorText(h.error))+'</p>';}).join(''):t('Aucune relance.','No reminders yet.'))+'</div>';
        box.querySelector('[data-message-language]').onchange=function(e){messageLanguage=e.target.value;load();};
        box.querySelector('[data-invoice]').onchange=function(e){invoiceId=e.target.value;load();};
        box.querySelector('[data-send]').onclick=async function(){
          if(busy)return;
          var email=box.querySelector('[data-email]').checked, wa=box.querySelector('[data-wa]').checked;
          var status=box.querySelector('[data-result]');
          if(!email&&!wa){status.textContent=t('Choisissez au moins un canal.','Select at least one channel.');return;}
          var number=box.querySelector('[data-phone]').value;
          if(wa&&!/^\+?[1-9][\d\s().-]{7,20}$/.test(number)){status.textContent=t('Indiquez le numéro WhatsApp avec son indicatif (+33…).','Enter the WhatsApp number including country code (+33…).');return;}
          var message=box.querySelector('[data-message]').value.trim();
          if(!message){status.textContent=t('Ajoutez un message.','Enter a message.');return;}
          var attach=box.querySelector('[data-pdf]').checked;
          // Reserve a window during the user gesture; asynchronous requests otherwise trigger popup blockers.
          var popup=wa?window.open('about:blank','_blank'):null;
          if(popup)popup.opener=null;
          busy=true; var controls=Array.from(dialog.querySelectorAll('button,input,textarea,select'));controls.forEach(function(el){el.disabled=true;});
          status.textContent=t('Traitement…','Processing…');var results=[];
          try {
            if(email){try{var sent=await call('email',{message:message,attach_pdf:attach});results.push(sent.warning||t('E-mail accepté par le service d’envoi.','Email accepted by the sending service.'));}catch(e){results.push('E-mail : '+errorText(e.message));}}
            if(wa){try{var prepared=await call('whatsapp',{message:message,phone:number});if(popup){popup.location.href=prepared.url;results.push(t('WhatsApp ouvert : appuyez sur Envoyer pour terminer.','WhatsApp opened: tap Send to finish.'));}else{var a=document.createElement('a');a.href=prepared.url;a.target='_blank';a.rel='noopener';a.textContent=t('Ouvrir WhatsApp et envoyer','Open WhatsApp and send');status.after(a);results.push(t('Utilisez le lien WhatsApp ci-dessous.','Use the WhatsApp link below.'));}}catch(e){if(popup)popup.close();results.push('WhatsApp : '+errorText(e.message));}}
          } finally {busy=false;status.textContent=results.join('\n');dialog.querySelector('[data-close]').disabled=false;}
          // Reopen to re-check invoice state and history; never silently resend a successful channel.
        };
      } catch(e){box.textContent=errorText(e.message);var link=document.createElement('a');link.href='suivi.html?q='+encodeURIComponent(quoteId);link.textContent=t('Ouvrir la fiche projet et les factures','Open project and invoices');box.appendChild(document.createElement('br'));box.appendChild(link);}
    }
    await load();
  }};
})();
