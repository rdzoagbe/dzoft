import {test,expect} from '@playwright/test';

// A fake, in-memory owner and quote. This suite never signs into Supabase,
// never reads the client's actual notes, never writes payments or sends an email.
const syntheticSb = `
(function(){
 window.__syntheticCalls=[];window.__syntheticVersion='20261114-debug';
 window.__syntheticUnhandled=[];window.addEventListener('unhandledrejection',e=>window.__syntheticUnhandled.push(String(e.reason?.message||e.reason||'unknown').slice(0,180)));
 const qid='c8a50cee-3856-4539-98a3-f5df201dbff0';
 const now=new Date().toISOString();
 const quote={
  id:qid,numero:'D-SYNTHETIC-001',client_id:'fictional-client',
  accepted_at:now,accepted_total:1500,total:1500,status:'accepté',
  shared:true,invoices:[],steps:[],journal:[{d:now.slice(0,10),k:'fait',t:'Synthetic journal check'}],
  care:{},env:{},data:{f:{delay:'',pay:'',fix:'',notes:''}}
 };
 if(location.search.includes('invoiceFixture=1')){
    quote.invoices=[
      {id:'paid-cash',n:'Facture d’acompte',num:'F-2026-0001',amt:450,basis:'receipt',generatedByDzoft:true,paid:true,issuedOn:'2026-11-04',file:'u/fictional/450.pdf',fileName:'F-2026-0001.pdf',fileSize:15500},
      {id:'paid-transfer',n:'Facture d’acompte',num:'F-2026-0002',amt:350,basis:'receipt',generatedByDzoft:true,paid:true,issuedOn:'2026-11-14',file:'u/fictional/350.pdf',fileName:'F-2026-0002.pdf',fileSize:15500},
      {id:'unpaid-final',n:'Facture de solde',num:'F-2026-0003',amt:700,basis:'final',generatedByDzoft:true,paid:false,issuedOn:'2026-11-15',file:'u/fictional/700.pdf',fileName:'F-2026-0003.pdf',fileSize:15500}
    ];
  }
  const client={id:'fictional-client',nom:'Synthetic Test Customer',email:'demo@example.invalid',
  entreprise:'Example Ltd',contact:'demo@example.invalid',user_id:null,portal_token:'synthetic'};
 const work=[{
  id:'synthetic-work-1',title:'GitHub · Venue QR codes (To verify)',status:'review',category:'venue',
  source_date:now.slice(0,10),source_group:'qr',created_at:now,published_at:null
 },{
  id:'synthetic-work-2',title:'Synthetic interface review',status:'working',category:'design',
  source_date:null,source_group:null,created_at:now,published_at:null
 }];
 const user={id:'owner-synthetic',email:'owner@example.invalid',app_metadata:{dzoft_owner:true},factors:[]};
 window.RDsb={
  ADMIN:location.origin+'/admin/',PORTAL:location.origin+'/espace/',
  session:()=>({access_token:'synthetic-test-only',user}),
  me:()=>Promise.resolve(user),
  fromUrl:()=>null,
  aal:()=> 'aal2',mfaFresh:()=>true,
  mfa:{passkey:{supported:()=>false},challenge:()=>Promise.reject('disabled'),verify:()=>Promise.reject('disabled')},
  select:async (table)=>{window.__syntheticCalls.push('select:'+table);
   if(table==='quotes')return [quote];
   if(table==='clients')return [client];
   if(table==='settings')return [{id:1,payment:{}}];
   if(table==='project_events')return [{id:'synthetic-email-event',event_type:'payment_received',summary:'Synthetic payment notification',quote_id:qid,created_at:now}];
   if(table==='email_outbox')return [
    {id:'synthetic-client-email',event_id:'synthetic-email-event',recipient_role:'client',status:'sent',delivery_status:'delivered',sent_at:now,created_at:now},
    {id:'synthetic-owner-email',event_id:'synthetic-email-event',recipient_role:'owner',status:'sent',delivery_status:'unconfirmed',sent_at:now,created_at:now}
   ];
   return [];
  },
  rpc:async(name)=>{window.__syntheticCalls.push('rpc:'+name);
   if(name==='is_owner')return true;
   if(name==='project_tracking'){
      if(location.search.includes('invoiceFixture=1'))return {total:1500,base_total:1500,received:800,remaining:700,legacy:0,payment_statuses:[],
        receipts:[
          {id:'receipt-cash',invoice_id:'paid-cash',amount:450,method:'cash',received_on:'2026-11-04'},
          {id:'receipt-transfer',invoice_id:'paid-transfer',amount:350,method:'transfer',received_on:'2026-11-14'}
        ],updates:[],supplements:0};
      return {total:1500,base_total:1500,received:450,remaining:1050,legacy:0,payment_statuses:[],receipts:[],updates:[],supplements:0};
    }
   if(name==='invoice_draft_amount')return {remaining:1050,has_final:false};
   if(name==='list_project_work_items')return work;
   if(name==='rodney_sync_overview')return {backend_enabled:true,last_success_at:now,last_checked:2,last_inserted:0};
   if(name==='sync_project_github_groups')return {added:0,checked:0,client_notified:false};
   if(name==='project_payment_admin_meta')return {};
   if(name==='brevo_delivery_monitor')return {webhook_configured:false,poll_enabled:true,received_events:1};
   return {};
  },
  fn:async()=>({}),
  files:{list:async()=>[],link:async()=>'',remove:()=>Promise.reject(Error('Read-only fixture')),upload:()=>Promise.reject(Error('Read-only fixture'))},
  insert:()=>Promise.reject(Error('Read-only fixture')),
  update:(table,id,values)=>{window.__syntheticCalls.push('update:'+table);
    if(table==='quotes'&&values&&values.progress_draft){quote.progress_draft=values.progress_draft;return Promise.resolve({});}
    return Promise.reject(Error('Read-only fixture'));
  },
  remove:()=>Promise.reject(Error('Read-only fixture')),
  signOut:async()=>{}
 };
})();
`;

async function syntheticOwner(page) {
 await page.route(url => url.pathname.endsWith('/admin/sb.js'), async route=>{
   await route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:syntheticSb});
 });
 // Do not allow any private live API calls in these synthetic tests.
 await page.route('https://*.supabase.co/**', route=>route.abort('blockedbyclient'));
 await page.route('https://api.github.com/**', route=>route.fulfill({
  status:200,contentType:'application/json',body:'[]'
 }));
}

test('Owner dashboard renders real navigation and action panel with synthetic data', async ({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(250);
 if (!(await page.locator('#app').isVisible())) {
   const state=await page.evaluate(()=>({mockPresent:!!window.RDsb,fromUrl:typeof window.RDsb?.fromUrl,loginVisible:!!document.querySelector('#auth')&&!document.querySelector('#auth').hidden}));
   throw new Error('Synthetic admin failed to initialize: '+JSON.stringify({state,errors}));
 }
 await expect(page.locator('#app')).toBeVisible();
 await expect(page.locator('#auth')).toBeHidden();
 await expect(page.locator('#today-action-center')).toBeVisible();
 await expect(page.locator('[data-tab="projects"]').first()).toBeAttached();
 await expect(page.locator('[data-tab="dash"]').first()).toBeAttached();
 const todayText=await page.locator('#today-action-center').textContent();
 if(!/450|Received|Reçu/.test(todayText||'')){
  const diagnostic=await page.evaluate(()=>({mock:window.__syntheticVersion,calls:window.__syntheticCalls,toast:document.querySelector('#toast')?.textContent,panels:document.querySelector('#dash-focus')?.textContent?.slice(0,120)}));
  throw new Error('Synthetic dashboard did not render verified payments: '+JSON.stringify({diagnostic,errors}));
 }
 expect(errors,'JavaScript exceptions in authenticated synthetic admin').toEqual([]);
});

test('Client project weekly review and private task statuses render without a real account',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{
  waitUntil:'domcontentloaded'
 });
 await page.locator('[data-project-tab="work"]').click();
 await page.locator('details > summary').filter({hasText:'Journal privé du projet'}).first().click();
 await page.waitForTimeout(250);
 if (!(await page.locator('#c-journal').isVisible())) {
  const state=await page.evaluate(()=>({url:location.href,mock:window.__syntheticVersion,hasSession:!!window.RDsb?.session(),calls:window.__syntheticCalls,unhandled:window.__syntheticUnhandled,loading:document.querySelector('#loading')?.textContent}));
  throw new Error('Synthetic project failed to render: '+JSON.stringify({state,errors}));
 }
 await expect(page.locator('#c-journal')).toBeVisible();
 await expect(page.locator('#jr-weekly-slot')).toContainText("This week's project review");
 await expect(page.locator('#jr-tasks-slot')).toContainText(/Tâches et validations|Tasks and approvals/);
 await expect(page.locator('#jr-tasks-slot')).toContainText(/À vérifier|To verify/);
 await expect(page.locator('#jr-weekly-slot')).toContainText('Background sync');
 await expect(page.locator('#jr-github-slot')).toContainText(/Activité de développement|GitHub/);
 await expect(page.locator('#jr-quick-text')).toBeVisible();
 expect(errors,'JavaScript exceptions in the synthetic client project').toEqual([]);
});

test('Read-only synthetic owner tests never emit network requests containing real client information',async({page})=>{
 const external=[];
 await syntheticOwner(page);
 page.on('request',req=>{
  if(req.url().includes('supabase.co/rest/v1')||req.url().includes('supabase.co/functions/v1'))external.push(req.url());
 });
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0');
 await page.locator('[data-project-tab="work"]').click();
 await page.locator('details > summary').filter({hasText:'Journal privé du projet'}).first().click();
 await expect.poll(async()=> {
  const text=await page.locator('#jr-tasks-slot').textContent();return /Tâches et validations|Tasks and approvals/.test(text||'');
 }).toBeTruthy();
 expect(external,'Synthetic browser tests should not send API calls to production').toEqual([]);
});


test('Brevo status appears per recipient in the authenticated admin, without sending anything',async({page})=>{
 await syntheticOwner(page);
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#email-log')).toContainText('Client: Delivered');
 await expect(page.locator('#email-log')).toContainText('You: Accepted by Brevo');
 await expect(page.locator('#email-delivery-health')).toContainText('Brevo delivery tracking active');
 await expect(page.locator('#email-log')).not.toContainText('You: Delivered');
});
test('Brevo status appears in private project activity with synthetic, read-only rows',async({page})=>{
 await syntheticOwner(page);
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#activity-log')).toContainText('Delivered');
 await expect(page.locator('#activity-log')).toContainText('Accepted by Brevo');
});


test('Regular mobile browser keeps its dock and normal header; installed-only menu stays hidden',async({page},testInfo)=>{
 test.skip(!testInfo.project.name.includes('mobile'),'Only the mobile layout is relevant');
 await syntheticOwner(page);
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 await expect(page.locator('body')).not.toHaveClass(/dzoft-installed-mobile/);
 await expect(page.locator('#app .side')).toBeVisible();
 await expect(page.locator('#app .top #b-out')).toBeHidden();
 await expect(page.locator('#app .workspace-more')).toBeVisible();
 await expect(page.locator('#dzoft-installed-app-menu')).toBeHidden();
});

test('Installed mobile admin has exactly one top menu, all routes, no bottom dock, and closes after navigation',async({page},testInfo)=>{
 test.skip(!testInfo.project.name.includes('mobile'),'Only the mobile layout is relevant');
 // Simulate the Android installed PWA display-mode flag without contacting a real account.
 await page.addInitScript(()=>{
   const original=window.matchMedia.bind(window);
   window.matchMedia=function(query){
     if(query==='(display-mode: standalone)')return {
       media:query,matches:true,onchange:null,addEventListener(){},removeEventListener(){},
       addListener(){},removeListener(){},dispatchEvent(){return false;}
     };
     return original(query);
   };
 });
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 await expect(page.locator('body')).toHaveClass(/dzoft-installed-mobile/);
 await expect(page.locator('#app .side')).toBeHidden();
 await expect(page.locator('#app .top .brand')).toBeHidden();
 await expect(page.locator('#app .top #b-out')).toBeHidden();
 await expect(page.locator('#app .top .workspace-more')).toBeHidden();
 const menu=page.locator('#dzoft-installed-app-menu'),toggle=page.locator('#dzoft-installed-menu-toggle');
 await expect(toggle).toBeVisible();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 for(const route of ['tableau-de-bord','dossiers','demandes','clients','devis','projets','messages','paiements','parametres','corbeille'])
   await expect(menu.locator('button[data-app-route="'+route+'"]')).toBeVisible();
 await expect(menu.locator('a[href="../?workspace=admin"]')).toBeVisible();
 await expect(menu.locator('button[data-app-action="logout"]')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();
 await menu.locator('button[data-app-route="parametres"]').click();
 await expect(page.locator('#v-settings')).toBeVisible();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await page.locator('#admin-language-settings button[data-dzoft-lang="en"]').click();
 await toggle.click();
 await expect(menu.locator('button[data-app-route="paiements"]')).toContainText('Payments');
 await menu.locator('button[data-app-route="paiements"]').click();
 await expect(page.locator('#v-finance')).toBeVisible();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 expect(errors,'Installed mobile menu should not introduce browser errors').toEqual([]);
 const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+4);
});


test('Settings redesign keeps payment, security, backups and legal controls tucked away until opened',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 await page.goto('admin/#/parametres',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v-settings')).toBeVisible();
 await expect(page.locator('#admin-language-settings')).toBeVisible();
 const french=page.locator('#admin-language-settings [data-dzoft-lang="fr"]');
 const english=page.locator('#admin-language-settings [data-dzoft-lang="en"]');
 await expect(french).toHaveAttribute('aria-pressed','true');
 await english.click();
 await expect(english).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('#settings-payment')).not.toHaveAttribute('open');
 await expect(page.locator('#settings-security')).not.toHaveAttribute('open');
 await expect(page.locator('#settings-backup')).not.toHaveAttribute('open');
 await expect(page.locator('#settings-legal')).not.toHaveAttribute('open');
 await expect(page.locator('#p-holder')).toBeHidden();
 await page.locator('#settings-payment>summary').click();
 await expect(page.locator('#p-holder')).toBeVisible();
 await expect(page.locator('#p-save')).toBeVisible();
 await page.locator('#settings-security>summary').click();
 await expect(page.locator('#mfa-box')).toBeVisible();
 await expect(page.locator('#settings-payment')).not.toHaveAttribute('open');
 await page.locator('#settings-backup>summary').click();
 await expect(page.locator('#backup-readiness')).toBeVisible();
 await page.locator('#settings-legal>summary').click();
 await expect(page.locator('#settings-legal a[href="../cgv-2026-10.html"]')).toBeVisible();
 expect(errors,'Settings redesign must not cause browser errors').toEqual([]);
 const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+4);
});

test('Installed mobile one-menu navigates to clean accordion Settings',async({page},testInfo)=>{
 test.skip(!testInfo.project.name.includes('mobile'),'Installed PWA check needs mobile viewport');
 await page.addInitScript(()=>{
  const original=window.matchMedia.bind(window);
  window.matchMedia=function(query){
   if(query==='(display-mode: standalone)')return {
    media:query,matches:true,onchange:null,addEventListener(){},removeEventListener(){},
    addListener(){},removeListener(){},dispatchEvent(){return false;}
   };
   return original(query);
  };
 });
 await syntheticOwner(page);
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('body')).toHaveClass(/dzoft-installed-mobile/);
 await page.locator('#dzoft-installed-menu-toggle').click();
 await page.locator('#dzoft-installed-menu-panel button[data-app-route="parametres"]').click();
 await expect(page.locator('#v-settings')).toBeVisible();
 await expect(page.locator('#admin-language-settings')).toBeVisible();
 await expect(page.locator('#app .side')).toBeHidden();
 await expect(page.locator('#dzoft-installed-menu-toggle')).toBeVisible();
 await expect(page.locator('#settings-payment')).not.toHaveAttribute('open');
 await page.locator('#settings-payment>summary').click();
 await expect(page.locator('#p-iban')).toBeVisible();
});


test('Invoice creator shows editable server-approved amount and prevents an excessive invoice',async({page})=>{
 await syntheticOwner(page);
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 await page.locator('[data-project-tab="billing"]').click();
 const amount=page.locator('#iv-amount');
 await expect(amount).toBeEnabled();
 await expect(amount).toHaveValue('1050.00');
 const issue=page.locator('[data-iv="final"]');
 await expect(issue).toBeEnabled();
 await amount.fill('350,50');
 await expect(page.locator('[data-iv-hint]')).toContainText('Facture intermédiaire');
 await expect(page.locator('[data-iv-hint]')).toContainText('699');
 await expect(issue).toBeEnabled();
 await amount.fill('1250');
 await expect(issue).toBeDisabled();
 await amount.fill('350.50');
 // Step 1 is a cancellable preview. No official number exists yet.
 await issue.click();
 const preview=page.locator('[data-invoice-review]');
 await expect(preview).toBeVisible();
 await expect(preview).toContainText('350,50');
 await preview.locator('[data-iv="cancel"]').click();
 await expect(preview).toBeHidden();
 await issue.click();
 await expect(preview).toBeVisible();
 // Step 2 is protected by an explicit final confirmation; dismiss it.
 page.once('dialog',async dialog=>dialog.dismiss());
 await preview.locator('[data-iv="confirm"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__syntheticCalls.filter(x=>x.includes('issue_')).length)).toBe(0);
 expect(await page.evaluate(()=>window.__syntheticUnhandled)).toEqual([]);
});


test('One search finds clients, quotes and projects without leaving the private workspace',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 await page.locator('#app .side [data-tab="dossiers"]').click();
 await expect(page.locator('#v-dossiers')).toBeVisible();
 const field=page.locator('#dossier-search');
 await expect(field).toBeVisible();
 await field.fill('Synthetic');
 await expect(page.locator('#dzoft-case-finder')).toBeVisible();
 await expect(page.locator('#dzoft-case-finder-count')).toContainText(/résultat|result/);
 await expect(page.locator('.dzoft-case-result').first()).toBeVisible();
 await page.locator('.dzoft-case-result').filter({hasText:/Projet|Project/}).first().click();
 await expect(page.locator('#v-projects')).toBeVisible();
 await field.fill('xyz-no-customer-exists');
 await expect(page.locator('.dzoft-case-empty')).toContainText(/Aucun résultat|No matching/);
 await field.press('Escape');
 await expect(page.locator('#dzoft-case-finder')).toBeHidden();
 expect(errors).toEqual([]);
});

test('Project quick links reveal real invoices, documents and activity without new backend calls',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 const docs=page.locator('[data-workspace-action="documents"]');
 await expect(docs).toBeVisible();
 await docs.click();
 await expect(page.locator('#c-docs')).toBeVisible();
 const history=page.locator('[data-workspace-action="history"]');
 await history.click();
 await expect(page.locator('#c-activity')).toBeVisible();
 await page.locator('[data-workspace-action="payment"]').click();
 await expect(page.locator('#c-inv')).toBeVisible();
 expect(errors).toEqual([]);
});


test('Focused project navigation keeps overview, work, invoices and messages accessible',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 const tabs=page.locator('.project-focus-tab');
 await expect(tabs).toHaveCount(4);
 await expect(page.locator('#project-panel-overview')).toBeVisible();
 await expect(page.locator('#project-panel-work')).toBeHidden();
 await expect(page.locator('#project-panel-billing')).toBeHidden();
 await expect(page.locator('[data-project-tab="overview"]')).toHaveAttribute('aria-selected','true');
 await page.locator('[data-open-project="work"]').click();
 await expect(page.locator('#project-panel-work')).toBeVisible();
 await expect(page.locator('#c-steps')).toBeVisible();
 await page.locator('[data-project-tab="billing"]').click();
 await expect(page.locator('#c-inv')).toBeVisible();
 await expect(page.locator('#iv-amount')).toBeEnabled();
 await page.locator('[data-project-tab="messages"]').click();
 await expect(page.locator('#c-msg')).toBeVisible();
 await page.locator('#project-panel-messages .workspace-fold > summary').filter({hasText:/Historique des e-mails|Email and project activity/}).click();
 await expect(page.locator('#c-activity')).toBeVisible();
 await page.locator('[data-project-tab="overview"]').click();
 await expect(page.locator('#project-overview-balance')).not.toBeEmpty();
 await expect(page.locator('#project-panel-messages')).toBeHidden();
 const calls=await page.evaluate(()=>window.__syntheticCalls);
 expect(calls.filter(c=>/issue_|record_project_payment|publish_project_updates/.test(c))).toEqual([]);
 expect(errors).toEqual([]);
});

test('Owner home offers a single workspace search and safe quick actions',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.owner-command-bar')).toBeVisible();
 const search=page.locator('#owner-global-search');
 await search.fill('Synthetic');
 await page.locator('.owner-command-search button[type="submit"]').click();
 await expect(page.locator('#v-dossiers')).toBeVisible();
 await expect(page.locator('#dossier-search')).toHaveValue('Synthetic');
 // Legacy operational overview is intentionally retained for existing tools.
 // The Dashboard tab itself now navigates to the redesigned finance landing.
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-quick="billing"]').click();
 await expect(page.locator('#v-finance')).toBeVisible();
 await expect(page.locator('#app .side [data-tab="trash"]')).toBeHidden();
 expect(errors).toEqual([]);
});

test('Financial dashboard shows actual receipts and outstanding money separately',async({page},testInfo)=>{
 await syntheticOwner(page);
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 const panel=page.locator('#today-action-center');
 await expect(panel).toContainText(/Reçu et confirmé|Received and verified/);
 await expect(panel).toContainText(/Reste à encaisser|Still outstanding/);
 await expect(panel).toContainText('450');
 await expect(page.locator('#app .top #b-install')).toBeHidden();
 if(testInfo.project.name.includes('desktop')){
   await expect(page.locator('#app .top #b-out')).toBeVisible();
   await expect(page.locator('#app .workspace-more')).toBeHidden();
 }else{
   await expect(page.locator('#app .top #b-out')).toBeHidden();
   await page.locator('#app .workspace-more>summary').click();
   await expect(page.locator('#app .workspace-more [data-extra="logout"]')).toBeVisible();
 }
});

test('Keeping progress private cannot publish or email the client',async({page})=>{
 await syntheticOwner(page);
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 await page.locator('[data-project-tab="work"]').click();
 await expect(page.locator('.tracking-private-intro')).toBeVisible();
 const editor=page.locator('#tracking-publish details.tracking-editor');
 await editor.locator('summary').click();
 const form=editor.locator('form');
 await form.locator('textarea[name=summary]').first().fill('Synthetic work requiring verification');
 await expect(form.locator('[name=audience][value=private]')).toBeChecked();
 await form.locator('[data-sharing-submit]').click();
 await expect(page.locator('#tracking-publish [role=status]').last()).toContainText(/Brouillon enregistré|Private draft saved/);
 await expect.poll(()=>page.evaluate(()=>window.__syntheticCalls.filter(s=>s.includes('publish_project_updates')||s.includes('owner_publish_github_progress_draft')).length)).toBe(0);
 await form.locator('[name=audience][value=client]').check();
 await form.locator('[data-sharing-submit]').click();
 await expect(page.locator('#tracking-publish [role=status]').last()).toContainText(/Cochez|Check the confirmation/);
 await form.locator('[name=verified]').check();
 page.once('dialog',dialog=>dialog.dismiss());
 await form.locator('[data-sharing-submit]').click();
 await expect.poll(()=>page.evaluate(()=>window.__syntheticCalls.filter(s=>s.includes('publish_project_updates')||s.includes('owner_publish_github_progress_draft')).length)).toBe(0);
});


test.describe('Populated invoice layout and bilingual receipts',()=>{
 test.use({serviceWorkers:'block'});
 test('Issued invoice cards stay full width and show independently confirmed receipts in both languages',async({page})=>{
 await syntheticOwner(page);
 // Block PWA SW registration in this synthetic test: a controlling service worker
 // bypasses Playwright route mocks on reload and replaces the fake owner session.
 await page.route('**/admin/sw.js',route=>route.abort('blockedbyclient'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&invoiceFixture=1';
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('[data-project-tab="billing"]').click();
 const records=page.locator('.invoice-record');
 await expect(records).toHaveCount(3);
 const ledger=page.locator('#iv-payment-truth');
 await expect(ledger).toContainText('800');
 await expect(ledger).toContainText('700');
 await expect(ledger).toContainText('450');
 await expect(ledger).toContainText('350');
 await expect(ledger).toContainText('Espèces');
 await expect(ledger).toContainText('Virement');
 await expect(records.nth(0).locator('.invoice-record-status')).toContainText('Paiement reçu et confirmé');
 await expect(records.nth(1).locator('.invoice-record-status')).toContainText('Paiement reçu et confirmé');
 await expect(records.nth(2).locator('.invoice-record-status')).toContainText('Aucun paiement reçu');
 await records.nth(2).locator('details.invoice-record-more > summary').click();
 await expect(records.nth(2).locator('.invoice-fixed-values')).toBeVisible();
 const geometry=await page.evaluate(()=>[...document.querySelectorAll('#invs .invoice-record')].map(card=>{
   const c=card.getBoundingClientRect(),h=card.querySelector('.invoice-record-head').getBoundingClientRect();
   const a=card.querySelector('.invoice-record-actions').getBoundingClientRect(),m=card.querySelector('.invoice-record-more').getBoundingClientRect();
   return {cw:c.width,hw:h.width,actionsTop:a.top,headerBottom:h.bottom,mw:m.width,ml:m.left,cl:c.left,mr:m.right,cr:c.right};
 }));
 for(const r of geometry){
  expect(r.hw).toBeGreaterThan(r.cw*.83);
  expect(r.actionsTop).toBeGreaterThanOrEqual(r.headerBottom-2);
  expect(r.mw).toBeGreaterThan(r.cw*.8);
  expect(r.ml).toBeGreaterThanOrEqual(r.cl);
  expect(r.mr).toBeLessThanOrEqual(r.cr+2);
 }
 await page.evaluate(()=>localStorage.setItem('dzoft-ui-locale','en'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-project-tab="billing"]').click();
 await expect(page.locator('.invoice-record')).toHaveCount(3);
 await expect(page.locator('#iv-payment-truth')).toContainText('Bank transfer');
 await expect(page.locator('#iv-payment-truth')).toContainText('Cash');
 await expect(page.locator('.invoice-record').nth(2).locator('details.invoice-record-more > summary')).toContainText('Invoice details');
 await expect(page.locator('.invoice-record').nth(2).locator('.invoice-record-status')).toContainText('No payment confirmed');
 expect(errors).toEqual([]);
});
});


test('Desktop shows sidebar navigation once and keeps direct logout; mobile retains account menu',async({page},testInfo)=>{
 await syntheticOwner(page);
 await page.goto('admin/#/vue-classique',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 const side=page.locator('#app .side');
 const headerMenu=page.locator('#app .top .workspace-more');
 const logout=page.locator('#app .top #b-out');
 if(testInfo.project.name.includes('desktop')){
   await expect(side).toBeVisible();
   await expect(side.locator('[data-tab="settings"]')).toBeVisible();
   await expect(headerMenu).toBeHidden();
   await expect(logout).toBeVisible();
   await expect(page.locator('#dzoft-installed-app-menu')).toBeHidden();
 }else{
   await expect(headerMenu).toBeVisible();
   await expect(logout).toBeHidden();
 }
});


test('Unpaid official invoice routes to verified receipt editor without recording money',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&invoiceFixture=1',{waitUntil:'domcontentloaded'});
 await page.locator('[data-project-tab="billing"]').click();
 const invoices=page.locator('#invs .invr');
 await expect(invoices).toHaveCount(3);
 await expect(invoices.locator('input.paid')).toHaveCount(0);
 const final=invoices.filter({hasText:'F-2026-0003'});
 await final.locator('details.invoice-record-more>summary').click();
 const start=final.locator('[data-a="record-payment"]');
 await expect(start).toBeVisible();
 const initial=await page.evaluate(()=>window.__syntheticCalls.filter(v=>v.startsWith('rpc:record_project_payment')).length);
 await start.click();
 await expect(page.locator('#iv-payments-advanced')).toHaveAttribute('open','');
 const receiptForm=page.locator('#tracking-admin details.tracking-editor:not(.tracking-report-editor)>form');
 await expect(receiptForm).toBeVisible();
 await expect(receiptForm.locator('select[name="invoice"]')).toHaveValue('unpaid-final');
 await expect(receiptForm.locator('input[name="amount"]')).toHaveValue('700');
 const after=await page.evaluate(()=>window.__syntheticCalls.filter(v=>v.startsWith('rpc:record_project_payment')).length);
 expect(after).toBe(initial);
 expect(errors).toEqual([]);
});


test('Settings language reacts to updated text and accessible labels, but never client-authored content',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('admin/#/parametres',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v-settings')).toBeVisible();
 await page.locator('#admin-language-settings [data-dzoft-lang="en"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.evaluate(()=>{
   const root=document.createElement('section');root.id='test-reactive-locale';
   root.innerHTML='<p id="test-reactive-status">Paiement reçu</p><input id="test-reactive-input" placeholder="Montant (€)" aria-label="Numéro officiel externe"><p data-no-translate id="test-authored-text">Annuler</p>';
   document.body.appendChild(root);
 });
 await expect(page.locator('#test-reactive-status')).toHaveText('Payment received');
 await expect(page.locator('#test-reactive-input')).toHaveAttribute('placeholder','Amount (€)');
 await expect(page.locator('#test-reactive-input')).toHaveAttribute('aria-label','Existing external invoice number');
 await expect(page.locator('#test-authored-text')).toHaveText('Annuler');
 // Reactivity: update the same Text node, and then change two existing attributes.
 await page.evaluate(()=>{
   document.querySelector('#test-reactive-status').firstChild.nodeValue='Annuler';
   const input=document.querySelector('#test-reactive-input');
   input.setAttribute('placeholder','Numéro officiel externe');
   input.setAttribute('aria-label','Montant (€)');
 });
 await expect(page.locator('#test-reactive-status')).toHaveText('Cancel');
 await expect(page.locator('#test-reactive-input')).toHaveAttribute('placeholder','Existing external invoice number');
 await expect(page.locator('#test-reactive-input')).toHaveAttribute('aria-label','Amount (€)');
 await page.locator('#admin-language-settings [data-dzoft-lang="fr"]').click();
 await expect(page.locator('#test-reactive-status')).toHaveText('Annuler');
 await expect(page.locator('#test-reactive-input')).toHaveAttribute('placeholder','Numéro officiel externe');
 await expect(page.locator('#test-reactive-input')).toHaveAttribute('aria-label','Montant (€)');
 await expect(page.locator('#test-authored-text')).toHaveText('Annuler');
 expect(errors).toEqual([]);
});


test('Standalone quote editor surfaces failed saves and supports Retry without real data writes',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('admin/devis.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#sheet')).toBeVisible();
 const name=page.locator('#c-name');
 await expect(name).toBeVisible();
 await name.fill('Synthetic quote save retry');
 await expect(page.locator('#sync')).toContainText('échec',{timeout:10000});
 const retry=page.locator('#b-retry');
 await expect(retry).toBeVisible();
 const before=await page.evaluate(()=>window.__syntheticCalls.filter(c=>c==='update:quotes').length);
 await retry.click();
 await expect.poll(()=>page.evaluate(()=>window.__syntheticCalls.filter(c=>c==='update:quotes').length)).toBeGreaterThan(before);
 await expect(retry).toBeVisible();
 await page.locator('#b-import').click();
 await page.locator('#importtext').fill('Draft pasted from a message');
 await page.locator('#b-cancel').click();
 await expect(page.locator('#importtext')).toHaveValue('');
 await expect(page.locator('#importbox')).not.toHaveClass(/open/);
 expect(errors).toEqual([]);
});

test('Dashboard now resolves to the redesigned finance page, not the legacy homepage',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/\/admin\/projet\.html\?q=c8a50cee-3856-4539-98a3-f5df201dbff0/);
 await expect(page.locator('#pf-shell')).toBeVisible();
 await expect(page.locator('.pf-dashboard-lead')).toContainText(/Tableau de bord|Dashboard/);
 await expect(page.locator('#pf-base')).toContainText('1 500');
 await expect(page.locator('#pf-side-dashboard')).toHaveAttribute('aria-current','page');
 expect(errors).toEqual([]);
});
