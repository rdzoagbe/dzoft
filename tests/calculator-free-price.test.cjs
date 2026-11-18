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
 assert.match(js,/qty:disc\?1:amount\(/);assert.match(js,/p=amount\(row\.querySelector\('\[name=price\]'\)\.value\),pc=/);assert.match(js,/return \{label:lb,/);
});

test('« Calculer depuis le suivi » only adds requests done since the last extra-work proposal',()=>{
 const fj=js.slice(js.indexOf('function fromJournal('),js.indexOf('function recalc('));
 // The start is the latest of the signature and the last live proposal (declined, rejected or withdrawn ones do not count).
 assert.match(fj,/if\(\['declined','rejected','withdrawn'\]\.indexOf\(r\.status\)<0\)\{/);
 // Only priced extra work counts (not an unpriced client request), dated when it was proposed.
 assert.match(fj,/if\(\['proposed','approved','in_progress','completed'\]\.indexOf\(r\.status\)>=0\)\{var c=String\(r\.proposed_at\|\|r\.created_at\|\|''\)\.slice\(0,10\);if\(c>lastDay\)lastDay=c;\}/);
 assert.match(fj,/if\(lastDay>since\)since=lastDay;/);
 // Older done requests are listed apart, never added; lines already in a live proposal are still skipped.
 assert.match(fj,/if\(since&&e\.d<since\)\{[^]*?earlier\.push\([^]*?return false;\}/);
 assert.match(fj,/if\(used\[source\]\)\{skipped\+\+;[^}]*?return;\}/);
 assert.match(fj,/avant le dernier supplément, non reprise\(s\)/);
});

test('« Depuis le » lets the owner choose the start date (never before the signature)',()=>{
 assert.match(js,/<input type="date" name="since"/);
 const fj=js.slice(js.indexOf('function fromJournal('),js.indexOf('function recalc('));
 assert.match(fj,/if\(chosen\)since=signed&&chosen<signed\?signed:chosen;/);
 assert.match(fj,/\(dates choisies\)/);
});

test('Calculating again with a later start removes journal lines now before it, keeps hand-typed lines',()=>{
 const fj=js.slice(js.indexOf('function fromJournal('),js.indexOf('function recalc('));
 assert.match(fj,/m=\/\^journal:\(\\d\{4\}-\\d\{2\}-\\d\{2\}\):\/\.exec\(src\)/);
 assert.match(fj,/if\(m&&\(\(since&&m\[1\]<since\)\|\|m\[1\]>upto\)\)/);
 // Removal happens before the form's remaining lines are marked as used.
 assert.ok(fj.indexOf('m[1]<since')<fj.indexOf('readLines(form).forEach(function(l){if(l.source)used[l.source]=1;})'));
});

test('« Du … Au … »: an optional end date, and the proposal holding a skipped request is named (18 Nov 2026)',()=>{
 assert.match(js,/<input type="date" name="until"/);
 const fj=js.slice(js.indexOf('function fromJournal('),js.indexOf('function recalc('));
 // Only requests done up to the end date are added; later ones are listed apart, never added.
 assert.match(fj,/if\(e\.d>upto\)\{[^]*?after\.push\([^]*?return false;\}/);
 // Empty « Au » = today, so a future-dated line is never added.
 assert.match(fj,/upto=until\|\|\(today\.getFullYear\(\)/);
 // An end date before the start date stops the calculation with a message.
 assert.match(fj,/if\(until&&since&&until<since\)\{[^]*?return;\}/);
 // Skipped requests say which proposal holds them, an unsent draft included.
 assert.match(fj,/brouillon non envoyé du /);
 assert.match(fj,/modifiez ou refusez d’abord cette proposition/);
});

test('Commercial discount is a percentage of the items, sent as its euro amount (18 Nov 2026)',()=>{
 assert.match(js,/<input name="pct" type="text" inputmode="decimal"/);
 // Items are totalled first; the discount is a percentage of that subtotal, rounded to the cent.
 const rc=js.slice(js.indexOf('function recalc('),js.indexOf('function addLine('));
 assert.ok(rc.indexOf('sub+=')<rc.indexOf('Math.round(sub*pc/100)'));
 assert.match(rc,/pc>0&&pc<100\?Math\.round\(sub\*pc\/100\):NaN/);
 // The label tells the client the percentage; an invalid percentage blocks saving.
 assert.ok(js.includes("var suf=' ('+String(pc).replace('.',',')+' %)'"));
 // The label with its percentage never exceeds the server's 160 characters.
 assert.ok(js.includes('.slice(0,160-suf.length).trim()+suf'));
 assert.match(js,/La remise est un pourcentage : tapez un nombre entre 0 et 100/);
});
