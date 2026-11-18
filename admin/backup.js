/* DZOFT admin — « Sauvegarde des données » (18 Nov 2026).
   Save: the server exports the business records (owner + recent second factor only, public.owner_backup_export), the
   browser encrypts them with a password the owner chooses (PBKDF2-SHA-256, 310 000 rounds -> AES-256-GCM) and downloads
   one file. The password never leaves this page; without it the file is unreadable, so it can be kept on a USB stick,
   a cloud drive or sent by e-mail. Check: opens a backup file with its password and lists what it contains, locally.
   Nothing here can change or restore data on the server. */
(function(global){
'use strict';
var ITER=310000, MIN_PASS=10, FORMAT='dzoft-backup-encrypted';
var enc=new TextEncoder(), dec=new TextDecoder();
function $(id){return document.getElementById(id);}
function en(){return document.documentElement.lang==='en';}
function tr(fr,eng){return en()?eng:fr;}
function b64(buf){var s='',a=new Uint8Array(buf);for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s);}
function unb64(s){var bin=atob(s),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
function day(iso){try{return new Date(iso).toLocaleString(en()?'en-GB':'fr-FR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return iso;}}
function keyFrom(pass,salt,iter){
  return crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']).then(function(base){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter||ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);});
}
function encrypt(obj,pass){
  var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  return keyFrom(pass,salt).then(function(k){return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},k,enc.encode(JSON.stringify(obj)));})
   .then(function(ct){return {format:FORMAT,version:1,cipher:'AES-256-GCM',kdf:{name:'PBKDF2-SHA-256',iterations:ITER,salt:b64(salt)},iv:b64(iv),
     exported_at:obj.exported_at,data:b64(ct)};});
}
function decrypt(file,pass){
  if(!file||file.format!==FORMAT||!file.kdf||!file.iv||!file.data)return Promise.reject(new Error('format'));
  return keyFrom(pass,unb64(file.kdf.salt),Number(file.kdf.iterations)||ITER).then(function(k){return crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(file.iv)},k,unb64(file.data));})
   .then(function(pt){return JSON.parse(dec.decode(pt));});
}
var LABELS={leads:['Demandes','Requests'],clients:['Clients','Clients'],quotes:['Devis et projets','Quotes and projects'],
  messages:['Messages','Messages'],reviews:['Avis','Reviews'],notifications:['Notifications','Notifications'],
  project_receipts:['Paiements reçus','Payments received'],project_receipt_method_audit:['Historique des modes de paiement','Payment method history'],
  project_payment_statuses:['Paiements annoncés','Reported payments'],project_updates:['Avancées publiées','Published updates'],
  project_work_items:['Tâches','Tasks'],project_events:['Événements','Events'],email_outbox:['E-mails envoyés','E-mails sent'],
  dzoft_change_requests:['Suppléments','Extras'],dzoft_change_events:['Historique des suppléments','Extras history'],
  dzoft_credit_notes:['Avoirs','Credit notes'],settings:['Réglages','Settings'],invoice_registry:['Registre des factures','Invoice register']};
function countsTable(counts){
  return '<table class="backup-counts" data-no-translate><tbody>'+Object.keys(LABELS).filter(function(k){return k in (counts||{});}).map(function(k){
    return '<tr><th scope="row">'+tr(LABELS[k][0],LABELS[k][1])+'</th><td>'+Number(counts[k])+'</td></tr>';}).join('')+'</tbody></table>';
}
function bind(sb){
  var box=$('backup-box');if(!box||box.dataset.bound)return;box.dataset.bound='1';
  var status=$('backup-status'),msg=$('backup-msg'),check=$('backup-check-result');
  function refresh(){
    if(!status)return;
    sb.rpc('owner_backup_status',{},true).then(function(s){
      s=s||{};var last=s.last_backup_at;
      status.textContent=last?tr('Dernière sauvegarde : ','Last backup: ')+day(last):tr('Aucune sauvegarde pour l’instant.','No backup yet.');
      status.className='backup-status '+(!last||(s.last_change_at&&s.last_change_at>last)?'is-due':'is-ok');
    },function(){status.textContent=tr('Date de la dernière sauvegarde indisponible.','Last backup date unavailable.');});
  }
  refresh();
  $('backup-save').addEventListener('click',function(){
    var b=this,p1=$('backup-pass').value,p2=$('backup-pass2').value;msg.textContent='';
    if(p1.length<MIN_PASS){msg.textContent=tr('Choisissez un mot de passe d’au moins '+MIN_PASS+' caractères.','Choose a password of at least '+MIN_PASS+' characters.');return;}
    if(p1!==p2){msg.textContent=tr('Les deux mots de passe ne sont pas identiques.','The two passwords do not match.');return;}
    b.disabled=true;b.textContent=tr('Préparation…','Preparing…');
    sb.rpc('owner_backup_export',{},true).then(function(data){return encrypt(data,p1).then(function(file){return [data,file];});}).then(function(x){
      var data=x[0],file=x[1],name='dzoft-sauvegarde-'+String(data.exported_at||new Date().toISOString()).slice(0,10)+'.dzoftbak';
      var url=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/octet-stream'}));
      var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},4000);
      // Recorded only now that the encrypted file exists and was handed to the browser: a failed export or
      // encryption never counts as a backup, so the dashboard reminder stays.
      sb.rpc('owner_backup_confirm',{p_counts:data.counts||{}},true).then(refresh,refresh);
      $('backup-pass').value=$('backup-pass2').value='';
      msg.innerHTML=tr('Sauvegarde téléchargée : <b>','Backup downloaded: <b>')+name+'</b>. '+tr('Gardez-la hors de cet ordinateur (clé USB, Drive…) et notez le mot de passe : sans lui, personne ne peut l’ouvrir, pas même DZOFT.','Keep it off this computer (USB stick, Drive…) and write down the password: without it nobody can open it, not even DZOFT.')+countsTable(data.counts);
    },function(e){msg.textContent=tr('Sauvegarde impossible : ','Backup failed: ')+((e&&e.message)||'erreur')+tr('. Reconnectez-vous avec votre code si besoin, puis réessayez.','. Sign in again with your code if needed, then try again.');})
    .then(function(){b.disabled=false;b.textContent=tr('Télécharger la sauvegarde chiffrée','Download the encrypted backup');});
  });
  $('backup-verify').addEventListener('click',function(){
    var f=$('backup-file').files[0],p=$('backup-check-pass').value;check.textContent='';
    if(!f){check.textContent=tr('Choisissez un fichier de sauvegarde.','Choose a backup file.');return;}
    var r=new FileReader();r.onload=function(){
      var file;try{file=JSON.parse(r.result);}catch(e){check.textContent=tr('Ce fichier n’est pas une sauvegarde DZOFT.','This file is not a DZOFT backup.');return;}
      decrypt(file,p).then(function(data){
        if(!data||data.format!=='dzoft-backup'){check.textContent=tr('Ce fichier n’est pas une sauvegarde DZOFT.','This file is not a DZOFT backup.');return;}
        check.innerHTML='<b>✓ '+tr('Sauvegarde lisible','Backup readable')+'</b> · '+tr('faite le ','made on ')+day(data.exported_at)+countsTable(data.counts);
      },function(e){check.textContent=e&&e.message==='format'?tr('Ce fichier n’est pas une sauvegarde DZOFT.','This file is not a DZOFT backup.'):tr('Mot de passe incorrect ou fichier abîmé.','Wrong password or damaged file.');});
    };r.readAsText(f);
  });
}
global.DzoftBackup={bind:bind,encrypt:encrypt,decrypt:decrypt};
})(window);
