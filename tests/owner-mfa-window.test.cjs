// 18 Nov 2026 (Roland's choice): the admin second factor is asked again every 7 days, the same everywhere.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('pages, shared client, server function and database all use 7 days',()=>{
 for(const page of ['admin/index.html','admin/suivi.html','admin/devis.html'])
  assert.match(read(page),/var MFA_WINDOW = 7 \* 24 \* 60 \* 60;/,page);
 const sb=read('admin/sb.js');
 assert.equal((sb.match(/mfaFresh\(7 \* 24 \* 60 \* 60\)/g)||[]).length,2);
 assert.match(read('supabase/functions/notify-client/index.ts'),/now - at <= 7 \* 24 \* 60 \* 60/);
 const mig=read('supabase/migrations/20261118080000_owner_mfa_window_7_days.sql');
 assert.match(mig,/between now\(\) - interval '7 days' and now\(\) \+ interval '2 minutes'/);
 // The code is still required: aal2 and a recent second factor, never just the owner marker.
 assert.match(mig,/coalesce\(\(select auth\.jwt\(\) ->> 'aal'\), 'aal1'\) = 'aal2'/);
 assert.match(read('supabase/schema.sql'),/between now\(\) - interval '7 days' and now\(\) \+ interval '2 minutes'/);
});
test('no 12-hour window is left anywhere',()=>{
 for(const f of ['admin/index.html','admin/suivi.html','admin/devis.html','admin/sb.js','supabase/functions/notify-client/index.ts'])
  assert.doesNotMatch(read(f),/12 \* 60 \* 60/,f);
 assert.doesNotMatch(read('supabase/schema.sql'),/interval '12 hours' and now\(\) \+ interval '2 minutes'/);
});
