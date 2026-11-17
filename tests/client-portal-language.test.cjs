// Client area language rules (17 Nov 2026): English everywhere in the interface,
// French kept for the binding documents (quote, signature wording, terms).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../espace/index.html'),'utf8');
const tracking=fs.readFileSync(path.join(__dirname,'../assets/project-tracking.js'),'utf8');

test('the current screen is redrawn when the language changes',()=>{
 assert.match(html,/if \(first\) syncLanguage\(\); else saveLanguage\(\);\n    route\(\);/,'redraw on every change; the first announcement applies, never saves');
 assert.match(html,/e\.isTrusted && e\.target\.closest/,'only a real click counts as the client\'s choice');
 assert.match(html,/if \(!D \|\| !D\.lang \|\| !langReady\) return;/);
 assert.match(html,/function L\(fr, en\)\{ return EN\(\) \? en : fr; \}/);
});

test('the quote document is always rendered in French and skipped by the page dictionary',()=>{
 assert.match(html,/function quoteView\(q\)\{ forceFr = true; try \{ return quoteViewFr\(q\); \} finally \{ forceFr = false; \} \}/);
 assert.match(html,/function EN\(\)\{ return !forceFr && document\.documentElement\.lang === 'en'; \}/);
 assert.match(html,/'<div class="qv" lang="fr" data-no-translate>'/);
});

test('signature wording: English shown with the French binding text alongside',()=>{
 const start=html.indexOf('function quoteDetail(q){'),end=html.indexOf('WIRE.devis = function(id){');
 const fn=html.slice(start,end);
 for(const name of ['tAccept','tWithdraw','tEarly','tSign']){
  assert.match(fn,new RegExp('L\\('+name+', '),name+' must be the French text of the English version');
  assert.match(fn,new RegExp('binding\\('+name+'\\)'),name+' must stay readable in French in English mode');
 }
 assert.match(fn,/Texte français \(fait foi\) · French text \(binding\)/);
});

test('change requests and default project steps follow the chosen language',()=>{
 assert.match(html,/clientName:\(D\.client\|\|\{\}\)\.nom\|\|'',en:EN\(\),/);
 assert.doesNotMatch(html,/en:false/);
 // A step reworded by Roland is shown as written; only untouched default steps are translated.
 const src=html.slice(html.indexOf('  var STEP_EN = {'),html.indexOf('function stepS(s)'));
 const ctx={window:{RDSTEPS:[{k:'design',t:'Maquettes',s:'x'}]},document:{documentElement:{lang:'en'}}};
 vm.createContext(ctx);vm.runInContext('var forceFr=false;function EN(){return !forceFr&&document.documentElement.lang==="en";}'+src,ctx);
 assert.equal(ctx.stepT({k:'design',t:'Maquettes'}),'Designs');
 assert.equal(ctx.stepT({k:'design',t:'Maquettes de la boutique'}),'Maquettes de la boutique');
 ctx.document.documentElement.lang='fr';
 assert.equal(ctx.stepT({k:'design',t:'Maquettes'}),'Maquettes');
});

test('project tabs and payment parts: due now is open invoices minus confirmed receipts',()=>{
 assert.match(html,/var TABS = \[\['apercu'/);
 assert.match(html,/data-tracking-part="payments" data-due="/);
 const src=tracking.slice(tracking.indexOf(' function dueNow(box,d)'),tracking.indexOf(' function latest(d)'));
 const ctx={cents:n=>Math.round((Number(n)||0)*100)};vm.createContext(ctx);vm.runInContext(src,ctx);
 const d={receipts:[{invoice_id:'a',amount:100},{invoice_id:'b',amount:50}]};
 assert.equal(ctx.dueNow({dataset:{due:JSON.stringify([{id:'a',amt:300},{id:'c',amt:40}])}},d),240);
 assert.equal(ctx.dueNow({dataset:{due:JSON.stringify([{id:'a',amt:80}])}},d),0,'never negative');
 assert.equal(ctx.dueNow({dataset:{}},d),null,'no figure without data');
});

test('client portal inline scripts parse',()=>{
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if(m[1].trim()) new vm.Script(m[1]);
});
