const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
// Two elements with the same id make one of them unreachable: « Coller une demande » once opened the sign-in
// « Paste copied code » button instead of its window, so its Cancel did nothing (fixed 21 Nov 2026).
test('static ids are unique on each page',()=>{
 for(const f of ['admin/index.html','admin/suivi.html','admin/devis.html','index.html','devis.html','en/quote.html']){
  const s=fs.readFileSync(path.join(__dirname,'..',f),'utf8'),seen={},dup=[];
  for(const m of s.matchAll(/\bid="([A-Za-z][\w-]*)"/g)){if(seen[m[1]])dup.push(m[1]);seen[m[1]]=1;}
  assert.deepEqual(dup,[],f+' has duplicate ids');
 }
});
