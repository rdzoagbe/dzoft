const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('desktop Chrome and installed phone have the same current release controls',()=>{
 const main=read('admin/index.html'),project=read('admin/suivi.html');
 for(const html of [main,project]){
  assert.match(html,/update-notice\.js\?v=20261119-locale2/);
  assert.match(html,/workspace-flow\.css\?v=(?:20261115-update4|20261117-blue)/);
  assert.match(html,/updateViaCache: 'none'/);
 }
 const script=read('admin/update-notice.js');
 const release=JSON.parse(read('admin/release.json'));
 assert.equal(release.version,'2026.11.19.1');
 assert.match(script,/BUILD='2026\.11\.19\.1'/);
 assert.match(script,/function isNewer\(remote,local\)/);
 assert.match(script,/Version publiée vérifiée/);
 assert.match(script,/cache:'no-store'/);
 assert.match(script,/dzoft-check-updates/);
 assert.match(script,/function localizeBuildInfo\(\)/);
 assert.match(script,/function setOutcome\(code\)/);
 assert.match(script,/localizeBuildInfo\(\);/);
 assert.match(script,/location\.replace\(url\.href\)/);
 assert.doesNotMatch(script,/localStorage|sessionStorage|service_role|sb\.rpc|supabase\.co/);
 new vm.Script(script,{filename:'admin/update-notice.js'});
});

test('admin service worker bypasses disk cache but never stores client pages or API payloads',()=>{
 const sw=read('admin/sw.js');
 assert.match(sw,/cache:'no-store'/);
 assert.match(sw,/e\.request\.mode==='navigate'/);
 assert.match(sw,/url\.origin!==self\.location\.origin/);
 assert.match(sw,/caches\.open\(CACHE\)/);
 assert.match(sw,/c\.add\(new Request\(OFFLINE/);
 assert.doesNotMatch(sw,/c\.put\(|cache\.put\(|c\.addAll\(|localStorage|supabase\.co/);
 new vm.Script(sw,{filename:'admin/sw.js'});
});

test('invoice has visible calculation breakdown, reversible pre-issue review and official correction guidance',()=>{
 const html=read('admin/suivi.html');
 assert.match(html,/id="iv-explanation"/);
 assert.match(html,/Pourquoi cette facture fait/);
 assert.match(html,/Devis accepté.*?factures d’acompte/);
 assert.match(html,/data-iv="final" disabled>Vérifier le montant/);
 assert.match(html,/data-invoice-review/);
 assert.match(html,/data-iv="cancel">Annuler le brouillon/);
 assert.match(html,/data-iv="confirm">Confirmer et émettre officiellement/);
 assert.match(html,/Aucun numéro n’a été créé pour l’instant/);
 assert.match(html,/rev\.dataset\.amount !== value\.toFixed\(2\)/);
 assert.match(html,/Corriger ou annuler une facture émise/);
 assert.match(html,/document rectificatif/);
 assert.match(html,/un avoir/);
 assert.match(html,/issue_final_invoice_checked/);
 assert.match(html,/issue_interim_invoice/);
 assert.match(html,/if \(!confirm\(ask\)\) return/);
 assert.match(html,/invoice-workflow\.css\?v=(?:20261115-update4|20261115-receipt-card2|20261117-blue)/);
 const css=read('admin/invoice-workflow.css');
 assert.match(css,/invoice-draft-review\[hidden\]\{display:none!important\}/);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(m[1].trim())new vm.Script(m[1],{filename:'admin/suivi.html'});
 }
});
