const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const pricing=require('../assets/quote-pricing.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

const catalogue=[
 {label:'Connexion sécurisée',price:120,description:'Authentification du client',scope:'pwa',words:['connexion','login']},
 {label:'Galerie photo',price:100,description:'Album de photos',scope:'extra',words:['galerie photo','photos']},
 {label:'Notifications mobiles',price:45,description:'Push mobile',scope:'mobile',words:['notifications']},
 {label:'Assistance',price:30,scope:'both',words:['assistance']}
];

test('PWA quote: explicit package inclusions remain zero additional cost; extras are priced',()=>{
 const result=pricing.analyze('Une connexion, une galerie photo et des notifications', 'pwa',catalogue);
 assert.deepEqual(result.included.map(x=>x.label),['Connexion sécurisée']);
 assert.deepEqual(result.extras.map(x=>x.label),['Galerie photo','Notifications mobiles']);
 assert.equal(result.extras[0].price,100);
 assert.equal(result.included[0].scope,'pwa');
});
test('mobile quote uses a different inclusion set and both is included in both package types',()=>{
 const result=pricing.analyze('Connexion, notifications, assistance', 'mobile',catalogue);
 assert.deepEqual(result.included.map(x=>x.label),['Notifications mobiles','Assistance']);
 assert.deepEqual(result.extras.map(x=>x.label),['Connexion sécurisée']);
 assert.deepEqual(pricing.analyze('assistance','pwa',catalogue).included.map(x=>x.label),['Assistance']);
});
test('no rule or unknown scope is NEVER assumed included',()=>{
 const legacy={label:'Reservation',price:250,words:['reservation']};
 const invalid={label:'Profile',price:90,scope:'unknown',words:['profile']};
 const result=pricing.analyze('reservation profile','pwa',[legacy,invalid]);
 assert.equal(result.included.length,0);
 assert.deepEqual(result.extras.map(x=>x.label),['Reservation','Profile']);
 assert.equal(pricing.analyze('unknown feature','pwa',catalogue).unknown,true);
});
test('matches are accent and case insensitive, bounded by entire phrases, and deduplicated',()=>{
 const r=pricing.analyze('GALERIE PHOTÓ et galerie photo','mobile',catalogue.concat([{label:'Photo',price:10,words:['photo']}]));
 assert.deepEqual(r.extras.map(x=>x.label),['Galerie photo','Photo']);
 assert.equal(pricing.matchRequest('connections',catalogue[0]),false);
 assert.equal(pricing.matchRequest('une connexion client',catalogue[0]),true);
});
test('invalid or negative prices are rejected and comma decimal prices round exactly',()=>{
 assert.equal(pricing.validPrice('12,50'),12.5);
 assert.equal(pricing.validPrice('12.345'),12.35);
 assert.equal(pricing.validPrice(-1),null);
 assert.equal(pricing.validPrice('Infinity'),null);
 assert.equal(pricing.validPrice(''),null);
 assert.equal(pricing.validPrice('   '),null);
 assert.equal(pricing.analyze('connexion','pwa',[{...catalogue[0],price:-99}]).included.length,0);
});
test('new quotation editor is explicitly owner-only and signed quotes cannot use estimator',()=>{
 const html=read('admin/devis.html');
 assert.match(html,/id="b-estimate"/);
 assert.match(html,/id="quote-estimator"/);
 assert.match(html,/quote-pricing\.js\?v=20261119-initial1/);
 assert.match(html,/quote-pricing\.css\?v=20261119-initial1/);
 assert.match(html,/quoteAccepted = !!q\.accepted_at/);
 assert.match(html,/if\(!quoteLoaded\|\|quoteAccepted\)/);
 assert.match(html,/if\(quoteAccepted\)\$\('b-estimate'\)\.title/);
 assert.match(html,/state\.lines=next;renderLines\(\);return true/);
 assert.match(html,/sb\.select\('settings','select=price_blocks&id=eq\.1'\)/);
 assert.doesNotMatch(read('assets/quote-pricing.js'),/sb\.update|sb\.rpc|fetch\(|localStorage/);
 assert.match(html,/var sb = window\.RDsb;/);
 assert.match(html,/if \(!sb \|\| !sb\.session\(\)\)/);
 const scripts=Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g));
 for(const m of scripts){if(m[1].trim())new vm.Script(m[1]);}
});
test('catalogue can create and maintain metadata on the existing settings.price_blocks JSON',()=>{
 const source=read('assets/change-requests.js');
 assert.match(source,/data-new-block-label/);
 assert.match(source,/data-new-block-scope/);
 assert.match(source,/data-new-block-price/);
 assert.match(source,/data-block-scope/);
 assert.match(source,/data-block-description/);
 assert.match(source,/if\(b\.hasAttribute\('data-block-add'\)\)/);
 assert.match(source,/Object\.assign\(\{\},bl,\{/);
 assert.match(source,/saveBlocks\(data\.blocks\.concat\(\[item\]\)\)/);
 assert.match(source,/price_blocks:next\.slice\(0,200\)/);
 assert.doesNotMatch(source,/drop table|alter table|update public\.quotes/);
 new vm.Script(source,{filename:'assets/change-requests.js'});
});
