import {test,expect} from '@playwright/test';

// Synthetic-only: no real sessions, Supabase writes, client records, or messages.
test('deleting a priced quote line requires explicit confirmation; dismissal changes no total',async({page})=>{
 await page.route('**/admin/sb.js*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:"window.RDsb={session:()=>({user:{id:'test-owner'}}),aal:()=> 'aal2',mfaFresh:()=>true,PORTAL:'https://example.invalid/espace/'};"
 }));
 await page.goto('admin/devis.html',{waitUntil:'domcontentloaded'});
 await page.locator('[data-preset="0"]').click();
 const lines=page.locator('#lines tr:not(.grp)'),beforeCount=await lines.count();
 const totalBefore=await page.locator('#t-ttc').textContent();
 expect(beforeCount).toBeGreaterThan(0);
 const priced=lines.first(),label=await priced.locator('input.label').inputValue();
 const messages=[];
 page.once('dialog',async dialog=>{messages.push(dialog.message());await dialog.dismiss();});
 await priced.locator('button.rm').click();
 expect(messages[0]).toContain(label);
 await expect(lines).toHaveCount(beforeCount);
 await expect(page.locator('#t-ttc')).toHaveText(totalBefore);
 page.once('dialog',async dialog=>{messages.push(dialog.message());await dialog.accept();});
 await lines.first().locator('button.rm').click();
 await expect(lines).toHaveCount(beforeCount-1);
 expect(await page.locator('#t-ttc').textContent()).not.toBe(totalBefore);
});

test('supplementary client request Cancel cannot conceal an ongoing server save',async({page})=>{
 await page.goto('index.html',{waitUntil:'domcontentloaded'});
 await page.addScriptTag({url:'assets/change-requests.js?v=20261119-quote-catalogue1-ux20261120'});
 await page.evaluate(()=>{
  const root=document.createElement('div');root.id='dzoft-client-changes';
  document.body.prepend(root);
  window.__changeSaveCalls=0;
  window.__deferredChange=new Promise(resolve=>window.__resolveChange=resolve);
  window.DzoftChanges.client(root,{
   en:false,quoteId:'synthetic-quote',clientName:'Test Client',
   call(name){
    if(name==='list_change_requests')return Promise.resolve([]);
    if(name==='create_change_request'){window.__changeSaveCalls++;return window.__deferredChange;}
    return Promise.resolve({});
   }
  });
 });
 const card=page.locator('#dzoft-client-changes');
 await card.locator('.dzoft-change-new > summary').click();
 const form=card.locator('form[data-change-create]');
 await form.locator('[name=title]').fill('Ajouter un écran');
 await form.locator('[name=description]').fill('Un écran de consultation en plus pour le projet.');
 await form.locator('button[type=submit]').click();
 await expect.poll(()=>page.evaluate(()=>document.getElementById('dzoft-client-changes').__dzoftChangeBusy)).toBe(true);
 await form.locator('[data-form-cancel]').click();
 await expect(form.locator('[name=title]')).toHaveValue('Ajouter un écran');
 await expect(card.locator('.dzoft-change-new')).toHaveAttribute('open','');
 expect(await page.evaluate(()=>window.__changeSaveCalls)).toBe(1);
 await page.evaluate(()=>window.__resolveChange({id:'synthetic-change'}));
 await expect.poll(()=>page.evaluate(()=>document.getElementById('dzoft-client-changes').__dzoftChangeBusy)).toBe(false);
 await expect(card).toContainText('Action enregistrée.');
});
