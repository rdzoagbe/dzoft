import {test,expect} from '@playwright/test';

// Entirely synthetic data. Production Auth, payments, Storage and invoices are
// unreachable. This verifies the actual responsive project finance page.
const mock=String.raw`(function(){
const quoteId='c8a50cee-3856-4539-98a3-f5df201dbff0';
const customer={id:'fictional-customer',nom:'Client démo',email:'client@example.invalid',entreprise:'Société de démonstration'};
const q={id:quoteId,client_id:customer.id,numero:'DEV-DEMO-001',accepted_at:'2026-11-01T10:00:00Z',
 accepted_total:1500,status:'accepté',invoices:[
 {id:'demo-invoice-1',num:'FACT-DEMO-1',amt:450,issued_at:'2026-11-05T12:00:00Z'},
 {id:'demo-invoice-2',num:'FACT-DEMO-2',amt:350,issued_at:'2026-11-10T12:00:00Z'},
 {id:'demo-invoice-3',num:'FACT-DEMO-3',amt:700,issued_at:'2026-11-14T12:00:00Z'}
 ],accepted_data:{lines:[{l:'Application web PWA',q:1,p:1500},{l:'Comptes utilisateurs',q:1,p:0}]}};
window.RDsb={session:()=>({access_token:'synthetic',user:{id:'synthetic-owner'}}),
 signOut:async()=>{},
 select:async table=>table==='quotes'?[q]:table==='clients'?[customer]:[],
 rpc:async name=>{
  if(name==='is_owner')return true;
  if(name==='owner_list_change_requests')return [
   {id:'faux-extra',title:'Nouvelle fonctionnalité',description:'Travaux complémentaires à étudier',proposed_scope:'Notifications et codes QR',extra_price:500,status:'proposed',proposal_version:1,created_at:'2026-11-15T10:00:00Z'}];
  if(name==='project_tracking')return {total:1500,base_total:1500,received:800,remaining:700,
   receipts:[{amount:450,method:'cash',received_on:'2026-11-05'},{amount:350,method:'transfer',received_on:'2026-11-10'}]};
  throw Error('Unexpected synthetic RPC: '+name);
 }};
})();`;
async function owner(page){
 await page.route(url=>url.pathname.endsWith('/admin/sb.js'),route=>
   route.fulfill({status:200,contentType:'application/javascript',body:mock}));
 await page.route('https://*.supabase.co/**',route=>route.abort('blockedbyclient'));
}
const url='admin/projet.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0';
test('Desktop project overview matches structure and excludes unapproved extras',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await owner(page);
 const errors=[];page.on('pageerror',x=>errors.push(x.message));
 await page.goto(url);
 await expect(page.locator('#pf-shell')).toBeVisible();
 await expect(page.locator('.pf-sidebar')).toBeVisible();
 await expect(page.locator('#pf-client-name')).toHaveText('Client démo');
 await expect(page.locator('#pf-base')).toContainText('1 500');
 await expect(page.locator('#pf-received')).toContainText('800');
 await expect(page.locator('#pf-remaining')).toContainText('700');
 await expect(page.locator('#pf-extras')).toContainText('0');
 await expect(page.locator('#pf-committed')).toContainText('1 500');
 await expect(page.locator('#pf-finance-note')).toContainText('500');
 await expect(page.locator('#pf-panel-content')).toContainText('Nouvelle fonctionnalité');
 await page.locator('[data-panel="invoices"]').click();
 await expect(page.locator('#pf-panel-content')).toContainText('FACT-DEMO-3');
 await page.locator('[data-panel="payments"]').click();
 await expect(page.locator('#pf-panel-content')).toContainText('450');
 expect(errors).toEqual([]);
});
test('Mobile 390px: single menu, stacked finance sections and real supplementary form',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await owner(page);
 const errors=[];page.on('pageerror',x=>errors.push(x.message));
 await page.goto(url);
 await expect(page.locator('#pf-shell')).toBeVisible();
 await expect(page.locator('#pf-menu')).toBeVisible();
 await expect(page.locator('#pf-client-name')).toBeVisible();
 await page.locator('#pf-menu').click();
 await expect(page.locator('#pf-sidebar')).toBeInViewport();
 await page.locator('#pf-overlay').click();
 await expect(page.locator('#pf-menu')).toHaveAttribute('aria-expanded','false');
 await page.locator('.pf-create').click();
 await expect(page.locator('#pf-extra-dialog')).toBeVisible();
 await expect(page.locator('#pf-change-widget')).toContainText(/Proposer un complément|Travaux supplémentaires/);
 await expect(page.locator('#pf-change-widget [data-change-offer]')).toBeAttached();
 await page.locator('#pf-dialog-close').click();
 await expect(page.locator('#pf-extra-dialog')).toBeHidden();
 expect(errors).toEqual([]);
});

