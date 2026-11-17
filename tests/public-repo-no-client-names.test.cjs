// The repository is public: no client or client-app name, and no figure from a client's quote (CLAUDE.md, 17 Nov 2026).
// The client's public GitHub address stays where the code needs it (ProjectRodney/ProRod), and old applied
// migrations keep their technical names (a later migration renamed them).
const test=require('node:test'),assert=require('node:assert'),{execSync}=require('child_process'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const files=execSync('git ls-files',{cwd:root,encoding:'utf8'}).split('\n').filter(f=>f&&!/\.(png|jpe?g|webp|ico|woff2?|pdf)$/i.test(f)&&f!=='tests/public-repo-no-client-names.test.cjs');
test('no client app name in the public repository',()=>{
 const hits=files.filter(f=>{try{return /upzone/i.test(fs.readFileSync(path.join(root,f),'utf8'));}catch{return false;}});
 assert.deepStrictEqual(hits,[]);
});
test('no price from a client quote in the price-level help text',()=>{
 const js=fs.readFileSync(path.join(root,'assets/change-requests.js'),'utf8');
 assert.doesNotMatch(js,/y vaut 150|module is 150/);
});
