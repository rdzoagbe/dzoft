const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const js=fs.readFileSync(path.join(__dirname,'../assets/change-requests.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/change-requests.css'),'utf8');

test('Calculator prices and quantities accept a comma (no number input that drops it on phones)',()=>{
 assert.match(js,/name="qty" type="text" inputmode="decimal"/);
 assert.match(js,/name="price" type="text" inputmode="decimal"/);
 assert.doesNotMatch(js,/name="(qty|price)" type="number"/);
 assert.match(js,/function num\(v\)\{var n=Number\(String\(v==null\?'':v\)\.replace\(',','\.'\)\)/);
 // A normal line cannot carry a negative price; only the discount line subtracts.
 assert.match(js,/\(p<0\?NaN:p\)/);
});

test('« Prix libre » empties the price; typing over a level returns the line to free price',()=>{
 assert.match(js,/else\{pr\.value='';pr\.setAttribute\('data-unpriced',''\);pr\.focus\(\);\}/);
 assert.match(js,/if\(t&&cents\(ev\.target\.value\)!==cents\(t\.price\)\)\{sel\.value=''/);
});

test('Prices from « Calculer depuis le suivi » say where they come from, privately',()=>{
 for(const s of ['noté dans le journal','de votre liste','Prix par défaut','Aucun prix trouvé','Origine des prix'])assert.ok(js.includes(s),s);
 // The note is not a form field, so it is never sent with the proposal.
 assert.match(js,/<small class="dzoft-calc-origin" data-line-origin>/);
 assert.doesNotMatch(js,/name="origin"/);
});

test('On a phone each calculator line fits the screen, total included',()=>{
 assert.match(css,/@media\(max-width:560px\)\{\n \.dzoft-calc \.dzoft-change-table\{overflow:visible\}/);
 assert.match(css,/\.dzoft-calc \.dzoft-change-table tbody tr\{display:grid/);
});

test('Prices and quantities keep two decimals at most, so the total shown is the total sent',()=>{
 const m=js.match(/function amount\(v\)\{[^\n]*\}/);assert.ok(m);
 const amount=new Function('num',m[0]+';return amount;')(v=>{const n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:NaN;});
 assert.equal(amount('12,5'),12.5);assert.equal(amount('1.25'),1.25);assert.equal(amount(' 40 '),40);
 for(const bad of ['1,234','0,001','12,5,0','abc','','1e3'])assert.ok(Number.isNaN(amount(bad)),bad);
 assert.match(js,/qty:disc\?1:amount\(/);assert.match(js,/p=amount\(row\.querySelector\('\[name=price\]'\)\.value\);return \{label/);
});
