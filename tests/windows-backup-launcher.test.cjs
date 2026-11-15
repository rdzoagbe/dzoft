const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Windows runner encrypts with existing local tool, verifies copy integrity and never embeds secrets',()=>{
 const runner=read('tools/backup-dzoft-windows.ps1');
 assert.match(runner,/\[Parameter\(Mandatory = \$true\)\]/);
 assert.match(runner,/\[string\]\$OffsitePath/);
 assert.match(runner,/backup_dzoft\.py/);
 assert.match(runner,/cryptography|passphrase/);
 assert.match(runner,/Get-FileHash -LiteralPath \$destination -Algorithm SHA256/);
 assert.match(runner,/\$localHash -ne \$remoteHash/);
 assert.match(runner,/& \$python\.Source \$script 'verify' \$destination/);
 assert.match(runner,/This is NOT independently off-site|NOT independently off-site/);
 assert.match(runner,/The copied archive could not be decrypted and verified/);
 assert.match(runner,/\.git/);
 assert.match(runner,/No off-site copy was created|No off-site copy was created/i);
 assert.doesNotMatch(runner,/(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN)\s*=/);
 assert.doesNotMatch(runner,/Invoke-RestMethod|Invoke-WebRequest|curl|git push|actions\/upload-artifact/);
});

test('Backup UI explicitly names Free-plan limitations without marking readiness verified',()=>{
 const html=read('admin/index.html');
 assert.match(html,/Supabase Free ne fournit pas de sauvegardes automatiques gérées/);
 assert.match(html,/backup-dzoft-windows\.ps1/);
 assert.match(html,/docs\/backup-recovery\.md/);
 assert.match(html,/Sauvegarde récupérable : non vérifiée/);
 assert.match(html,/Une restauration complète reste à vérifier/);
 const docs=read('docs/backup-recovery.md');
 assert.match(docs,/interactive|interactif|interactive/i);
 assert.match(docs,/SHA-256/);
 assert.match(docs,/isolated/i);
 assert.match(docs,/downloaded copy (passed|successfully)|Google Drive/);
 assert.match(docs,/full restore|restoration|restore.*not.*test/i);
 assert.doesNotMatch(html,/Dernière sauvegarde vérifiée : aujourd'hui/);
});
