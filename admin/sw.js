/* DZOFT admin app: installs the private space as a phone app.
   Privacy: nothing from Supabase (clients, quotes, sessions) is ever cached here.
   Only a small offline notice is kept, shown when a page cannot be reached. */
var CACHE = 'dzoft-admin-v1';
var OFFLINE = 'offline.html';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(OFFLINE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('dzoft-admin-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Page loads always go to the network; the offline notice is used only if the network fails.
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () { return caches.match(OFFLINE); }));
});
