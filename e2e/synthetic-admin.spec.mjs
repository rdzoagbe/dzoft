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
   if(name==='project_tracking')return {total:1500,received:450,remaining:1050,legacy:0,payment_statuses:[],receipts:[]};
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
  update:()=>Promise.reject(Error('Read-only fixture')),
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
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
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
 await page.locator('details > summary').filter({hasText:'Journal privé du projet'}).first().click();
 await expect.poll(async()=> {
  const text=await page.locator('#jr-tasks-slot').textContent();return /Tâches et validations|Tasks and approvals/.test(text||'');
 }).toBeTruthy();
 expect(external,'Synthetic browser tests should not send API calls to production').toEqual([]);
});


test('Brevo status appears per recipient in the authenticated admin, without sending anything',async({page})=>{
 await syntheticOwner(page);
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
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
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 await expect(page.locator('body')).not.toHaveClass(/dzoft-installed-mobile/);
 await expect(page.locator('#app .side')).toBeVisible();
 await expect(page.locator('#app .top #b-out')).toBeVisible();
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
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
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
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
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
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
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
