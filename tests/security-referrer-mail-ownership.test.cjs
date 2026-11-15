const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('private admin and quote screens do not leak URLs to third-party Referer requests',()=>{
 for(const p of ['admin/index.html','admin/devis.html','admin/suivi.html','espace/index.html']){
  const html=read(p);
  assert.match(html,/<meta name="referrer" content="no-referrer">/,p);
  assert.match(html,/<meta name="robots" content="noindex, nofollow">/,p);
 }
});

test('outbound client email cannot pair one project with a different customer',()=>{
 const src=read('supabase/functions/notify-client/index.ts');
 assert.match(src,/const clientId = q \? q\.client_id : suppliedClientId/);
 assert.match(src,/q && suppliedClientId && q\.client_id !== suppliedClientId/);
 assert.match(src,/kind !== "message" && !quoteId/);
 assert.match(src,/\.is\("deleted_at", null\)\.maybeSingle\(\)/);
 assert.match(src,/if \(error\) return json\(\{ error: "vérification du devis indisponible" \}, 503\)/);
 assert.match(src,/if \(clientError\) return json\(\{ error: "vérification du client indisponible" \}, 503\)/);
 assert.match(src,/db\.auth\.getUser\(token\)/);
 assert.match(src,/app_metadata\?\.dzoft_owner !== true/);
 assert.match(src,/hasRecentTotp\(authClaims\)/);
});
