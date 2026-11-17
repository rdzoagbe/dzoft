/* DZOFT Admin release visibility and optional safe user-initiated refresh.
   The same script runs in desktop Chrome and the installed phone app.
   No user data or account identifiers leave the page. */
(function(){
'use strict';
var BUILD='2026.11.15.4';
var notice=null,checking=false;
function tr(fr,en){return document.documentElement.lang==='en'?en:fr;}
function check(){
 if(checking||!window.fetch)return;
 checking=true;
 fetch('release.json?check='+Date.now(),{cache:'no-store',credentials:'same-origin'})
  .then(function(r){if(!r.ok)throw new Error('release unavailable');return r.json();})
  .then(function(x){if(!x||typeof x.version!=='string')return;
     if(x.version!==BUILD)show();
     else if(notice){notice.remove();notice=null;}
  }).catch(function(){/* Do not interrupt the owner when offline. */})
    .then(function(){checking=false;});
}
function refresh(){
 // Reload is NEVER automatic while a customer form could have unsaved edits.
 var url=new URL(location.href);
 url.searchParams.set('dzoft_refresh',String(Date.now()));
 location.replace(url.href);
}
function show(){
 if(notice)return;
 notice=document.createElement('section');
 notice.id='dzoft-update-notice';notice.setAttribute('role','status');
 notice.style.cssText='position:fixed;z-index:9999;bottom:18px;right:18px;max-width:min(390px,calc(100vw - 36px));padding:16px 18px;border-radius:14px;background:#171622;color:white;box-shadow:0 12px 35px #0b102050;font:14px/1.5 system-ui;';
 var label=document.createElement('p');
 label.style.cssText='margin:0 0 9px;font-weight:700';
 label.textContent=tr('Une nouvelle version DZOFT est prête.','A new DZOFT version is ready.');
 var update=document.createElement('button');
 update.type='button';
 update.textContent=tr('Mettre à jour','Update now');
 update.style.cssText='border:0;border-radius:8px;padding:10px 14px;background:#fff;color:#20253a;cursor:pointer;font-weight:700;margin-right:8px';
 update.addEventListener('click',refresh);
 var later=document.createElement('button');later.type='button';
 later.textContent=tr('Plus tard','Later');
 later.style.cssText='border:0;padding:9px 6px;color:white;background:none;cursor:pointer';
 later.addEventListener('click',function(){notice.remove();notice=null;});
 notice.append(label,update,later);
 document.body.appendChild(notice);
}
function buildInfo(){
 var settings=document.getElementById('v-settings');
 if(!settings||document.getElementById('dzoft-build-info'))return;
 var info=document.createElement('p');info.id='dzoft-build-info';
 info.style.cssText='font-size:12px;color:#67718a;margin:20px 0;';
 info.textContent=tr('Version DZOFT : ','DZOFT version: ')+BUILD;
 settings.appendChild(info);
 var control=document.createElement('button');control.type='button';control.className='btn sm line';
 control.id='dzoft-check-updates';
 control.textContent=tr('Vérifier les mises à jour','Check for updates');
 settings.appendChild(control);
 var outcome=document.createElement('span');outcome.id='dzoft-update-status';
 outcome.style.cssText='font-size:12px;color:#67718a;margin-left:10px';
 settings.appendChild(outcome);
 control.addEventListener('click',function(){
   outcome.textContent=tr('Vérification…','Checking…');
   fetch('release.json?check='+Date.now(),{cache:'no-store',credentials:'same-origin'})
    .then(function(r){if(!r.ok)throw new Error('release unavailable');return r.json();})
    .then(function(x){if(x&&x.version===BUILD)outcome.textContent=tr('Vous utilisez la dernière version.','You have the latest version.');
      else{outcome.textContent=tr('Mise à jour disponible.','Update available.');show();}})
    .catch(function(){outcome.textContent=tr('Connexion indisponible.','Connection unavailable.');});
 });
}
function registerUpdater(){
 if(!('serviceWorker' in navigator))return;
 navigator.serviceWorker.ready.then(function(reg){
   // Read update on device launch/focus; new SW activates without caching private data.
   reg.update().catch(function(){});
 }).catch(function(){});
}
window.addEventListener('pageshow',function(){buildInfo();check();registerUpdater();});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check();});
window.addEventListener('focus',check);
document.addEventListener('dzoft:locale-change',function(){
 if(notice){notice.remove();notice=null;show();}
 var settings=document.getElementById('dzoft-build-info');
 if(settings)settings.textContent=tr('Version DZOFT : ','DZOFT version: ')+BUILD;
});
buildInfo();check();registerUpdater();
})();
