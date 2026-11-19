import { test, expect } from '@playwright/test';

async function ownerFixture(page, initiallyShared=false, secret=false, interfaceEnglish=false){
  await page.goto('admin/',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({url:'/assets/change-requests.js?v=20261119-french-dialog'});
  await page.addStyleTag({url:'/assets/change-requests.css?v=20261119-french-dialog'});
  await page.evaluate(({shared,secret,interfaceEnglish})=>{
    window.__manualReview={calls:[],opened:[]};
    window.confirm=()=>true;
    window.open=(url)=>{window.__manualReview.opened.push(url);return {opener:null};};
    const proposal={
      id:'12345678-1234-4234-9234-123456789abc',
      quote_id:'12345678-1234-4234-9234-123456789abd',
      client_id:'12345678-1234-4234-9234-123456789abe',
      title:'Extra work requested',status:'proposed',proposal_number:'D-TEST-C1',
      proposal_version:2,extra_price:350,
      lines:[{label:'Requested feature',qty:1,price:350}],
      created_at:'2026-11-18T19:00:00Z',sent_at:shared?'2026-11-18T20:00:00Z':null,
      history:[]
    };
    const sb={
      PORTAL:'https://example.org/client/',
      select:()=>Promise.resolve([]),
      rpc(name,args){
        window.__manualReview.calls.push(name);
        if(name==='owner_list_change_requests')return Promise.resolve([proposal]);
        if(name==='owner_mark_change_shared_manually'){
          proposal.sent_at='2026-11-18T21:00:00Z';
          return Promise.resolve({...proposal});
        }
        return Promise.reject(new Error('Unexpected operation: '+name));
      }
    };
    const root=document.createElement('div');
    root.id='manual-test-root';document.body.appendChild(root);
    window.__manualReview.ready=window.DzoftChanges.owner(root,{
      sb,quoteId:proposal.quote_id,en:interfaceEnglish,clientName:'Rodney K.',clientEmail:'test-client@example.com',
      clientPhone:'+33612345678',clientUserId:secret?null:'user-id',clientPortalToken:secret?'demo-secret-token':null,quoteNumber:'D-TEST',invoices:[]
    });
  },{shared:initiallyShared,secret,interfaceEnglish});
  await page.waitForFunction(()=>!!document.querySelector('#manual-test-root [data-change-send]'));
}

test('supplementary proposal must be reviewed in Outlook; draft does not send',async({page})=>{
  await ownerFixture(page);
  await page.locator('#manual-test-root [data-change-send]').click();
  const d=page.locator('#dzoft-change-manual-share');
  await expect(d).toBeVisible();
  await expect(d.locator('[data-share-email]')).toHaveValue('test-client@example.com');
  await expect(d.locator('[data-share-body]')).toHaveValue(/Aucune facture complémentaire ne sera émise sans votre accord préalable/);
  await expect(d.locator('[data-share-confirm]')).toBeDisabled();
  await d.locator('[data-share-outlook]').click();
  const state=await page.evaluate(()=>window.__manualReview);
  expect(state.opened.length).toBe(1);
  expect(state.opened[0]).toContain('outlook.live.com/mail/0/deeplink/compose');
  expect(state.opened[0]).toContain('test-client%40example.com');
  expect(state.calls).toEqual(['owner_list_change_requests']);
  await d.locator('[data-share-close]').click();
  await expect(d).toHaveCount(0);
});

test('explicit attestation unlocks proposal, without transactional email',async({page})=>{
  await ownerFixture(page);
  await page.locator('#manual-test-root [data-change-send]').click();
  const d=page.locator('#dzoft-change-manual-share');
  await d.locator('[data-share-checked]').check();
  await d.locator('[data-share-confirm]').click();
  await expect(d).toHaveCount(0);
  const calls=await page.evaluate(()=>window.__manualReview.calls);
  expect(calls).toContain('owner_mark_change_shared_manually');
  expect(calls).not.toContain('owner_send_change_proposal');
  expect(calls).not.toContain('process-notification-outbox');
});

test('already-shared proposal only prepares a follow-up, never requeues emails',async({page})=>{
  await ownerFixture(page,true);
  await page.locator('#manual-test-root [data-change-send]').click();
  const d=page.locator('#dzoft-change-manual-share');
  await expect(d).toBeVisible();
  await expect(d.locator('[data-share-confirm]')).toHaveCount(0);
  await d.locator('[data-share-outlook]').click();
  const calls=await page.evaluate(()=>window.__manualReview.calls);
  expect(calls).toEqual(['owner_list_change_requests']);
});

test('clients without accounts receive only their protected secret link and locked recipient',async({page})=>{
  await ownerFixture(page,false,true);
  await page.locator('#manual-test-root [data-change-send]').click();
  const d=page.locator('#dzoft-change-manual-share');
  await expect(d.locator('[data-share-email]')).toHaveAttribute('readonly','');
  const text=await d.locator('[data-share-body]').inputValue();
  expect(text).toContain('https://example.org/client/#demo-secret-token');
  expect(text).not.toContain('?projet=');
  await d.locator('[data-share-outlook]').click();
  const state=await page.evaluate(()=>window.__manualReview);
  expect(state.opened.length).toBe(1);
  expect(state.calls).toEqual(['owner_list_change_requests']);
});

test('English admin opens a polished, French-first client draft and safe live preview',async({page},testInfo)=>{
  await ownerFixture(page,false,false,true);
  await page.locator('#manual-test-root [data-change-send]').click();
  const d=page.locator('#dzoft-change-manual-share');
  await expect(d).toBeVisible();
  await expect(d.locator('[data-share-language]')).toHaveValue('fr');
  await expect(d.locator('[data-share-body]')).toHaveValue(/^Bonjour Rodney,/);
  await expect(d.locator('[data-share-preview]')).toContainText('1. PRESTATIONS COMPLÉMENTAIRES');
  await expect(d.locator('[data-share-preview]')).toContainText('350,00');
  await d.locator('[data-share-body]').fill('Bonjour Rodney,\n\nUn exemple personnalisé et relu.');
  await expect(d.locator('[data-share-preview]')).toContainText('Bonjour Rodney,');
  await expect(d.locator('[data-share-preview]')).toContainText('Un exemple personnalisé et relu.');
  await expect(d.locator('[data-share-language]')).toHaveValue('fr');
  const callState=await page.evaluate(()=>window.__manualReview);
  expect(callState.calls).toEqual(['owner_list_change_requests']);
  await d.screenshot({path:testInfo.outputPath('proposal-french-review.png')});
});
