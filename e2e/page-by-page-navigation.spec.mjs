import {test,expect} from '@playwright/test';

const routes=[
 ['tableau-de-bord','v-dash'],
 ['clients','v-dossiers'],['projets','v-dossiers'],['devis','v-dossiers'],
 ['factures','v-invoices'],['paiements','v-finance'],
 ['journal','v-journal'],['documents','v-documents'],
 ['catalogue','v-catalogue'],['rapports','v-reports'],['parametres','v-settings']
];
async function reveal(page){
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  document.querySelector('#auth').hidden=true;
  document.querySelector('#app').hidden=false;
 });
}
test('all 11 global destinations open exactly one page within the new shell',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop sidebar navigation');
 await reveal(page);
 for(const [slug,panel] of routes){
  const item=page.locator('#app .side .dzoft-v6-link[data-route="'+slug+'"]');
  await expect(item,'Route missing: '+slug).toHaveCount(1);
  await item.click();
  await expect(page).toHaveURL(new RegExp('#/'+slug+'$'));
  await expect(page.locator('#'+panel),'Destination not visible: '+slug).toBeVisible();
  if(slug==='clients')await expect(page.locator('#v-clients'),'Clients content is hidden inside the grouped dossier').toBeVisible();
  if(slug==='devis')await expect(page.locator('#v-quotes'),'Quotation content is hidden inside the grouped dossier').toBeVisible();
  if(slug==='projets')await expect(page.locator('#v-projects'),'Project content is hidden inside the grouped dossier').toBeVisible();
  await expect(item).toHaveAttribute('aria-current','page');
  expect(await page.locator('#app .side .dzoft-v6-link[aria-current="page"]').count()).toBe(1);
 }
});
test('new invoices, journal, documents, catalogue and reports never show dead blank pages',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop section check');
 await reveal(page);
 for(const [slug,id] of routes.filter(([slug])=>['factures','journal','documents','catalogue','rapports'].includes(slug))){
  await page.locator('#app .side .dzoft-v6-link[data-route="'+slug+'"]').click();
  await expect(page.locator('#'+id+' .v6-page-body')).not.toBeEmpty();
  await expect(page.locator('#'+id+' h1')).not.toBeEmpty();
 }
});
test('installed mobile menu includes every canonical route and closes after navigation',async({page},info)=>{
 test.skip(!info.project.name.includes('mobile'),'Mobile-only');
 await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true,configurable:true});});
 await reveal(page);
 await expect(page.locator('#dzoft-installed-app-menu')).toBeVisible();
 await page.locator('#dzoft-installed-menu-toggle').click();
 for(const [slug] of routes){
  await expect(page.locator('#dzoft-installed-menu-panel [data-app-route="'+slug+'"]')).toHaveCount(1);
 }
 await page.locator('#dzoft-installed-menu-panel [data-app-route="rapports"]').click();
 await expect(page.locator('#v-reports')).toBeVisible();
 await expect(page.locator('#dzoft-installed-app-menu')).not.toHaveAttribute('open','');
});
test('project page navigation retains the selected project ID on contextual sections',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Project sidebar desktop check');
 const id='12345678-1234-4234-9234-123456789abc';
 await page.route('**/admin/project-finance.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.goto('admin/projet.html?q='+id,{waitUntil:'domcontentloaded'});
 // Production reveals pf-shell only after authentication and RPCs.
 // For this read-only route test, reveal it without using private credentials.
 await page.evaluate(()=>{
   document.getElementById('pf-shell').hidden=false;
   document.getElementById('pf-loading').hidden=true;
 });
 const entries=page.locator('#pf-sidebar .dzoft-v6-link');
 await expect(entries).toHaveCount(routes.length);
 for(const [slug,hash] of [['devis','quotes'],['factures','invoices'],['paiements','payments'],['journal','journal'],['documents','documents']]){
  const item=page.locator('#pf-sidebar [data-route="'+slug+'"]');
  await expect(item).toHaveAttribute('href','#'+hash);
  await item.click();
  await expect(page).toHaveURL(new RegExp('#'+hash+'$'));
  await expect(item).toHaveAttribute('aria-current','page');
 }
 await expect(page.locator('#pf-sidebar [data-route="catalogue"]')).toHaveAttribute('href','./#/catalogue');
});

test('data-backed operational indexes show invoices, journal, documents and quoted services',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop synthetic data verification');
 await reveal(page);
 const id='12345678-1234-4234-9234-123456789abc';
 await page.evaluate((id)=>{
  const quote={id,numero:'D-TEST-042',client_id:'cli1',accepted_at:'2026-11-01',invoices:[{num:'FAC-TEST-001',amt:1500,date:'2026-11-02'}]};
  window.DzoftWorkspacePanelsV6.setData({
   projects:[{id,numero:quote.numero,clientName:'Client test'}],
   quotes:[quote],clients:[{id:'cli1',nom:'Client test'}],
   trackings:{[id]:{total:1500,received:800,remaining:700}},ready:true
  });
  window.DzoftWorkspacePanelsV6.setDetails([
   {...quote,journal:[{d:'2026-11-05',k:'fait',t:'Journal synthetic entry'}],
   docs:[{n:'Document synthetic reference',u:'https://example.org'}],
   accepted_data:{lines:[{l:'Synthetic service line',u:'forfait',p:350}]}}
  ],false);
 },id);
 for(const [slug,text] of [['factures','FAC-TEST-001'],['journal','Journal synthetic entry'],['documents','Document synthetic reference'],['catalogue','Synthetic service line']]){
  await page.locator('#app .side [data-route="'+slug+'"]').click();
  await expect(page.locator('#v-'+({factures:'invoices'}[slug]||slug)+' .v6-page-body')).toContainText(text);
 }
 await page.locator('#app .side [data-route="rapports"]').click();
 await expect(page.locator('#v-reports')).toContainText('1 500');
 await expect(page.locator('#v-reports')).toContainText('800');
 await expect(page.locator('#v-reports')).toContainText('700');
});
test('failed authorized detail load is explicit, not an empty-client claim',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop');
 await reveal(page);
 await page.evaluate(()=>window.DzoftWorkspacePanelsV6.setDetails([],true));
 await page.locator('#app .side [data-route="documents"]').click();
 await expect(page.locator('#v-documents .v6-warning')).toBeVisible();
});
