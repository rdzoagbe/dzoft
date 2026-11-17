import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const admin = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const project = readFileSync(new URL('../admin/projet.html', import.meta.url), 'utf8');

test('owner dashboard preserves the global workspace without forced project redirects', () => {
  assert.doesNotMatch(admin, /openFinanceDashboard\s*\(/);
  assert.doesNotMatch(admin, /&&routeToPrimaryWorkspace\(\)/);
  assert.match(admin, /Never redirect the whole app into the last accepted client project/);
  assert.match(admin, /if\(h==='vue-globale'\)/);
  assert.match(admin, /function fromHash\(\)/);
  assert.match(admin, /dash:'tableau-de-bord'/);
});
test('all cross-client navigation targets remain available', () => {
  for (const slug of ['tableau-de-bord','dossiers','demandes','clients','devis','projets','messages','paiements','parametres','corbeille']) {
    assert.ok(admin.includes("'"+slug+"'"), 'Missing route: '+slug);
  }
});
test('project-specific finance keeps explicit project selection and admin return links', () => {
  assert.match(project, /id="pf-project-switch"/);
  assert.match(project, /href="\.\/#\/dossiers"/);
  assert.match(project, /href="\.\/#\/vue-globale"/);
  assert.match(project, /href="\.\/#\/paiements"/);
});
test('new visual layer is loaded by main admin entry', () => {
  assert.match(admin, /workspace-unified\.css/);
});

const dashboardV3 = readFileSync(new URL('../admin/dashboard-v3.js', import.meta.url), 'utf8');
const dashboardV3Styles = readFileSync(new URL('../admin/dashboard-v3.css', import.meta.url), 'utf8');

test('owner dashboard markup uses the new portfolio layout, not legacy Today', () => {
  assert.match(admin, /id="sd-dashboard"/);
  for (const id of ['sd-stats','sd-project-list','sd-action-list','sd-verification']) {
    assert.ok(admin.includes('id="' + id + '"'), 'Missing new dashboard section: ' + id);
  }
  assert.doesNotMatch(admin, /<div class="bar"><h2>Tableau de bord<\/h2>/);
  assert.doesNotMatch(admin, /<script src="workspace-home\.js/);
  assert.match(admin, /dashboard-v3\.css/);
  assert.match(admin, /dashboard-v3\.js/);
});
test('new dashboard only displays authorized verified financial tracking', () => {
  assert.match(dashboardV3, /tracking/);
  assert.match(dashboardV3, /d\.received/);
  assert.match(dashboardV3, /d\.remaining/);
  assert.match(dashboardV3, /d\.total/);
  assert.doesNotMatch(dashboardV3, /\.update\(|\.insert\(|\.delete\(|\.rpc\(/);
  assert.match(dashboardV3, /projectUrl/);
});
test('new dashboard has mobile responsive breakpoints', () => {
  assert.match(dashboardV3Styles, /max-width:900px/);
  assert.match(dashboardV3Styles, /max-width:600px/);
});

test('client names open accepted project dossiers, not legacy editing modal', () => {
  assert.match(admin, /class="dzoft-client-link"/);
  assert.match(admin, /href="projet\.html\?q=/);
  assert.match(admin, /data-client-edit/);
  assert.match(admin, /if\(accepted\.length\)\{location\.href='projet\.html\?q='/);
});
test('project detail uses the same primary destinations as main workspace', () => {
  assert.match(project, /id="pf-side-dashboard"/);
  assert.match(project, /id="pf-side-cases"/);
  assert.match(project, /href="\.\/#\/messages"/);
  assert.match(project, /href="\.\/#\/paiements"/);
  assert.match(project, /project-unified\.css/);
  assert.match(project, /id="pf-side-project"/);
  assert.match(project, /id="pf-side-invoices"/);
});

test('every primary admin route shares the new DZOFT shell', () => {
  const shellCss=readFileSync(new URL('../admin/unified-app-shell.css',import.meta.url),'utf8');
  const shellJs=readFileSync(new URL('../admin/unified-app-shell.js',import.meta.url),'utf8');
  assert.match(admin,/unified-app-shell\.css/);
  assert.match(admin,/unified-app-shell\.js/);
  assert.match(shellCss,/grid-template-columns:238px minmax\(0,1fr\)/);
  assert.match(shellCss,/\.side/);
  assert.match(shellJs,/dzoft-side-brand/);
  for(const slug of ['tableau-de-bord','dossiers','messages','paiements','parametres']){
    assert.ok(admin.includes("'"+slug+"'"), 'missing route '+slug);
  }
});
test('specialized quote and project editors share nav without replacing secure workflows', () => {
  const quoteEditor=readFileSync(new URL('../admin/devis.html',import.meta.url),'utf8');
  const tracking=readFileSync(new URL('../admin/suivi.html',import.meta.url),'utf8');
  const editorNav=readFileSync(new URL('../admin/editor-navigation.js',import.meta.url),'utf8');
  for(const html of [quoteEditor,tracking]){
    assert.match(html,/editor-navigation\.css/);
    assert.match(html,/editor-navigation\.js/);
  }
  for(const path of ['./#/tableau-de-bord','./#/dossiers','./#/messages','./#/paiements','./#/parametres'])
    assert.ok(editorNav.includes(path),'missing route '+path);
  assert.doesNotMatch(editorNav,/\bsb\.(?:update|insert|remove|rpc)\(/);
  assert.match(editorNav,/valid=/);
});

test('one navigation owner with a separate chrome-only shell', () => {
  const chrome=readFileSync(new URL('../admin/unified-app-shell.js', import.meta.url),'utf8');
  const nav=readFileSync(new URL('../admin/workspace-nav-v6.js', import.meta.url),'utf8');
  assert.match(chrome, /dzoft-side-brand/);
  assert.match(chrome, /dzoft-header-section/);
  assert.match(chrome, /#\/tableau-de-bord/);
  assert.doesNotMatch(chrome, /dzoft-global-overview|dzoft-project-nav|dzoft-mobile-project/);
  assert.match(nav, /nav\.replaceChildren\(\)/);
  assert.match(nav, /dzoft-v6-link/);
  assert.match(nav, /aria-current/);
  assert.doesNotMatch(chrome, /\bsb\.(?:insert|update|remove|rpc)\(/);
});

test('all primary operational views use new DZOFT components instead of legacy tables',()=>{
 const css=readFileSync(new URL('../admin/workspace-pages-v4.css',import.meta.url),'utf8');
 assert.match(admin,/workspace-pages-v4\.css/);
 for(const cls of ['v4-clients','v4-quotes','v4-project-list','v4-messages']){
   assert.ok(admin.includes(cls),'Missing new view: '+cls);
 }
 assert.match(css,/\.v4-list-card/);
 assert.match(css,/max-width:550px/);
 assert.match(admin,/v4-lead-more/);
});
test('new card actions keep existing client and quote handlers',()=>{
 assert.match(admin,/data-client-edit/);
 assert.match(admin,/\.v4-client-card\[data-id\]/);
 assert.match(admin,/b\.closest\('\[data-id\]'\)\.dataset\.id/);
 assert.match(admin,/e\.target\.closest\('\[data-id\]'\)\.dataset\.id/);
 assert.match(admin,/data-a="open"/);
 assert.match(admin,/data-a="follow"/);
 assert.match(admin,/data-a="st"/);
 assert.match(admin,/data-a="del"/);
 assert.match(admin,/data-go="thread:/);
 assert.match(admin,/href="projet\.html\?q=/);
});

test('accepted quote links open the new project quote section, drafts remain editable', () => {
 assert.match(admin,/q&&q\.accepted_at\?'projet\.html\?q=':'devis\.html\?q='/);
 assert.match(admin,/q&&q\.accepted_at\?'#quotes':''/);
 assert.match(admin,/q\.accepted_at\?'#quotes':''/);
});

test('new project cards are searchable from the shared dossiers search', () => {
  const simplified=readFileSync(new URL('../admin/simplified-ui.js',import.meta.url),'utf8');
  assert.match(simplified, /#projects \.v4-project-card/);
  assert.match(admin, /simplified-ui\.js\?v=20261116-nav-audit1/);
});
test('installed mobile app exposes global overview and closes on project links', () => {
  const mobile=readFileSync(new URL('../admin/installed-app-menu.js',import.meta.url),'utf8');
  assert.match(mobile, /slug:'vue-globale'/);
  assert.match(mobile, /\.dzoft-mobile-project a\[href\]/);
  assert.match(mobile, /menu\.open=false/);
  assert.match(admin, /installed-app-menu\.js\?v=20261116-nav-audit1/);
});
test('all visible sidebar destinations map to real app views', () => {
  for(const value of ['tableau-de-bord','vue-globale','dossiers','demandes','clients','devis','projets','messages','paiements','parametres','corbeille']) {
    assert.ok(admin.includes(value),'Unknown destination '+value);
  }
  // Project links are built by the shared menu script, not written in projet.html itself.
  assert.match(readFileSync(new URL('../admin/workspace-nav-v6.js', import.meta.url),'utf8'),/projet\.html\?q=/);
  assert.match(project,/href="\.\/#\/vue-globale"/);
});
