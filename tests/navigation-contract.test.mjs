import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const admin = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const project = readFileSync(new URL('../admin/projet.html', import.meta.url), 'utf8');

test('owner dashboard opens one accepted project without arbitrary selection', () => {
  assert.doesNotMatch(admin, /openFinanceDashboard\s*\(/);
  assert.match(admin, /accepted\.length!==1/);
  assert.match(admin, /routeToPrimaryWorkspace\(\)/);
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
  for (const id of ['sd-stats','sd-project-list','sd-action-list','sd-project-select','sd-project-summary','sd-verification']) {
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

test('all global sections retain selected-project navigation and global overview', () => {
  const js=readFileSync(new URL('../admin/unified-app-shell.js', import.meta.url),'utf8');
  const styles=readFileSync(new URL('../admin/unified-app-shell.css', import.meta.url),'utf8');
  assert.match(js, /dzoft-global-overview/);
  assert.match(js, /data-project-target/);
  assert.match(js, /dzoft-mobile-project/);
  assert.match(js, /uuid\.test\(selected\)/);
  assert.match(js, /dzoft:data-refreshed/);
  assert.match(styles, /dzoft-project-nav/);
  assert.doesNotMatch(js, /\bsb\.(?:insert|update|remove|rpc)\(/);
});
