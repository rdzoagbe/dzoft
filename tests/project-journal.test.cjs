const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('project journal is private: stored on quotes, shown only on the admin project sheet, never returned to clients', () => {
  const admin = read('admin/suivi.html'), schema = read('supabase/schema.sql'), migration = read('supabase/migrations/20261113100000_project_journal.sql');
  assert.match(migration, /alter table public\.quotes add column if not exists journal jsonb not null default '\[\]'::jsonb;/);
  assert.match(schema, /journal\s+jsonb not null default '\[\]'/);
  assert.match(admin, /id="c-journal"/);
  assert.match(admin, /Le client ne voit jamais ce journal\./);
  assert.match(admin, /save\(\{ journal: Q\.journal\.filter/);
  // Client-facing SQL builds answers field by field and must never mention the journal or return whole quote rows.
  const clientSql = schema.split(/\ncreate (?:or replace )?function /).filter(f => /^public\.(my_|portal_|client_)/.test(f)).join('\n');
  assert.ok(clientSql.length > 1000, 'client functions found');
  assert.doesNotMatch(clientSql, /journal/);
  assert.doesNotMatch(clientSql, /to_jsonb\(\s*q\s*\)|row_to_json\(\s*q\s*\)/);
  for (const f of ['espace/index.html']) if (fs.existsSync(path.join(__dirname, '..', f))) assert.doesNotMatch(read(f), /journal/i);
});

test('the next client update is prepared as a private draft; publishing and adding milestones stay the owner’s action', () => {
  const admin = read('admin/suivi.html'), tracking = read('assets/project-tracking.js'), schema = read('supabase/schema.sql');
  assert.match(schema, /progress_draft\s+jsonb/);
  assert.match(read('supabase/migrations/20261114210000_project_progress_draft.sql'), /alter table public\.quotes add column if not exists progress_draft jsonb;/);
  // The draft only fills the form: the client is told through the existing owner-triggered publication, nothing else.
  assert.match(tracking, /q\.progress_draft&&Array\.isArray\(q\.progress_draft\.updates\)/);
  assert.equal((tracking.match(/publish_project_updates/g) || []).length, 1, 'one publication path, on submit');
  assert.doesNotMatch(tracking.split('var draft=')[1].split('pf.onsubmit')[0], /\.rpc\(/, 'filling the form calls nothing');
  assert.match(admin, /id="st-proposed" hidden/);
  assert.match(admin, /le client ne les voit pas tant que vous ne les ajoutez pas/);
  // Never returned to clients.
  const clientSql = schema.split(/\ncreate (?:or replace )?function /).filter(f => /^public\.(my_|portal_|client_)/.test(f)).join('\n');
  assert.doesNotMatch(clientSql, /progress_draft/);
  assert.doesNotMatch(read('espace/index.html'), /progress_draft/);
});
