const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../admin/workspace-epuree.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../admin/index.html'),'utf8');
test('Desktop account hamburger is hidden and logout remains reachable',()=>{
 assert.match(css,/@media \(min-width:981px\)\{/);
 assert.match(css,/body\.dzoft-admin #app \.top \.workspace-more\{display:none!important\}/);
 assert.match(css,/body\.dzoft-admin #app \.top \.in #b-out\{display:inline-flex!important/);
 assert.match(html,/workspace-epuree\.css\?v=(?:20261115-single-desktop-nav|20261117-blue)/);
});
test('Narrow non-installed browser retains menu and installed mobile uses its own single menu',()=>{
 const simpler=fs.readFileSync(path.join(__dirname,'../admin/simplified-ui.css'),'utf8');
 const installed=fs.readFileSync(path.join(__dirname,'../admin/installed-app-menu.js'),'utf8');
 assert.match(simpler,/@media\(max-width:980px\)/);
 assert.match(simpler,/#app \.workspace-more\{display:block\}/);
 assert.match(installed,/dzoft-installed-mobile/);
 assert.match(simpler,/body\.dzoft-admin\.dzoft-installed-mobile #app \.top \.in>:not\(\.installed-app-menu\)\{display:none!important\}/);
});
