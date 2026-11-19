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
   window.__qpc.catalogue=[
    {label:'Connexion',description:'Authentification',price:100,scope:'pwa',words:['connexion']},
    {label:'Galerie photo',description:'Album client',price:100,scope:'extra',words:['galerie photo']},
    {label:'Notifications mobiles',description:'Alertes',price:50,scope:'mobile',words:['notifications']}
   ];
   window.__qpc.instance=window.DzoftQuotePricing.attach(panel,{
     packages:[
       {key:'pwa',kind:'pwa',label:'Application web installable (PWA)',price:700,presetIndex:2},
       {key:'mobile',kind:'mobile',label:'Application mobile',price:1500,presetIndex:3}
     ],
     loadCatalog:()=>failedCatalogue?Promise.reject(new Error('no catalogue')):Promise.resolve(window.__qpc.catalogue),
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

test('initial quote editor adds one base preset, included zero-euro scope and a reviewed paid extra',async({page})=>{
 // Exercise the REAL quote editor with a synthetic owner session; no external API.
 await page.route('**/admin/sb.js*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:"window.RDsb={session:()=>({user:{id:'synthetic'}}),aal:()=> 'aal2',mfaFresh:()=>true,select:()=>Promise.resolve([{price_blocks:[{label:'Connexion',description:'Authentification',price:90,scope:'pwa',words:['connexion']},{label:'Galerie photo',description:'Photos',price:100,scope:'extra',words:['galerie photo']}]}]),update:()=>{throw Error('No remote writes expected');},PORTAL:'https://example.org/espace/'};"
 }));
 await page.goto('admin/devis.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#b-estimate')).toBeEnabled();
 await page.locator('#b-estimate').click();
 await expect(page.locator('#quote-estimator')).toBeVisible();
 await page.locator('[data-qpc-request]').fill('Une connexion et une galerie photo.');
 await page.locator('[data-qpc-detect]').click();
 await expect(page.locator('[data-qpc-select="catalogue-0"]')).toBeChecked();
 await page.locator('[data-qpc-select="catalogue-1"]').check();
 await page.locator('[data-qpc-apply]').click();
 await expect(page.locator('#quote-estimator')).toBeHidden();
 await expect(page.locator('#lines tr.grp')).toHaveCount(3);
 await expect(page.locator('#t-ttc')).toContainText('800,00');
 await expect(page.locator('#lines tr:not(.grp)')).toHaveCount(6);
 // Input values are not DOM text, so inspect the actual editable line model and computed totals.
 const lines=await page.locator('#lines tr:not(.grp)').evaluateAll(rows=>rows.map(row=>({
  label:row.querySelector('input.label')?.value,
  total:row.querySelector('.tot')?.textContent
 })));
 expect(lines.some(x=>x.label==='Connexion'&&x.total?.includes('0,00'))).toBe(true);
 expect(lines.some(x=>x.label==='Galerie photo'&&x.total?.includes('100,00'))).toBe(true);
 // Applying the same suggestion twice must not add another paid line.
 await page.locator('#b-estimate').click();
 await page.locator('[data-qpc-request]').fill('Une connexion et une galerie photo.');
 await page.locator('[data-qpc-detect]').click();
 await expect(page.locator('[data-qpc-select="catalogue-1"]')).toBeDisabled();
 await expect(page.locator('#t-ttc')).toContainText('800,00');
});

test('fresh catalogue may reclassify an included service as paid but cannot precheck it',async({page})=>{
 await setup(page);
 await page.evaluate(()=>window.__qpc.instance.open());
 await expect(page.locator('[data-qpc-select="catalogue-0"]')).toBeChecked();
 await page.locator('[data-qpc-cancel]').click();
 // Simulate owner changing the Catalogue after the first calculator visit.
 await page.evaluate(()=>{window.__qpc.catalogue[0].scope='extra';});
 await page.evaluate(()=>window.__qpc.instance.open());
 await expect(page.locator('[data-qpc-select="catalogue-0"]')).not.toBeChecked();
 await expect(page.locator('[data-qpc-total]')).toContainText('700');
 await page.locator('[data-qpc-select="catalogue-0"]').check();
 await expect(page.locator('[data-qpc-total]')).toContainText('800');
});

test('legacy quote with a one-line negotiated package price never gets a duplicate base',async({page})=>{
 const id='00000000-0000-4000-8000-000000000140';
 await page.route('**/admin/sb.js*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:"window.RDsb={session:()=>({user:{id:'synthetic'}}),aal:()=> 'aal2',mfaFresh:()=>true,select:(table)=>Promise.resolve(table==='quotes'?[{id:'00000000-0000-4000-8000-000000000140',data:{lines:[{l:'Application web installable (PWA)',s:'Ancien devis',q:1,u:'forfait',p:650}],host:[],f:{num:'D-TEST-140'}}}]:[{price_blocks:[{label:'Galerie photo',description:'Album',price:100,scope:'extra',words:['galerie photo']}]}]),update:()=>Promise.resolve([]),PORTAL:'https://example.org/espace/'};"
 }));
 await page.goto('admin/devis.html?q='+id,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#b-estimate')).toBeEnabled();
 await expect(page.locator('#t-ttc')).toContainText('650,00');
 await page.locator('#b-estimate').click();
 await expect(page.locator('[data-qpc-kind]')).toHaveValue('pwa');
 await page.locator('[data-qpc-request]').fill('Une galerie photo pour les visiteurs');
 await page.locator('[data-qpc-detect]').click();
 await expect(page.locator('[data-qpc-total]')).toContainText('750,00');
 await page.locator('[data-qpc-select="catalogue-0"]').check();
 await page.locator('[data-qpc-apply]').click();
 await expect(page.locator('#t-ttc')).toContainText('750,00');
 await expect(page.locator('#lines tr:not(.grp)')).toHaveCount(2);
 const labels=await page.locator('#lines tr:not(.grp) input.label').evaluateAll(xs=>xs.map(x=>x.value));
 expect(labels).toEqual(['Application web installable (PWA)','Galerie photo']);
});
