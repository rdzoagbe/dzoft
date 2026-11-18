// Owner's choice (18 Nov 2026): no photo of him on the public site; the DZOFT logo stands in for it.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
test('no portrait file is published and the developer block shows the logo',()=>{
 assert.ok(!fs.existsSync(path.join(root,'assets/profile.jpg')),'assets/profile.jpg must not be published');
 for(const p of ['index.html','en/index.html','a-propos.html','en/a-propos.html']){
  const html=fs.readFileSync(path.join(root,p),'utf8');
  assert.match(html,/class="developer-identity">\s*<img src="(?:\.\.\/)?assets\/dzoft-mark\.svg"/,p);
  assert.doesNotMatch(html,/profile\.(?:jpe?g|png|webp)/,p);
 }
});
