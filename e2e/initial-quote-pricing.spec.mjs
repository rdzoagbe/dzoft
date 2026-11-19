import {test,expect} from '@playwright/test';

// Synthetic owner-only calculator preview. No Supabase credentials, writes or customer files.
async function setup(page,locked=false,failedCatalogue=false){
 await page.goto('index.html',{waitUntil:'domcontentloaded'});
 await page.addStyleTag({url:'assets/quote-pricing.css?v=20261119-initial1'});
 await page.addScriptTag({url:'assets/quote-pricing.js?v=20261119-initial1'});
 await page.evaluate(({locked,failedCatalogue})=>{
   const panel=document.createElement('section');
   panel.className='quote-estimator';panel.id='qpc-synthetic';panel.hidden=true;
   document.body.prepend(panel);
   window.__qpc={applied:[],locked};
   window.__qpc.instance=window.DzoftQuotePricing.attach(panel,{
     packages:[
       {key:'pwa',kind:'pwa',label:'Application web installable (PWA)',price:700,presetIndex:2},
       {key:'mobile',kind:'mobile',label:'Application mobile',price:1500,presetIndex:3}
     ],
     loadCatalog:()=>failedCatalogue?Promise.reject(new Error('no catalogue')):Promise.resolve([
       {label:'Connexion',description:'Authentification',price:100,scope:'pwa',words:['connexion']},
       {label:'Galerie photo',description:'Album client',price:100,scope:'extra',words:['galerie photo']},
       {label:'Notifications mobiles',description:'Alertes',price:50,scope:'mobile',words:['notifications']}
     ]),
     isLocked:()=>window.__qpc.locked,
     currentTotal:(key)=>({value:key==='pwa'?700:1500,conflict:false}),
     initialRequest:()=> 'Connexion et galerie photo',
     apply:(value)=>{window.__qpc.applied.push(value);return true;}
   });
 },{locked,failedCatalogue});
}

test('new-quotation preview shows included work separately from optional paid extras',async({page})=>{
 await setup(page);
 await page.evaluate(()=>window.__qpc.instance.open());
 await expect(page.locator('#qpc-synthetic')).toBeVisible();
 await expect(page.locator('[data-qpc-preview]')).toContainText('Connexion');
 await expect(page.locator('[data-qpc-preview]')).toContainText('Galerie photo');
 const included=page.locator('[data-qpc-select="catalogue-0"]');
 const extra=page.locator('[data-qpc-select="catalogue-1"]');
 await expect(included).toBeChecked();
 await expect(extra).not.toBeChecked();
 await expect(page.locator('[data-qpc-total]')).toContainText('700');
 await extra.check();
 await expect(page.locator('[data-qpc-total]')).toContainText('800');
 await page.locator('[data-qpc-apply]').click();
 const applied=await page.evaluate(()=>window.__qpc.applied);
 expect(applied).toHaveLength(1);
 expect(applied[0].included.map(x=>x.label)).toEqual(['Connexion']);
 expect(applied[0].extras.map(x=>x.label)).toEqual(['Galerie photo']);
 await expect(page.locator('#qpc-synthetic')).toBeHidden();
});

test('cancel discards staged extras and never calls apply',async({page})=>{
 await setup(page);
 await page.evaluate(()=>window.__qpc.instance.open());
 await page.locator('[data-qpc-select="catalogue-1"]').check();
 await page.locator('[data-qpc-cancel]').click();
 expect(await page.evaluate(()=>window.__qpc.applied.length)).toBe(0);
 await expect(page.locator('#qpc-synthetic')).toBeHidden();
});

test('signed quotation and failed catalogue both fail closed',async({page})=>{
 await setup(page,true);
 expect(await page.evaluate(()=>window.__qpc.instance.open())).toBe(false);
 await expect(page.locator('#qpc-synthetic')).toBeHidden();
 await page.evaluate(()=>{window.__qpc.locked=false;});
 await page.evaluate(()=>window.__qpc.instance.open());
 await expect(page.locator('#qpc-synthetic')).toBeVisible();
 await page.evaluate(()=>window.__qpc.instance.close());
 expect(await page.evaluate(()=>window.__qpc.applied.length)).toBe(0);
});

test('offline catalogue cannot apply a guessed initial quote',async({page})=>{
 await setup(page,false,true);
 await page.evaluate(()=>window.__qpc.instance.open());
 await expect(page.locator('[data-qpc-error]')).toContainText('Impossible de lire le Catalogue');
 await expect(page.locator('[data-qpc-apply]')).toBeDisabled();
 await page.locator('[data-qpc-detect]').click();
 expect(await page.evaluate(()=>window.__qpc.applied.length)).toBe(0);
});

test('initial-quote calculator remains readable without horizontal page overflow on a phone',async({page},info)=>{
 test.skip(!info.project.name.includes('mobile'),'mobile viewport acceptance');
 await setup(page);
 await page.evaluate(()=>window.__qpc.instance.open());
 await page.locator('[data-qpc-kind]').selectOption('mobile');
 await page.locator('[data-qpc-detect]').click();
 await expect(page.locator('.qpc-grid')).toBeVisible();
 const dims=await page.locator('#qpc-synthetic').evaluate(el=>({width:el.getBoundingClientRect().width,viewport:window.innerWidth,doc:document.documentElement.scrollWidth}));
 expect(dims.width).toBeLessThanOrEqual(dims.viewport);
 expect(dims.doc).toBeLessThanOrEqual(dims.viewport+1);
});
