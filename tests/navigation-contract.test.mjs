import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const admin = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const project = readFileSync(new URL('../admin/projet.html', import.meta.url), 'utf8');

test('owner dashboard does not automatically redirect to latest project', () => {
  assert.doesNotMatch(admin, /openFinanceDashboard\s*\(/);
  assert.doesNotMatch(admin, /location\.replace\(['"]projet\.html\?q=/);
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
  assert.match(project, /href="\.\/#\/clients"/);
  assert.match(project, /href="\.\/#\/projets"/);
  assert.match(project, /href="\.\/#\/paiements"/);
});
test('new visual layer is loaded by main admin entry', () => {
  assert.match(admin, /workspace-unified\.css/);
});
