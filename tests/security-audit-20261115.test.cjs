const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('all mail Edge Functions pin a tested Supabase client dependency',()=>{
 for(const name of ['notify-client','sign-code','process-notification-outbox','payment-reminder']){
  const src=read('supabase/functions/'+name+'/index.ts');
  assert.match(src,/npm:@supabase\/supabase-js@2\.57\.4/,'Pinned dependency missing in '+name);
  assert.doesNotMatch(src,/npm:@supabase\/supabase-js@2["']/,'Floating @2 dependency in '+name);
 }
});

test('owner e-mail endpoint validates session/MFA and rejects oversized/invalid requests',()=>{
 const src=read('supabase/functions/notify-client/index.ts');
 assert.match(src,/db\.auth\.getUser\(token\)/);
 assert.match(src,/app_metadata\?\.dzoft_owner !== true/);
 assert.match(src,/authClaims\.aal !== "aal2"/);
 assert.match(src,/if \(announced > 8192\)/);
 assert.match(src,/if \(raw\.length > 8192\)/);
 assert.match(src,/JSON\.parse\(raw\)/);
 assert.match(src,/AbortSignal\.timeout\(12000\)/);
 assert.match(src,/Brevo transport temporarily unavailable/);
 assert.doesNotMatch(src,/return json\(\{ error: "Brevo a refusé l’envoi.*t\.slice/);
});

test('signature email remains token/client-scoped, rate-limited and provider errors are redacted',()=>{
 const src=read('supabase/functions/sign-code/index.ts');
 assert.match(src,/eq\("portal_token", b\.token\)\.is\("user_id", null\)/);
 assert.match(src,/u\.email_confirmed_at/);
 assert.match(src,/q\.client_id !== client\.id/);
 assert.match(src,/reserve_sign_code/);
 assert.match(src,/cancel_sign_code_reservation/);
 assert.match(src,/if \(announced > 8192\)/);
 assert.match(src,/if \(raw\.length > 8192\)/);
 assert.match(src,/AbortSignal\.timeout\(12000\)/);
 assert.doesNotMatch(src,/console\.error\("brevo", r\.status, \(await r\.text\(\)\)/);
 assert.match(src,/replace\(\/\[&<>"'\]\/g/);
});

test('backup script uses documented remote link flags, explicit project and protected local directory',()=>{
 const src=read('tools/backup_dzoft.py'),gitignore=read('.gitignore');
 assert.match(src,/\["link", "--project-ref", ref\]/);
 assert.match(src,/def select_remote_flags\(group:/);
 assert.match(src,/run_cli\(group \+ \["--help"\]\)/);
 assert.match(src,/return \["--remote=" \+ PROJECT_REF\] if explicit_ref else \["--remote"\]/);
 assert.match(src,/return \["--linked"\]/);
 assert.match(src,/raise BackupError\(/);
 assert.match(src,/dump_flags = select_remote_flags\(\["db", "dump"\], explicit_ref=True\)/);
 assert.match(src,/run_cli\(\["db", "dump"\] \+ dump_flags \+ \["--schema=public,private"\]\)/);
 assert.match(src,/storage_ls_flags = select_remote_flags\(\["storage", "ls"\]\)/);
 assert.match(src,/storage_cp_flags = select_remote_flags\(\["storage", "cp"\]\)/);
 assert.match(src,/cwd=PROJECT_ROOT/);
 assert.match(gitignore,/supabase\/\.temp\//);
 assert.match(gitignore,/supabase\/\.profiles\//);
 assert.match(gitignore,/\*\.dzoftbak/);
});

test('reviewed admin service worker uses network only for pages, never persists tokens or client records',()=>{
 const sw=read('admin/sw.js');
 assert.match(sw,/e\.request\.mode !== 'navigate'/);
 assert.match(sw,/e\.respondWith\(fetch\(e\.request\)\.catch/);
 assert.doesNotMatch(sw,/localStorage|supabase\.co\/rest\/v1|authorization.*cache|caches\.put/);
});
