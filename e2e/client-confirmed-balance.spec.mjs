import {test,expect} from '@playwright/test';

async function mount(page){
 await page.goto('index.html',{waitUntil:'domcontentloaded'});
 await page.addStyleTag({url:'espace/simplified-client.css?v=20261120-balance2'});
 await page.addScriptTag({url:'assets/project-tracking.js?v=20261120-balance2'});
 await page.evaluate(()=>{
   document.body.classList.add('dzoft-client');
   const main=document.createElement('main');
   main.style.cssText='max-width:980px;padding:20px;margin:auto';
   main.innerHTML=['home','overview'].map(name=>
     '<section class="card" data-project-tracking="synthetic-quote" data-tracking-part="balance" data-test="'+name+'"><div class="tracking-slot" aria-live="polite"></div></section>'
   ).join('');
   document.body.append(main);
   window.__syntheticTracking={
     calls:[],
     value:{total:1800,received:550,remaining:1250,receipts:[],credit_notes:[],updates:[],legacy:0},
     reject:false,
     sb:{rpc(name,args){
       window.__syntheticTracking.calls.push({name,args});
       if(window.__syntheticTracking.reject)return Promise.reject(new Error('synthetic network outage'));
       return Promise.resolve({...window.__syntheticTracking.value});
     }}
   };
   window.DzoftTracking.setPortalToken('synthetic-nonproduction');
   window.DzoftTracking.client(window.__syntheticTracking.sb);
 });
}
const summary=page=>page.locator('[data-tracking-part="balance"]');

test('client home and overview show one live outstanding balance, no invoice-signing credit',async({page})=>{
 await mount(page);
 await expect(summary(page)).toHaveCount(2);
 await expect(summary(page).first()).toContainText('1\u00a0250,00');
 await expect(summary(page).last()).toContainText('Solde restant à régler');
 await page.evaluate(()=>{
   const x=window.__syntheticTracking;
   x.value={...x.value,received:850,remaining:950,
     // Signed invoice metadata is intentionally irrelevant for the balance.
     invoices:[{id:'fake-signature',amount:300,signed:true,paid:true}]};
   document.querySelectorAll('[data-project-tracking]').forEach(node=>delete node.dataset.loading);
   window.DzoftTracking.client(x.sb);
 });
 await expect(summary(page).first()).toContainText('950,00');
 await expect(summary(page).last()).toContainText('850,00');
 const actions=await page.evaluate(()=>window.__syntheticTracking.calls);
 expect(actions.length).toBeGreaterThanOrEqual(4);
 expect(actions.every(x=>x.name==='portal_project_tracking')).toBe(true);
 expect(actions.every(x=>x.args.p_quote==='synthetic-quote')).toBe(true);
});

test('failed tracking read hides earlier balance instead of displaying stale financial truth',async({page})=>{
 await mount(page);
 await expect(summary(page).first()).toContainText('Solde restant à régler');
 await page.evaluate(()=>{
   window.__syntheticTracking.reject=true;
   document.querySelectorAll('[data-project-tracking]').forEach(node=>delete node.dataset.loading);
   window.DzoftTracking.client(window.__syntheticTracking.sb);
 });
 await expect(summary(page).first()).toContainText('Solde ou suivi indisponible');
 await expect(summary(page).first()).not.toContainText('1\u00a0250,00');
});
