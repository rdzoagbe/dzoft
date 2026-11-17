// 17 Nov 2026 (« one project page »): « Dossier client » and « Outils du projet » are one page, suivi.html, with five tabs.
// The summary (client, money, scope) and the official documents come from admin/project-summary.js, read-only.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nav=read('admin/editor-navigation.js'),v6=read('admin/workspace-nav-v6.js'),tabs=read('admin/project-workspace-tabs.js'),
 summary=read('admin/project-summary.js'),suivi=read('admin/suivi.html'),projet=read('admin/projet.html'),ws=read('admin/project-workspace.js');

test('the project page and the quote editor use the dashboard menu names and order',()=>{
 new vm.Script(nav);
 const labels=[...nav.matchAll(/fr:'([^']+)',en:/g)].map(m=>m[1]);
 const v6labels=[...v6.matchAll(/fr:'([^']+)',en:'[^']+',glyph/g)].map(m=>m[1]);
 assert.deepStrictEqual(labels,v6labels);
 assert.match(nav,/active:!quotePage/,'« Projets » is current on the project page');
 assert.doesNotMatch(nav,/\bsb\.(?:update|insert|remove|rpc)\(/);
});

test('five tabs: Vue d’ensemble, Travail, Argent, Documents, Messages',()=>{
 new vm.Script(tabs);
 const ids=[...tabs.matchAll(/\{id:'([a-z]+)',fr:'([^']+)'/g)].map(m=>m[1]+':'+m[2]);
 assert.deepStrictEqual(ids,['overview:Vue d’ensemble','work:Travail','billing:Argent','documents:Documents','messages:Messages']);
 // Extras live with the money; documents and client files have their own tab.
 assert.match(tabs,/var changes=document\.getElementById\('c-changes'\);\nif\(changes\)billing\.appendChild\(changes\);/);
 assert.match(tabs,/\['c-docs','c-files'\]\.forEach/);
 assert.match(tabs,/id="ps-docs"/);
 assert.match(tabs,/summaryBox\.id='ps-summary'/);
 // Old deep links still land in the right tab.
 for(const [link,pane] of [['work/c-docs','documents'],['work/c-files','documents'],['work/c-changes','billing'],['billing/pay','billing'],['work/publish','work'],['work/c-journal','work']])
  assert.match(tabs,new RegExp("'"+link.replace('/','\\/')+"':\\{pane:'"+pane+"'"));
});

test('the buttons above the tabs are actions, not a second set of tabs',()=>{
 for(const a of ['payment','progress','message','extra'])assert.match(ws,new RegExp('data-workspace-action="'+a+'"'));
 assert.doesNotMatch(ws,/data-workspace-action="(?:documents|history)"/);
 assert.match(tabs,/var deep=\{payment:'billing\/pay',progress:'work\/publish',message:'messages\/c-msg'\}\[dest\]/);
 assert.match(tabs,/if\(dest==='extra'\)\{newExtra\(\);return;\}/);
});

test('the summary and the documents are read-only and use server figures',()=>{
 new vm.Script(summary);
 assert.doesNotMatch(summary,/\bsb\.(?:update|insert|remove)\(|\.(?:insert|remove)\(|record_project|issue_accepted|localStorage/);
 assert.match(summary,/rpc\('project_tracking',\{p_quote:quoteId\},true\)/);
 assert.match(summary,/rpc\('owner_list_change_requests',\{p_quote:quoteId\},true\)/);
 // Only extras the client signed count; « réglée » comes from recorded payments, never from the invoice's own flag.
 assert.match(summary,/var ACCEPTED=\['approved','in_progress','completed'\]/);
 assert.match(summary,/r\.decided_at&&num\(r\.extra_price\)!==null/);
 assert.match(summary,/settled=Number\(x\.amt\)>0&&got>=Number\(x\.amt\)-0\.005/);
 assert.doesNotMatch(summary,/x\.paid/);
 // Still to receive = contract + signed extras − verified payments: a signed extra not yet invoiced is included.
 assert.match(summary,/Math\.max\(0,Math\.round\(num\(q\.accepted_total\)\*100\)\+extras-Math\.round\(num\(t\.received\)\*100\)\)\/100/);
 assert.match(summary,/tile\(tr\('Reste à encaisser','Still to receive'\),money\(due\(\)\),'orange'\)/);
 // The summary is fetched again after the extra-work widget changed, when Vue d'ensemble or Documents is shown.
 assert.match(summary,/new MutationObserver\(function\(\)\{stale=true;\}\)/);
 assert.match(tabs,/\(id==='overview'\|\|id==='documents'\)&&window\.DzoftProjectSummary&&window\.DzoftProjectSummary\.refreshIfStale/);
 // Opening the payment form unfolds the sections around it.
 assert.match(read('assets/project-tracking.js'),/for\(var up=target\.parentElement;up;up=up\.parentElement\)if\(up\.tagName==='DETAILS'\)up\.open=true;/);
 assert.match(suivi,/window\.DzoftProjectData = \{ Q: Q, C: C, sb: sb, QID: QID \};/);
 assert.match(summary,/if\(window\.DzoftProjectData\)update\(window\.DzoftProjectData\);/);
 assert.match(suivi,/project-summary\.js\?v=/);
 assert.match(suivi,/dzoft-documents\.js\?v=/);
});

test('projet.html only redirects old links to the right tab of the project page',()=>{
 assert.doesNotMatch(projet,/<script src=/);
 assert.match(projet,/\^\[0-9a-f\]\{8\}/,'only a project id is accepted');
 assert.match(projet,/location\.replace\('suivi\.html\?q='\+encodeURIComponent\(q\)\+'#'\+to\)/);
 for(const [old,now] of [['invoices','billing/c-inv'],['payments','billing/pay'],['extras','billing/c-changes'],['new-extra','billing/new-extra'],['journal','work/c-journal'],['documents','documents'],['activity','messages']])
  assert.ok(projet.includes((old.includes('-')?"'"+old+"'":old)+":'"+now+"'"),old);
 assert.match(suivi,/'← Projets'/);
 for(const f of ['admin/index.html','admin/dashboard-v3.js','admin/workspace-panels-v7.js','admin/devis.html'])
  assert.doesNotMatch(read(f),/projet\.html\?q=/,f+' links straight to the project page');
});

test('after the second-factor code, the admin can return to the project page',()=>{
 assert.match(read('admin/index.html'),/\(\?:devis\|suivi\|projet\)/);
 assert.match(suivi,/function checkMfaExpiry\(\)/);
});
