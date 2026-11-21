const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
// Visitors learn how extras work before they ask for a quote (21 Nov 2026), in line with the terms of sale,
// article 3 (version 2026-12): price in writing first, written yes (simple reply up to 100 €, signed quote above),
// oral requests commit no one, fixes to deliver the quote stay included.
test('home page explains extras in three steps, FR and EN, linked to article 3',()=>{
 const fr=read('index.html'),en=read('en/index.html');
 for(const [s,words] of [[fr,['Une nouvelle idée en cours de route&nbsp;?','Le prix d’abord, par écrit.','Rien sans votre «&nbsp;oui&nbsp;» écrit.','Jusqu’à 100 €','à l’oral','restent incluses']],
                         [en,['A new idea along the way?','Price first, in writing.','Nothing without your written “yes”.','Up to €100','orally','remain included']]]){
  assert.match(s,/class="extras-promise"/);
  assert.match(s,/href="cgv\.html#a3"/);
  for(const w of words)assert.ok(s.includes(w),w);
 }
});
test('FAQ, Méthode and Services say the same thing (FR and EN)',()=>{
 for(const f of ['faq.html','methode.html']){assert.ok(read(f).includes('une simple réponse écrite jusqu’à 100 €'),f);}
 for(const f of ['en/faq.html','en/methode.html']){assert.ok(read(f).includes('a simple written reply up to €100'),f);}
 assert.ok(read('services.html').includes('rien n’est fait ni facturé sans votre accord écrit'));
 assert.ok(read('en/services.html').includes('nothing is done or charged without your written agreement'));
 // The old wording promised a supplementary quote for every extra; the terms now allow a written reply up to 100 €.
 for(const f of ['index.html','en/index.html','faq.html','en/faq.html'])assert.ok(!/devis complémentaire à accepter|only if you approve a separate quote/.test(read(f)),f);
 assert.match(read('cgv.html'),/Demande d’un montant de 100 € au plus/);
});
