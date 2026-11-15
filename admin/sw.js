/* DZOFT Admin PWA: update-aware, privacy-preserving, network-first.
   Never cache Supabase responses, sessions, private HTML or client data.
   Cache only the small static OFFLINE notice for connectivity failures. */
var CACHE = 'dzoft-admin-offline-v20261115';
var OFFLINE = 'offline.html';

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.add(new Request(OFFLINE,{cache:'reload'}));
  }).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){
      return k.indexOf('dzoft-admin-')===0 && k!==CACHE;
    }).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET')return;
  var url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return; // Supabase/private APIs untouched.
  var isNavigate=e.request.mode==='navigate';
  var isAppAsset=/\.(?:js|css|html|webmanifest)$/.test(url.pathname);
  if(!isNavigate&&!isAppAsset)return;
  // Bypass browser disk cache on both installed PWA and laptop Chrome.
  // Do NOT persist HTML or runtime data in a Cache Storage cache.
  e.respondWith(fetch(new Request(e.request,{cache:'no-store'})).catch(function(err){
    if(!isNavigate)throw err;
    return caches.match(OFFLINE).then(function(fallback){
      if(fallback)return fallback;
      throw err;
    });
  }));
});
