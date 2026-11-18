const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
// Roland's business mailbox is Hotmail (Outlook.com): « Préparer l’e-mail » / « Mon e-mail » open it directly,
// never the computer's default mail app (which was Gmail) (18 Nov 2026).
test('admin e-mail buttons open Outlook.com compose, never mailto:',()=>{
 for(const f of ['admin/devis.html','admin/suivi.html']){
  const s=read(f);
  assert.ok(!/location\.href\s*=\s*'mailto:/.test(s),f+' still opens mailto:');
  assert.ok(s.includes("https://outlook.live.com/mail/0/deeplink/compose?to="),f);
  assert.match(s,/var w = window\.open\(url, '_blank'\);\n\s*if \(w\) w\.opener = null; else location\.href = url;/);
 }
});
