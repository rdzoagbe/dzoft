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
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
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
/* Google Drive (18 Nov 2026): « Sauvegarder sur Google Drive » sends the same encrypted file straight to the owner's
   Drive, in a folder « DZOFT – Sauvegardes ». Google's own sign-in window asks for permission the first time
   (scope drive.file: the app only sees the files it creates, never the rest of the Drive). The Google client ID is
   public by design and kept in settings (owner only). Nothing is stored on this device; the password never leaves it. */
var GIS='https://accounts.google.com/gsi/client', DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
var FOLDER='DZOFT – Sauvegardes', CLIENT_ID_RE=/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
var gisLoading=null, tokenClient=null, tokenClientId='', pendingToken=null;
function loadGis(){
  if(global.google&&global.google.accounts&&global.google.accounts.oauth2)return Promise.resolve();
  if(gisLoading)return gisLoading;
  gisLoading=new Promise(function(ok,ko){var sc=document.createElement('script');sc.src=GIS;sc.async=true;sc.onload=ok;
    sc.onerror=function(){gisLoading=null;ko(new Error('google-script'));};document.head.appendChild(sc);});
  return gisLoading;
}
// Must run inside the click itself (browsers only open Google's window from a click).
function askToken(clientId){
  return new Promise(function(ok,ko){
    var o=global.google&&global.google.accounts&&global.google.accounts.oauth2;
    if(!o){ko(new Error('google-not-ready'));return;}
    if(!tokenClient||tokenClientId!==clientId){
      tokenClientId=clientId;
      tokenClient=o.initTokenClient({client_id:clientId,scope:DRIVE_SCOPE,
        callback:function(r){var p=pendingToken;pendingToken=null;if(!p)return;if(r&&r.access_token)p.ok(r.access_token);else p.ko(new Error((r&&r.error)||'google-denied'));},
        error_callback:function(e){var p=pendingToken;pendingToken=null;if(p)p.ko(new Error((e&&e.type)||'google-closed'));}});
    }
    pendingToken={ok:ok,ko:ko};
    tokenClient.requestAccessToken({prompt:''});
  });
}
function drive(token,url,opt){
  opt=opt||{};opt.headers=Object.assign({Authorization:'Bearer '+token},opt.headers||{});
  return fetch(url,opt).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('drive-'+r.status+(t?': '+t.slice(0,160):''));});return r.json();});
}
function folderId(token){
  var q=encodeURIComponent("name='"+FOLDER+"' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  return drive(token,'https://www.googleapis.com/drive/v3/files?q='+q+'&fields=files(id)&spaces=drive').then(function(r){
    if(r.files&&r.files[0])return r.files[0].id;
    return drive(token,'https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:FOLDER,mimeType:'application/vnd.google-apps.folder'})}).then(function(f){return f.id;});
  });
}
function uploadFile(token,parent,name,text){
  var boundary='dzoft'+Math.random().toString(36).slice(2);
  var body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+
    JSON.stringify({name:name,parents:[parent],mimeType:'application/octet-stream',description:'Sauvegarde DZOFT chiffrée (AES-256-GCM). Ouvrir avec « Vérifier une sauvegarde » et son mot de passe.'})+
    '\r\n--'+boundary+'\r\nContent-Type: application/octet-stream\r\n\r\n'+text+'\r\n--'+boundary+'--';
  return drive(token,'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:body});
}
function fileName(data){return 'dzoft-sauvegarde-'+String(data.exported_at||new Date().toISOString()).slice(0,19).replace(/[:T]/g,'-')+'.dzoftbak';}
function bind(sb){
  var box=$('backup-box');if(!box||box.dataset.bound)return;box.dataset.bound='1';
  var status=$('backup-status'),msg=$('backup-msg'),check=$('backup-check-result'),clientId='';
  function refresh(){
    if(!status)return;
    sb.rpc('owner_backup_status',{},true).then(function(s){
      s=s||{};var last=s.last_backup_at;
      status.textContent=last?tr('Dernière sauvegarde : ','Last backup: ')+day(last):tr('Aucune sauvegarde pour l’instant.','No backup yet.');
      status.className='backup-status '+(!last||(s.last_change_at&&s.last_change_at>last)?'is-due':'is-ok');
    },function(){status.textContent=tr('Date de la dernière sauvegarde indisponible.','Last backup date unavailable.');});
  }
  function showDrive(){
    var ready=CLIENT_ID_RE.test(clientId);
    $('backup-drive').hidden=!ready;$('backup-drive-setup').open=!ready;
    $('backup-drive-state').textContent=ready?tr('Google Drive est relié : la sauvegarde part dans le dossier « ','Google Drive is linked: backups go to the folder “')+FOLDER+tr(' ».','”.'):tr('Google Drive n’est pas encore relié (réglage unique ci-dessous).','Google Drive is not linked yet (one-time setting below).');
    $('backup-save').className='btn '+(ready?'line':'main');
    if(ready)loadGis().catch(function(){});
  }
  sb.select('settings','select=google_client_id&id=eq.1').then(function(r){clientId=(r&&r[0]&&r[0].google_client_id)||'';$('backup-drive-client').value=clientId;showDrive();},function(){showDrive();});
  refresh();
  function passOk(){
    var p1=$('backup-pass').value,p2=$('backup-pass2').value;msg.textContent='';
    if(p1.length<MIN_PASS){msg.textContent=tr('Choisissez un mot de passe d’au moins '+MIN_PASS+' caractères.','Choose a password of at least '+MIN_PASS+' characters.');return null;}
    if(p1!==p2){msg.textContent=tr('Les deux mots de passe ne sont pas identiques.','The two passwords do not match.');return null;}
    return p1;
  }
  // The one encrypted file, whatever its destination.
  function build(pass){
    return sb.rpc('owner_backup_export',{},true).then(function(data){return encrypt(data,pass).then(function(file){return {data:data,name:fileName(data),text:JSON.stringify(file)};});});
  }
  // Recorded only once the encrypted file exists and has been handed over (download or Drive): a failed export,
  // encryption or upload never counts as a backup, so the dashboard reminder stays.
  function done(b,html){
    sb.rpc('owner_backup_confirm',{p_counts:b.data.counts||{}},true).then(refresh,refresh);
    $('backup-pass').value=$('backup-pass2').value='';
    msg.innerHTML=html+countsTable(b.data.counts);
  }
  function failed(e){
    var m=(e&&e.message)||'erreur';
    if(/^google-(denied|closed|access_denied|popup)/.test(m)||/access_denied|popup_closed/.test(m))msg.textContent=tr('Google n’a pas donné l’accès (fenêtre fermée ou refusée). Rien n’a été enregistré ; réessayez quand vous voulez.','Google did not grant access (window closed or refused). Nothing was saved; try again whenever you like.');
    else if(m==='google-not-ready'||m==='google-script')msg.textContent=tr('Google n’a pas encore fini de se charger : réessayez dans quelques secondes.','Google has not finished loading yet: try again in a few seconds.');
    else msg.textContent=tr('Sauvegarde impossible : ','Backup failed: ')+m+tr('. Rien n’a été enregistré ; reconnectez-vous avec votre code si besoin, puis réessayez.','. Nothing was saved; sign in again with your code if needed, then try again.');
  }
  $('backup-save').addEventListener('click',function(){
    var btn=this,pass=passOk();if(!pass)return;
    btn.disabled=true;var label=btn.textContent;btn.textContent=tr('Préparation…','Preparing…');
    build(pass).then(function(b){
      var url=URL.createObjectURL(new Blob([b.text],{type:'application/octet-stream'}));
      var a=document.createElement('a');a.href=url;a.download=b.name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},4000);
      done(b,tr('Sauvegarde téléchargée : <b>','Backup downloaded: <b>')+esc(b.name)+'</b>. '+tr('Gardez-la hors de cet ordinateur (clé USB, Drive…) et notez le mot de passe : sans lui, personne ne peut l’ouvrir, pas même DZOFT.','Keep it off this computer (USB stick, Drive…) and write down the password: without it nobody can open it, not even DZOFT.'));
    },failed).then(function(){btn.disabled=false;btn.textContent=label;});
  });
  $('backup-drive').addEventListener('click',function(){
    var btn=this,pass=passOk();if(!pass)return;
    // Google's script missing (e.g. a brief network failure): start loading it again, so the next click can work.
    if(!(global.google&&global.google.accounts&&global.google.accounts.oauth2))loadGis().catch(function(){});
    var tokenP;try{tokenP=askToken(clientId);}catch(e){tokenP=Promise.reject(e);}
    btn.disabled=true;var label=btn.textContent;btn.textContent=tr('Envoi vers Google Drive…','Sending to Google Drive…');
    tokenP.then(function(token){
      return build(pass).then(function(b){
        return folderId(token).then(function(parent){return uploadFile(token,parent,b.name,b.text);}).then(function(f){
          done(b,'<b>✓ '+tr('Sauvegarde enregistrée dans Google Drive','Backup saved to Google Drive')+'</b> : '+esc(f.name||b.name)+
            (f.webViewLink&&/^https:\/\/drive\.google\.com\//.test(f.webViewLink)?' · <a href="'+esc(f.webViewLink)+'" target="_blank" rel="noopener noreferrer">'+tr('Ouvrir dans Drive','Open in Drive')+'</a>':'')+
            '. '+tr('Notez bien le mot de passe : sans lui, personne ne peut ouvrir le fichier, pas même DZOFT.','Keep the password safe: without it nobody can open the file, not even DZOFT.'));
        });
      });
    }).catch(failed).then(function(){btn.disabled=false;btn.textContent=label;});
  });
  $('backup-drive-save').addEventListener('click',function(){
    var v=$('backup-drive-client').value.trim(),m=$('backup-drive-msg');
    if(v&&!CLIENT_ID_RE.test(v)){m.textContent=tr('Cet identifiant ne ressemble pas à un « ID client » Google (…apps.googleusercontent.com).','This does not look like a Google “Client ID” (…apps.googleusercontent.com).');return;}
    sb.update('settings',1,{google_client_id:v||null,updated_at:new Date().toISOString()}).then(function(){
      clientId=v;tokenClient=null;m.textContent=v?tr('Google Drive relié ✓','Google Drive linked ✓'):tr('Lien Google Drive retiré.','Google Drive link removed.');showDrive();
    },function(e){m.textContent=tr('Enregistrement impossible : ','Could not save: ')+((e&&e.message)||'erreur');});
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
