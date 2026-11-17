import {test,expect} from '@playwright/test';

// Seven entries (17 Nov 2026). A project's invoices, payments, journal and documents live in the project page.
const routes=[
 ['tableau-de-bord','v-dash'],
 ['clients','v-dossiers'],['devis','v-dossiers'],['projets','v-dossiers'],
 ['comptabilite','v-finance'],['messages','v-inbox'],['parametres','v-settings']
];
const OLD=[['paiements','comptabilite','v-finance'],['factures','comptabilite','v-finance'],['rapports','tableau-de-bord','v-dash'],['journal','projets','v-dossiers'],['documents','projets','v-dossiers']];
async function reveal(page){
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  document.querySelector('#auth').hidden=true;
  document.querySelector('#app').hidden=false;
 });
}
test('the seven menu entries each open exactly one page within the new shell',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop sidebar navigation');
 await reveal(page);
 await expect(page.locator('#app .side .dzoft-v6-link')).toHaveCount(7);
 for(const [slug,panel] of routes){
  const item=page.locator('#app .side .dzoft-v6-link[data-route="'+slug+'"]');
  await expect(item,'Route missing: '+slug).toHaveCount(1);
  await item.click();
  await expect(page).toHaveURL(new RegExp('#/'+slug+'$'));
  await expect(page.locator('#'+panel),'Destination not visible: '+slug).toBeVisible();
  if(slug==='clients')await expect(page.locator('#v-clients'),'Clients content is hidden inside the grouped dossier').toBeVisible();
  if(slug==='devis')await expect(page.locator('#v-quotes'),'Quotation content is hidden inside the grouped dossier').toBeVisible();
  if(slug==='projets')await expect(page.locator('#v-projects'),'Project content is hidden inside the grouped dossier').toBeVisible();
  if(slug==='comptabilite')await expect(page.locator('#v-invoices'),'The invoice register belongs to Comptabilité').toBeVisible();
  await expect(item).toHaveAttribute('aria-current','page');
  expect(await page.locator('#app .side .dzoft-v6-link[aria-current="page"]').count()).toBe(1);
 }
});
test('old addresses open their new place, and Catalogue opens from Devis',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop section check');
 await reveal(page);
 for(const [old,now,panel] of OLD){
  await page.evaluate(h=>{location.hash='#/'+h;},old);
  await expect(page).toHaveURL(new RegExp('#/'+now+'$'));
  await expect(page.locator('#'+panel)).toBeVisible();
  await expect(page.locator('#app .side .dzoft-v6-link[data-route="'+now+'"]')).toHaveAttribute('aria-current','page');
 }
 await page.locator('#app .side .dzoft-v6-link[data-route="devis"]').click();
 await page.locator('#b-qcatalogue').click();
 await expect(page).toHaveURL(/#\/catalogue$/);
 await expect(page.locator('#v-catalogue h1')).not.toBeEmpty();
 await expect(page.locator('#app .side .dzoft-v6-link[data-route="devis"]')).toHaveAttribute('aria-current','page');
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
 await page.locator('#dzoft-installed-menu-panel [data-app-route="comptabilite"]').click();
 await expect(page.locator('#v-finance')).toBeVisible();
 await expect(page.locator('#dzoft-installed-app-menu')).not.toHaveAttribute('open','');
});
test('inside a project the same seven entries show, with Projets current',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Project sidebar desktop check');
 const id='12345678-1234-4234-9234-123456789abc';
 // The editor menu is drawn before any data: the page itself is not needed for this check.
 await page.route('**/admin/sb.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.RDsb={session:()=>({}),aal:()=>"aal2",mfaFresh:()=>true,select:()=>new Promise(()=>{}),rpc:()=>new Promise(()=>{})};'}));
 await page.goto('admin/suivi.html?q='+id,{waitUntil:'domcontentloaded'});
 const entries=page.locator('#dzoft-editor-sidebar nav a');
 await expect(entries).toHaveCount(routes.length);
 for(const [slug] of routes)await expect(page.locator('#dzoft-editor-sidebar nav a[href="./#/'+slug+'"]')).toHaveCount(1);
 await expect(page.locator('#dzoft-editor-sidebar a[aria-current="page"]')).toHaveAttribute('href','./#/projets');
});

test('Comptabilité and Catalogue show the recorded data',async({page},info)=>{
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
  window.DzoftWorkspacePanelsV6.setDetails([{...quote,accepted_data:{lines:[{l:'Synthetic service line',u:'forfait',p:350}]}}],false);
 },id);
 await page.locator('#app .side [data-route="comptabilite"]').click();
 await expect(page.locator('#v-invoices .v6-page-body')).toContainText('FAC-TEST-001');
 await page.evaluate(()=>{location.hash='#/catalogue';});
 await expect(page.locator('#v-catalogue .v6-page-body')).toContainText('Synthetic service line');
});
test('failed authorized detail load is explicit, not an empty-client claim',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop');
 await reveal(page);
 await page.evaluate(()=>window.DzoftWorkspacePanelsV6.setDetails([],true));
 await page.evaluate(()=>{location.hash='#/catalogue';});
 await expect(page.locator('#v-catalogue .v6-warning')).toBeVisible();
});
