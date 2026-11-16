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
