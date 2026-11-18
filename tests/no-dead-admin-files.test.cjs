// Clean-up (18 Nov 2026): every admin script and style in the repository is loaded by a page. A file that no page
// loads is a leftover that can mislead whoever edits it later (e.g. the old workspace-panels-v6.js, replaced by v7).
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const pages=['admin/index.html','admin/suivi.html','admin/devis.html','admin/projet.html','admin/offline.html'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const scripts=fs.readdirSync(path.join(root,'admin')).filter(f=>/\.(js|css)$/.test(f)&&f!=='sw.js');
test('every admin script and stylesheet is loaded by an admin page',()=>{
 for(const f of scripts){
  const loadedByPage=pages.includes(f+'?')||pages.includes(f+'"');
  const loadedByScript=scripts.some(o=>o!==f&&fs.readFileSync(path.join(root,'admin',o),'utf8').includes(f));
  assert.ok(loadedByPage||loadedByScript,f+' is not loaded anywhere');
 }
});
test('the switched-off automatic redirect to the only project is gone',()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(root,'admin/index.html'),'utf8'),/routeToPrimaryWorkspace/);
});
