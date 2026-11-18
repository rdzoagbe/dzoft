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
 // One project page (17 Nov 2026): signed scope, one signed extra and one proposal still awaiting the client.
 const summaryFixture=location.search.includes('summaryFixture=1');
 if(summaryFixture)quote.accepted_data={f:{num:'D-SYNTHETIC-001'},lines:[{l:'Application web installable',q:1,p:1200},{l:'Comptes utilisateurs',q:1,p:300}]};
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
   if(table==='quotes')return location.search.includes('twoProjects=1')?[quote,Object.assign({},quote,{id:'d1e2f3a4-0000-4000-8000-000000000002',numero:'D-SYNTHETIC-002'})]:[quote];
   if(table==='clients')return [client];
   if(table==='settings')return [{id:1,google_client_id:window.__gcid||null,payment:{},default_line_price:25,price_blocks:[{label:'Page supplémentaire',price:120,words:['page']}],
    price_tiers:[{key:'retouche',label:'Retouche',rule:'Moins de 30 minutes',price:10},{key:'petite',label:'Petite',rule:'Une demi-journée au plus',price:25}]}];
   if(table==='project_events')return [{id:'synthetic-email-event',event_type:'payment_received',summary:'Synthetic payment notification',quote_id:qid,created_at:now}];
   if(table==='email_outbox')return [
    {id:'synthetic-client-email',event_id:'synthetic-email-event',recipient_role:'client',status:'sent',delivery_status:'delivered',sent_at:now,created_at:now},
    {id:'synthetic-owner-email',event_id:'synthetic-email-event',recipient_role:'owner',status:'sent',delivery_status:'unconfirmed',sent_at:now,created_at:now}
   ];
   return [];
  },
  rpc:async(name,args)=>{window.__syntheticCalls.push('rpc:'+name);
   // Backup: a fixed synthetic export; the status says none was made until one is.
   if(name==='owner_backup_status')return {last_backup_at:window.__backupAt||null,last_change_at:'2026-11-15T10:00:00Z'};
   if(name==='owner_backup_confirm'){window.__backupConfirmed=(window.__backupConfirmed||0)+1;window.__backupAt=new Date().toISOString();return window.__backupAt;}
   if(name==='owner_backup_export'){
     return {format:'dzoft-backup',version:1,exported_at:new Date().toISOString(),tables:{clients:[client],quotes:[quote],invoice_registry:[]},counts:{clients:1,quotes:1,invoice_registry:0,project_receipts:0}};}
   // Credit notes (« avoirs »): recorded in memory only.
   if(name==='issue_credit_note'){window.__credits=window.__credits||[];window.__creditArgs=args;
     const c={id:'cn-'+(window.__credits.length+1),number:'A-2026-000'+(window.__credits.length+1),quote_id:args.p_quote,invoice_id:args.p_invoice,invoice_number:'F-2026-0003',invoice_issued_on:'2026-11-15',invoice_amount:700,invoice_kind:'base',amount:args.p_amount==null?700:args.p_amount,effect:args.p_effect,full_cancel:args.p_amount==null,reason:args.p_reason,issued_on:'2026-11-18',issued_at:now};
     window.__credits.push(c);return c;}
   if(name==='is_owner')return true;
   if(name==='project_tracking'){
      // The server counts an extra only once invoiced: here the signed 200 € extra is not invoiced yet (remaining 700).
      if(summaryFixture)return {total:1500,base_total:1500,supplements:0,received:800,remaining:700,legacy:0,payment_statuses:[],updates:[],
        receipts:[{id:'rc-1',amount:450,method:'cash',received_on:'2026-11-04'},{id:'rc-2',amount:350,method:'transfer',received_on:'2026-11-14'}]};
      if(location.search.includes('invoiceFixture=1'))return {total:1500,base_total:1500,received:800,remaining:700,legacy:0,payment_statuses:[],
        receipts:[
          {id:'receipt-cash',invoice_id:'paid-cash',amount:450,method:'cash',received_on:'2026-11-04'},
          {id:'receipt-transfer',invoice_id:'paid-transfer',amount:350,method:'transfer',received_on:'2026-11-14'}
        ],updates:[],supplements:0,credit_notes:window.__credits||[],credits:(window.__credits||[]).filter(c=>c.effect==='reduce').reduce((n,c)=>n+c.amount,0)};
      return {total:1500,base_total:1500,received:450,remaining:1050,legacy:0,payment_statuses:[],receipts:[],updates:[],supplements:0};
    }
   // Unsent draft proposal (18 Nov 2026): « Modifier ce brouillon » re-prices it in place.
   if(location.search.includes('draftFixture=1')){
     window.__draft=window.__draft||{id:'33333333-3333-4333-8333-333333333333',title:'Ajouts demandés',status:'proposed',sent_at:null,proposal_number:'D-SYNTHETIC-001-C1',proposal_version:1,extra_price:400,already_done:true,timeline_impact:'',created_at:now,
       lines:location.search.includes('euroDiscount=1')?[{label:'Application complète',qty:1,price:30000},{label:'Remise commerciale',qty:1,price:-100}]
        :[{label:'Logo plus grand',qty:1,price:25,source:'j1'},{label:'Photo floutée avant le pass',qty:1,price:100,source:'j2'},{label:'Écran d’administration',qty:1,price:275},{label:'Vidéo de présentation',qty:1,price:0}]};
     if(name==='owner_list_change_requests')return [window.__draft];
     if(name==='owner_price_change_request'){window.__priceArgs=args;const t=args.p_lines.reduce((n,l)=>n+Math.round(l.qty*l.price*100),0)/100;
       window.__draft=Object.assign({},window.__draft,{lines:args.p_lines,extra_price:t,proposal_version:window.__draft.proposal_version+1,already_done:args.p_already_done});return window.__draft;}
   }
   if(name==='owner_list_change_requests')return summaryFixture?[
     {id:'11111111-1111-4111-8111-111111111111',title:'Synthetic signed extra',status:'approved',extra_price:200,decided_at:now,created_at:now,proposal_number:'D-SYNTHETIC-001-C1',lines:[{label:'Page',qty:1,price:200}]},
     {id:'22222222-2222-4222-8222-222222222222',title:'Synthetic pending proposal',status:'proposed',extra_price:500,created_at:now}]:[];
   if(name==='invoice_draft_amount')return {remaining:1050,has_final:false};
   if(name==='list_project_work_items')return work;
   if(name==='project_sync_overview')return {backend_enabled:true,last_success_at:now,last_checked:2,last_inserted:0};
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
    if(table==='settings'&&values&&'google_client_id' in values){window.__gcid=values.google_client_id;return Promise.resolve({});}
    return Promise.reject(Error('Read-only fixture'));
  },
  remove:()=>Promise.reject(Error('Read-only fixture')),
  signOut:async()=>{}
 };
})();
`;

async function syntheticOwner(page) {
 // Routes are set on the whole browser context, not only the page: once admin/sw.js controls the pages,
 // requests of the next page (e.g. after a dashboard quick button) go through the service worker,
 // which page-level routes do not see. The real sb.js would then load and send the page to sign-in.
 const ctx=page.context();
 await ctx.route(url => url.pathname.endsWith('/admin/sb.js'), async route=>{
   await route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:syntheticSb});
 });
 // Do not allow any private live API calls in these synthetic tests.
 await ctx.route('https://*.supabase.co/**', route=>route.abort('blockedbyclient'));
 await ctx.route('https://api.github.com/**', route=>route.fulfill({
  status:200,contentType:'application/json',body:'[]'
 }));
}

test('Owner dashboard renders real navigation and action panel with synthetic data', async ({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Since the 16 Nov redesign the owner lands on the global dashboard (#/tableau-de-bord);
 // the legacy "vue-classique" address forwards to the global overview.
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(250);
 if (!(await page.locator('#app').isVisible())) {
   const state=await page.evaluate(()=>({mockPresent:!!window.RDsb,fromUrl:typeof window.RDsb?.fromUrl,loginVisible:!!document.querySelector('#auth')&&!document.querySelector('#auth').hidden}));
   throw new Error('Synthetic admin failed to initialize: '+JSON.stringify({state,errors}));
 }
 await expect(page.locator('#app')).toBeVisible();
 await expect(page.locator('#auth')).toBeHidden();
 await expect(page.locator('#v-dash')).toBeVisible();
 await expect(page.locator('#sd-action-list')).toBeVisible();
 await expect(page.locator('#app .side [data-route="projets"]')).toBeAttached();
 await expect(page.locator('#app .side [data-route="tableau-de-bord"]')).toBeAttached();
 await expect(page.locator('#sd-stats')).toContainText('450');
 const todayText=await page.locator('#sd-stats').textContent();
 if(!/450/.test(todayText||'')){
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
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
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
 for(const route of ['tableau-de-bord','clients','devis','projets','comptabilite','messages','parametres'])
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
 await expect(menu.locator('button[data-app-route="comptabilite"]')).toContainText('Accounts');
 await menu.locator('button[data-app-route="comptabilite"]').click();
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
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 await page.locator('#app .side [data-route="clients"]').click();
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

test('Project quick actions open the payment, publish and message forms without new backend calls',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-workspace-action]')).toHaveText(['€ Enregistrer un paiement','✓ Publier une avancée','✉ Écrire au client','＋ Ajouter un supplément']);
 // Even with the payment details folded, the action unfolds them and opens the form.
 await page.evaluate(()=>{const d=document.getElementById('iv-payments-advanced');if(d)d.open=false;});
 await page.locator('[data-workspace-action="payment"]').click();
 await expect(page.locator('#tracking-admin details.tracking-editor:not(.tracking-report-editor)')).toHaveAttribute('open','');
 await expect(page.locator('#tracking-admin details.tracking-editor:not(.tracking-report-editor)')).toBeVisible();
 await page.locator('[data-workspace-action="progress"]').click();
 await expect(page.locator('#tracking-publish details.tracking-editor')).toHaveAttribute('open','');
 await page.locator('[data-workspace-action="message"]').click();
 await expect(page.locator('#c-msg')).toBeVisible();
 const calls=await page.evaluate(()=>window.__syntheticCalls);
 expect(calls.filter(c=>/issue_|record_project_payment|publish_project_updates/.test(c))).toEqual([]);
 expect(errors).toEqual([]);
});


test('Focused project navigation keeps overview, work, money, documents and messages accessible',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 const tabs=page.locator('.project-focus-tab');
 await expect(tabs).toHaveCount(5);
 await expect(page.locator('#project-panel-overview')).toBeVisible();
 await expect(page.locator('#project-panel-work')).toBeHidden();
 await expect(page.locator('#project-panel-billing')).toBeHidden();
 await expect(page.locator('[data-project-tab="overview"]')).toHaveAttribute('aria-selected','true');
 // 17 Nov 2026: one project page; the overview shows the client card and the money tiles.
 await expect(page.locator('.project-overview-card')).toHaveCount(0);
 await expect(page.locator('#ps-summary .ps-tile')).toHaveCount(4);
 await page.locator('[data-project-tab="work"]').click();
 await expect(page.locator('#project-panel-work')).toBeVisible();
 await expect(page.locator('#c-steps')).toBeVisible();
 await page.locator('[data-project-tab="billing"]').click();
 await expect(page.locator('#c-inv')).toBeVisible();
 await expect(page.locator('#iv-amount')).toBeEnabled();
 await expect(page.locator('#c-changes')).toBeVisible();
 await page.locator('[data-project-tab="documents"]').click();
 await expect(page.locator('#ps-docs')).toContainText('Devis signé');
 await expect(page.locator('#c-docs')).toBeVisible();
 await page.locator('[data-project-tab="messages"]').click();
 await expect(page.locator('#c-msg')).toBeVisible();
 await page.locator('#project-panel-messages .workspace-fold > summary').filter({hasText:/Historique des e-mails|Email and project activity/}).click();
 await expect(page.locator('#c-activity')).toBeVisible();
 await page.locator('[data-project-tab="overview"]').click();
 await expect(page.locator('#ps-summary .ps-tile').nth(3)).toContainText('€');
 await expect(page.locator('#project-panel-messages')).toBeHidden();
 const calls=await page.evaluate(()=>window.__syntheticCalls);
 expect(calls.filter(c=>/issue_|record_project_payment|publish_project_updates/.test(c))).toEqual([]);
 expect(errors).toEqual([]);
});

test('Owner home offers a single workspace search and safe quick actions',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#sd-find')).toBeVisible();
 await page.locator('#sd-find').click();
 await expect(page.locator('#v-dossiers')).toBeVisible();
 const search=page.locator('#dossier-search');
 await expect(search).toBeVisible();
 await search.fill('Synthetic');
 await expect(page.locator('.dzoft-case-result').first()).toBeVisible();
 // A money tile leads to billing; the trash is not a menu entry (it sits in Settings).
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await page.locator('#sd-stats [data-go="finance"]').first().click();
 await expect(page.locator('#v-finance')).toBeVisible();
 await expect(page.locator('#app .side [data-route="corbeille"]')).toHaveCount(0);
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
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 const side=page.locator('#app .side');
 const headerMenu=page.locator('#app .top .workspace-more');
 const logout=page.locator('#app .top #b-out');
 if(testInfo.project.name.includes('desktop')){
   await expect(side).toBeVisible();
   await expect(side.locator('[data-route="parametres"]')).toBeVisible();
   await expect(side.locator('.dzoft-v6-link')).toHaveCount(7);
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

test.describe('Dashboard to project page',()=>{
 test.use({serviceWorkers:'block'}); // the admin service worker must not serve the real sb.js on the next page
test('Dashboard is the global finance page; a project opens on its own page from it',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/\/admin\/#\/tableau-de-bord$/);
 await expect(page.locator('#v-dash')).toBeVisible();
 await expect(page.locator('#sd-title')).toContainText(/Tableau de bord|Dashboard/);
 await expect(page.locator('#sd-stats')).toContainText('1 500');
 await expect(page.locator('#app .side [data-route="tableau-de-bord"]')).toHaveAttribute('aria-current','page');
 const projectLink=page.locator('#sd-project-list a.sd-project').first();
 await expect(projectLink).toHaveAttribute('href','suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0');
 await projectLink.click();
 await expect(page).toHaveURL(/\/admin\/suivi\.html\?q=c8a50cee-3856-4539-98a3-f5df201dbff0/);
 await expect(page.locator('#ps-summary .ps-tile').first()).toContainText('1 500');
 expect(errors).toEqual([]);
});
});

test.describe('Cross-page synthetic finance navigation',()=>{
 test.use({serviceWorkers:'block'}); // Prevent registered PWA SW intercepting mocked sb.js on the next page.
 test('Old project addresses open the matching tab of the one project page; the menu marks Projets',async({page})=>{
 await syntheticOwner(page);
 const q='c8a50cee-3856-4539-98a3-f5df201dbff0';
 for(const [old,tab,target] of [['#documents','Documents','#ps-docs'],['#journal','Travail','#c-journal'],['#invoices','Argent','#c-inv'],['#activity','Messages','#c-msg']]){
  await page.goto('admin/projet.html?q='+q+old,{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/admin\/suivi\.html\?q=/);
  await expect(page.locator('.project-focus-tab[aria-selected="true"]')).toHaveText(tab);
  await expect(page.locator(target)).toBeVisible();
  await expect(page.locator('#dzoft-editor-sidebar a[aria-current="page"]')).toHaveAttribute('href','./#/projets');
 }
 });
});

test('Dashboard quick buttons open the right form inside the project, after choosing it',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // One accepted project: the button goes straight to it.
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#sd-quick [data-quick]')).toHaveCount(2);
 await page.locator('#sd-quick [data-quick="pay"]').click();
 await expect(page).toHaveURL(/suivi\.html\?q=c8a50cee-3856-4539-98a3-f5df201dbff0#billing$/);
 await expect(page.locator('#tracking-admin details.tracking-editor:not(.tracking-report-editor)')).toHaveAttribute('open','');
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0#work/publish',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#tracking-publish details.tracking-editor')).toHaveAttribute('open','');
 await expect(page).toHaveURL(/#work$/);
 // Several projects: a dialog asks which one; Cancel goes nowhere.
 await page.goto('admin/?twoProjects=1#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await page.locator('#sd-new-quote').click();await page.locator('#sd-new-extra-choice').click();
 await expect(page.locator('#sd-pick')).toBeVisible();
 await expect(page.locator('#sd-pick-select option')).toHaveCount(2);
 await page.locator('#sd-pick-cancel').click();
 await expect(page.locator('#sd-pick')).toBeHidden();
 await expect(page).toHaveURL(/#\/tableau-de-bord$/);
 await page.locator('#sd-new-quote').click();await page.locator('#sd-new-extra-choice').click();
 await page.locator('#sd-pick-select').selectOption('c8a50cee-3856-4539-98a3-f5df201dbff0');
 await page.locator('#sd-pick-go').click();
 await expect(page).toHaveURL(/suivi\.html\?q=c8a50cee-3856-4539-98a3-f5df201dbff0#billing/);
 await expect(page.locator('#dzoft-owner-changes .dzoft-change-new[data-new-proposal]')).toHaveAttribute('open','');
 expect(errors).toEqual([]);
});

test('« + Nouveau devis ou supplément » asks first: new project, or extra on a project in progress',async({page},testInfo)=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/?twoProjects=1#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#sd-new-quote')).toHaveText('+ Nouveau devis ou supplément');
 // Cancel: nothing happens.
 await page.locator('#sd-new-quote').click();
 await expect(page.locator('#sd-new')).toBeVisible();
 await expect(page.locator('#sd-new .sd-new-choice')).toHaveCount(2);
 if(testInfo.project.name.includes('mobile')){
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+4);
 }
 await page.locator('#sd-new-cancel').click();
 await expect(page.locator('#sd-new')).toBeHidden();
 await expect(page).toHaveURL(/#\/tableau-de-bord$/);
 // New project: the usual new-quote screen.
 await page.locator('#sd-new-quote').click();
 await page.locator('#sd-new-quote-choice').click();
 await expect(page).toHaveURL(/#\/devis/);
 // Extra: choose the project, then its calculator opens (nothing created yet).
 await page.goto('admin/?twoProjects=1#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 const before=await page.evaluate(()=>(window.__syntheticCalls||[]).filter(c=>/create_priced|price_change|change_proposal/.test(c)).length);
 await page.locator('#sd-new-quote').click();
 await page.locator('#sd-new-extra-choice').click();
 await expect(page.locator('#sd-pick')).toBeVisible();
 expect(await page.evaluate(()=>(window.__syntheticCalls||[]).filter(c=>/create_priced|price_change|change_proposal/.test(c)).length)).toBe(before);
 await page.locator('#sd-pick-select').selectOption('c8a50cee-3856-4539-98a3-f5df201dbff0');
 await page.locator('#sd-pick-go').click();
 await expect(page).toHaveURL(/suivi\.html\?q=c8a50cee-3856-4539-98a3-f5df201dbff0#billing/);
 await expect(page.locator('#dzoft-owner-changes .dzoft-change-new[data-new-proposal]')).toHaveAttribute('open','');
 expect(errors).toEqual([]);
});

test('Quick backup: encrypted download, readable with its password only, and a dashboard reminder until it is done',async({page},testInfo)=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Reminder while no backup exists, and it opens the backup section.
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 const reminder=page.locator('#sd-action-list [data-go="backup"]');
 await expect(reminder).toHaveCount(1);
 await reminder.click();
 await expect(page).toHaveURL(/#\/parametres$/);
 await expect(page.locator('#settings-backup')).toHaveAttribute('open','');
 await expect(page.locator('#backup-status')).toContainText('Aucune sauvegarde');
 // Passwords are checked before anything is asked from the server.
 const before=await page.evaluate(()=>window.__syntheticCalls.filter(c=>c==='rpc:owner_backup_export').length);
 await page.fill('#backup-pass','court');await page.fill('#backup-pass2','court');await page.click('#backup-save');
 await expect(page.locator('#backup-msg')).toContainText('au moins 10');
 await page.fill('#backup-pass','un-mot-de-passe-long');await page.fill('#backup-pass2','un-autre-mot-de-passe');await page.click('#backup-save');
 await expect(page.locator('#backup-msg')).toContainText('pas identiques');
 expect(await page.evaluate(()=>window.__syntheticCalls.filter(c=>c==='rpc:owner_backup_export').length)).toBe(before);
 // Save: one encrypted file, nothing readable in it.
 await page.fill('#backup-pass','un-mot-de-passe-long');await page.fill('#backup-pass2','un-mot-de-passe-long');
 const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#backup-save')]);
 expect(dl.suggestedFilename()).toMatch(/^dzoft-sauvegarde-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.dzoftbak$/);
 const file=testInfo.outputPath('backup.dzoftbak');await dl.saveAs(file);
 const raw=(await import('node:fs')).readFileSync(file,'utf8');const json=JSON.parse(raw);
 expect(json.format).toBe('dzoft-backup-encrypted');expect(json.cipher).toBe('AES-256-GCM');expect(json.kdf.iterations).toBe(310000);
 expect(raw).not.toContain('Synthetic Test Customer');
 await expect(page.locator('#backup-msg')).toContainText('Sauvegarde téléchargée');
 // The backup is recorded once, after the file was created, never by the export alone.
 await expect.poll(()=>page.evaluate(()=>window.__backupConfirmed||0)).toBe(1);
 await expect(page.locator('#backup-pass')).toHaveValue('');
 await expect(page.locator('#backup-status')).toContainText('Dernière sauvegarde');
 // Check: right password shows the contents; wrong password does not.
 await page.locator('#backup-verify-box summary').click();
 await page.setInputFiles('#backup-file',file);
 await page.fill('#backup-check-pass','mauvais-mot-de-passe');await page.click('#backup-verify');
 await expect(page.locator('#backup-check-result')).toContainText('Mot de passe incorrect');
 await page.fill('#backup-check-pass','un-mot-de-passe-long');await page.click('#backup-verify');
 await expect(page.locator('#backup-check-result')).toContainText('Sauvegarde lisible');
 await expect(page.locator('#backup-check-result')).toContainText('Clients');
 if(testInfo.project.name.includes('mobile')){
  const w=await page.evaluate(()=>({s:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  expect(w.s).toBeLessThanOrEqual(w.v+4);
 }
 expect(errors).toEqual([]);
});

test('Google Drive backup: one-time link, then one click sends the encrypted file to the DZOFT folder',async({page},testInfo)=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Google is simulated: no real sign-in, no real Drive.
 await page.addInitScript(()=>{
  window.__tokenRequests=0;
  window.google={accounts:{oauth2:{initTokenClient:(cfg)=>({requestAccessToken:()=>{window.__tokenRequests++;window.__scope=cfg.scope;window.__clientUsed=cfg.client_id;
    setTimeout(()=>window.__denyNext?(window.__denyNext=false,cfg.callback({error:'access_denied'})):cfg.callback({access_token:'synthetic-token'}),10);}})}}};
 });
 const uploads=[];let folderCreated=0;
 await page.context().route('https://accounts.google.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.context().route('https://www.googleapis.com/**',async r=>{
  const req=r.request(),url=req.url();
  expect(req.headers()['authorization']).toBe('Bearer synthetic-token');
  if(url.includes('/upload/drive/v3/files')){uploads.push(req.postData()||'');return r.fulfill({json:{id:'file-1',name:'dzoft-sauvegarde.dzoftbak',webViewLink:'https://drive.google.com/file/d/file-1/view'}});}
  if(req.method()==='GET')return r.fulfill({json:{files:folderCreated?[{id:'folder-1'}]:[]}});
  folderCreated++;return r.fulfill({json:{id:'folder-1'}});
 });
 await page.goto('admin/#/parametres',{waitUntil:'domcontentloaded'});
 await page.locator('#settings-backup summary').first().click();
 // Not linked yet: no Drive button, the one-time setting is open.
 await expect(page.locator('#backup-drive')).toBeHidden();
 await expect(page.locator('#backup-drive-setup')).toHaveAttribute('open','');
 await page.fill('#backup-drive-client','not-a-client-id');await page.click('#backup-drive-save');
 await expect(page.locator('#backup-drive-msg')).toContainText('ne ressemble pas');
 await page.fill('#backup-drive-client','123456789012-abcdef123.apps.googleusercontent.com');await page.click('#backup-drive-save');
 await expect(page.locator('#backup-drive-msg')).toContainText('relié');
 await expect(page.locator('#backup-drive')).toBeVisible();
 // Refused by Google: nothing recorded, clear message.
 await page.fill('#backup-pass','un-mot-de-passe-long');await page.fill('#backup-pass2','un-mot-de-passe-long');
 await page.evaluate(()=>{window.__denyNext=true;});
 await page.click('#backup-drive');
 await expect(page.locator('#backup-msg')).toContainText('Google n’a pas donné l’accès');
 expect(uploads.length).toBe(0);
 expect(await page.evaluate(()=>window.__backupConfirmed||0)).toBe(0);
 // Allowed: one click, the encrypted file lands in the DZOFT folder, then the backup is recorded.
 await page.click('#backup-drive');
 await expect(page.locator('#backup-msg')).toContainText('Sauvegarde enregistrée dans Google Drive');
 await expect(page.locator('#backup-msg a')).toHaveAttribute('href','https://drive.google.com/file/d/file-1/view');
 expect(await page.evaluate(()=>window.__scope)).toBe('https://www.googleapis.com/auth/drive.file');
 expect(folderCreated).toBe(1);expect(uploads.length).toBe(1);
 expect(uploads[0]).toContain('"parents":["folder-1"]');
 expect(uploads[0]).toContain('dzoft-backup-encrypted');
 expect(uploads[0]).not.toContain('Synthetic Test Customer');
 await expect.poll(()=>page.evaluate(()=>window.__backupConfirmed||0)).toBe(1);
 await expect(page.locator('#backup-pass')).toHaveValue('');
 if(testInfo.project.name.includes('mobile')){
  const w=await page.evaluate(()=>({s:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  expect(w.s).toBeLessThanOrEqual(w.v+4);
 }
 expect(errors).toEqual([]);
});

test('Google Drive backup recovers when Google’s script failed to load once',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__gcid='123456789012-abcdef123.apps.googleusercontent.com';});
 let scriptLoads=0;
 // First request for Google's script fails (network), the next one works and defines a simulated Google.
 await page.context().route('https://accounts.google.com/**',r=>{scriptLoads++;
  if(scriptLoads===1)return r.abort('failed');
  return r.fulfill({status:200,contentType:'application/javascript',body:"window.google={accounts:{oauth2:{initTokenClient:function(c){return {requestAccessToken:function(){setTimeout(function(){c.callback({access_token:'synthetic-token'});},10);}};}}}};"});});
 await page.context().route('https://www.googleapis.com/**',r=>{const url=r.request().url();
  if(url.includes('/upload/'))return r.fulfill({json:{id:'f',name:'x.dzoftbak',webViewLink:'https://drive.google.com/file/d/f/view'}});
  return r.fulfill({json:r.request().method()==='GET'?{files:[{id:'folder-1'}]}:{id:'folder-1'}});});
 await page.goto('admin/#/parametres',{waitUntil:'domcontentloaded'});
 await page.locator('#settings-backup summary').first().click();
 await expect(page.locator('#backup-drive')).toBeVisible();
 await expect.poll(()=>scriptLoads).toBe(1);
 await page.fill('#backup-pass','un-mot-de-passe-long');await page.fill('#backup-pass2','un-mot-de-passe-long');
 await page.click('#backup-drive');
 await expect(page.locator('#backup-msg')).toContainText('pas encore fini de se charger');
 // That click restarted the loading; the next click succeeds.
 await expect.poll(()=>scriptLoads).toBe(2);
 await expect.poll(()=>page.evaluate(()=>!!(window.google&&window.google.accounts))).toBe(true);
 await page.click('#backup-drive');
 await expect(page.locator('#backup-msg')).toContainText('Sauvegarde enregistrée dans Google Drive');
 expect(errors).toEqual([]);
});

test('Price list lives on the Catalogue page; the project calculator links to it',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/catalogue',{waitUntil:'domcontentloaded'});
 const box=page.locator('#dzoft-prices');
 await expect(box).toBeVisible();
 await expect(box.locator('[data-tier-price]')).toHaveCount(2);
 await expect(box.locator('[data-block-price]')).toHaveCount(1);
 await expect(box.locator('[data-default-price]')).toHaveValue('25');
 // Read-only fixture: saving reports an error instead of pretending it worked.
 await box.locator('[data-tier-save]').click();
 await expect(box.locator('.dzoft-change-message')).toContainText(/Read-only fixture/);
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0#billing/new-extra',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dzoft-owner-changes');
 await expect(dialog.locator('.dzoft-change-new[data-new-proposal]')).toHaveAttribute('open','');
 await expect(dialog.locator('.dzoft-price-link a')).toHaveAttribute('href','./#/catalogue');
 await expect(dialog.locator('[data-tier-save]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('The project page has the dashboard menu and a way back to Projets',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const q='c8a50cee-3856-4539-98a3-f5df201dbff0';
 await page.goto('admin/suivi.html?q='+q,{waitUntil:'domcontentloaded'});
 const side=page.locator('#dzoft-editor-sidebar');
 await expect(side.locator('a[aria-current="page"]')).toHaveAttribute('href','./#/projets');
 await expect(side.locator('nav a')).toHaveCount(7);
 await expect(side).toContainText('Comptabilité');
 await expect(page.locator('#suivi-back')).toHaveText(/Projets/);
 await expect(page.locator('#ttl')).toHaveText(/^Projet · D-SYNTHETIC-001/);
 expect(errors).toEqual([]);
});

test('Dashboard shows money at a glance and one to-do list, without the old shortcut and selected-project panels',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 const stats=page.locator('#sd-stats');
 await expect(stats).toContainText(/Déjà encaissé|Received and verified/);
 await expect(stats).toContainText(/ce mois-ci|this month/);
 await expect(stats).toContainText(/Prêt à facturer|Ready to invoice/);
 await expect(stats).toContainText(/Rien en attente|Nothing waiting/);
 await expect(page.locator('#sd-actions-title')).toHaveText(/À faire|To do/);
 await expect(page.locator('#v-dash .sd-shortcuts')).toHaveCount(0);
 await expect(page.locator('#sd-project-select')).toHaveCount(0);
 const over=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 expect(over).toBe(false);
 expect(errors).toEqual([]);
});

test('Admin polish: no repeated summary line on the project page, a quiet bin count',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const q='c8a50cee-3856-4539-98a3-f5df201dbff0';
 await page.goto('admin/suivi.html?q='+q,{waitUntil:'domcontentloaded'});
 // The next step is shown once (above the tabs), the balance once (in the money tiles).
 await expect(page.locator('.project-overview-money, .project-overview-line')).toHaveCount(0);
 await expect(page.locator('#ps-summary .ps-tile')).toHaveCount(4);
 // One way into an extra on the project page: the action at the top, not a second button in the summary.
 await expect(page.locator('#ps-summary [data-ps-new-extra]')).toHaveCount(0);
 await expect(page.locator('[data-workspace-action="extra"]')).toHaveCount(1);
 await page.locator('[data-workspace-action="extra"]').click();
 await expect(page.locator('#project-panel-billing')).toBeVisible();
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 const bin=page.locator('#app .side [data-count-for="parametres"]');
 if(await bin.count()&&await bin.isVisible()){
  const bg=await bin.evaluate(e=>getComputedStyle(e).backgroundColor);
  expect(bg).not.toBe('rgb(255, 90, 106)');
 }
 expect(errors).toEqual([]);
});

test('Phone bar shows four main entries and « Plus » opens the rest',async({page},testInfo)=>{
 test.skip(!testInfo.project.name.includes('mobile'),'Only the phone layout has the bar');
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
 const bar=page.locator('#app .side.dzoft-v6-nav');
 await expect(bar.locator('.dzoft-v6-link:visible')).toHaveCount(4);
 await expect(bar.locator('[data-route="comptabilite"]')).toBeHidden();
 const more=bar.locator('.dzoft-v6-more');
 await expect(more).toBeVisible();
 await more.click();
 await expect(more).toHaveAttribute('aria-expanded','true');
 await expect(bar.locator('[data-route="comptabilite"]')).toBeVisible();
 await bar.locator('[data-route="comptabilite"]').click();
 await expect(page).toHaveURL(/#\/comptabilite$/);
 await expect(more).toHaveAttribute('aria-expanded','false');
 await expect(bar.locator('[data-route="comptabilite"]')).toBeHidden();
 expect(errors).toEqual([]);
});

test('Project documents: contract, invoices and payments first, with archived invoice PDFs',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&invoiceFixture=1#documents',{waitUntil:'domcontentloaded'});
 const box=page.locator('#ps-docs');
 await expect(box.locator('.ps-doc-group').first()).toHaveText(/Contrat|Contract/);
 await expect(box).toContainText(/Factures|Invoices/);
 await expect(box).toContainText(/Paiements reçus|Payments received/);
 await expect(box.locator('[data-ps-file]')).toHaveCount(3);
 await expect(box.locator('[data-ps-doc="receipt"]')).toHaveCount(2);
 // « réglée » comes from recorded payments: the 700 € invoice has none.
 await expect(box.locator('.ps-doc',{hasText:'F-2026-0003'})).toContainText(/à régler|to pay/);
 await expect(box.locator('.ps-doc',{hasText:'F-2026-0001'})).toContainText(/réglée|paid/);
 const [download]=await Promise.all([page.waitForEvent('download'),box.locator('[data-ps-doc="quote"]').click()]);
 expect(download.suggestedFilename()).toMatch(/^Devis-signe-.*\.pdf$/);
 expect(errors).toEqual([]);
});

test('One project page: summary, five tabs, signed extras only, official documents and the old address',async({page},testInfo)=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const q='c8a50cee-3856-4539-98a3-f5df201dbff0';
 await page.goto('admin/suivi.html?q='+q+'&summaryFixture=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.project-focus-tab')).toHaveText(['Vue d’ensemble','Travail','Argent','Documents','Messages']);
 const summary=page.locator('#ps-summary');
 await expect(summary).toContainText('Synthetic Test Customer');
 await expect(summary.locator('.ps-tile').nth(0)).toContainText('1 500');
 // Only the signed extra counts; the proposal is shown apart, not added.
 await expect(summary.locator('.ps-tile').nth(1)).toContainText('200');
 await expect(summary.locator('.ps-tile').nth(1)).toContainText('500');
 await expect(summary.locator('.ps-tile').nth(1)).toContainText('non signés');
 await expect(summary.locator('.ps-tile').nth(2)).toContainText('800');
 // 1 500 + 200 (signed, not yet invoiced) − 800 received = 900, not the server's invoice-based 700.
 await expect(summary.locator('.ps-tile').nth(3)).toContainText('900');
 await expect(summary).toContainText('Application web installable');
 await expect(summary.locator('.ps-wait')).toContainText('Synthetic pending proposal');
 // Documents: contract, the signed extra (not the proposal), the two payment receipts.
 await page.locator('.project-focus-tab',{hasText:'Documents'}).click();
 const docs=page.locator('#ps-docs');
 await expect(docs).toContainText('Devis signé n° D-SYNTHETIC-001');
 await expect(docs).toContainText('D-SYNTHETIC-001-C1');
 await expect(docs).not.toContainText('Synthetic pending proposal');
 await expect(docs.locator('[data-ps-doc="receipt"]')).toHaveCount(2);
 const download=page.waitForEvent('download');
 await docs.locator('[data-ps-doc="quote"]').click();
 expect((await download).suggestedFilename()).toMatch(/^Devis-signe-D-SYNTHETIC-001/);
 await expect(page.locator('#c-docs')).toBeVisible();
 // « Ajouter un supplément » opens the priced proposal form in Argent.
 await page.locator('[data-workspace-action="extra"]').click();
 await expect(page.locator('.project-focus-tab[aria-selected="true"]')).toHaveText('Argent');
 await expect(page.locator('#dzoft-owner-changes .dzoft-change-new[data-new-proposal]')).toHaveAttribute('open','');
 // The old address opens the matching tab.
 await page.goto('admin/projet.html?q='+q+'#documents',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/suivi\.html\?q=c8a50cee-3856-4539-98a3-f5df201dbff0#documents$/);
 await expect(page.locator('.project-focus-tab[aria-selected="true"]')).toHaveText('Documents');
 if(testInfo.project.name.includes('mobile')){
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+4);
 }
 expect(errors).toEqual([]);
});

test('Invoice send window prepares editable Outlook and WhatsApp drafts without sending',async({page},testInfo)=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&invoiceFixture=1',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{window.__opened=[];window.open=(u)=>{window.__opened.push(String(u));return {opener:null,closed:false,close(){}};};});
 await page.locator('[data-project-tab="billing"]').click();
 const final=page.locator('#invs .invr').filter({hasText:'F-2026-0003'});
 await expect(final.locator('[data-a="invoice-send"]')).toBeVisible();
 await final.locator('[data-a="invoice-send"]').click();
 const d=page.locator('#invoice-send');
 await expect(d).toBeVisible();
 await expect(d.locator('[data-subject]')).toHaveValue(/Facture F-2026-0003/);
 await expect(d.locator('[data-email-body]')).toHaveValue(/facture n° F-2026-0003 d’un montant de 700,00/);
 await expect(d.locator('[data-email-body]')).toHaveValue(/espace\/\?projet=c8a50cee-3856-4539-98a3-f5df201dbff0&facture=unpaid-final&inscription=1/);
 await expect(d.locator('[data-msg]')).toHaveValue(/facture n° F-2026-0003/);
 await d.locator('[data-lang]').selectOption('en');
 await expect(d.locator('[data-msg]')).toHaveValue(/Here is your invoice F-2026-0003 for €700\.00/);
 await d.locator('[data-lang]').selectOption('fr');
 await page.screenshot({path:testInfo.outputPath('invoice-send.png')});
 const before=await page.evaluate(()=>window.__syntheticCalls.length);
 await d.locator('[data-recipient]').fill('demo@example.com');
 await d.locator('[data-outlook]').click();
 await expect(d.locator('[data-out]')).toContainText('Brouillon ouvert');
 await expect.poll(()=>page.evaluate(()=>window.__opened.length)).toBe(1);
 await d.locator('[data-phone]').fill('06 12 34 56 78');
 await d.locator('[data-wa-open]').click();
 await expect(d.locator('[data-out]')).toContainText('WhatsApp prêt');
 const opened=await page.evaluate(()=>window.__opened);
 expect(opened).toHaveLength(2);
 expect(opened[0]).toMatch(/^https:\/\/outlook\.live\.com\/mail\/0\/deeplink\/compose\?to=demo%40example\.com/);
 expect(opened[1]).toMatch(/^https:\/\/wa\.me\/33612345678\?text=/);
 expect(decodeURIComponent(opened[1].split('text=')[1])).toContain('F-2026-0003');
 const calls=await page.evaluate(n=>window.__syntheticCalls.slice(n),before);
 expect(JSON.stringify(calls)).not.toMatch(/emailAt|process-notification-outbox|invoice_shared/);
 await d.locator('[data-later]').click();
 await expect(d).toHaveCount(0);
 if(testInfo.project.name.includes('mobile')){
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+4);
 }
 expect(errors).toEqual([]);
});

test('Extra calculator: « Du … Au … » dates and a commercial discount in percent, recalculated with the lines',async({page},testInfo)=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&summaryFixture=1',{waitUntil:'domcontentloaded'});
 await page.locator('[data-workspace-action="extra"]').click();
 const form=page.locator('#dzoft-owner-changes form[data-change-offer]').first();
 await expect(form.locator('input[name="since"]')).toBeVisible();
 await expect(form.locator('input[name="until"]')).toBeVisible();
 // An end date before the start date is refused with a message.
 await form.locator('input[name="since"]').fill('2026-11-14');
 await form.locator('input[name="until"]').fill('2026-11-10');
 await form.locator('[data-calc-journal]').click();
 await expect(form.locator('[data-calc-summary]')).toContainText('avant la date « Du »');
 const rows=form.locator('[data-line]');
 await rows.first().locator('[name=label]').fill('Page supplémentaire');
 await rows.first().locator('[name=qty]').fill('2');
 await rows.first().locator('[name=price]').fill('100');
 await form.locator('[data-calc-add-line]').click();
 await rows.nth(1).locator('[name=label]').fill('Formulaire');
 await rows.nth(1).locator('[name=price]').fill('50');
 await form.locator('[data-calc-discount]').click();
 const disc=form.locator('[data-discount]');
 await disc.locator('[name=pct]').fill('10');
 // 2 × 100 + 50 = 250; 10 % = 25; total 225.
 await expect(disc.locator('[data-line-total]')).toContainText('25,00');
 await expect(form.locator('[data-calc-total]')).toContainText('225,00');
 // Changing an item updates the discount: 2 × 100 + 150 = 350; 10 % = 35; total 315.
 await rows.nth(1).locator('[name=price]').fill('150');
 await expect(disc.locator('[data-line-total]')).toContainText('35,00');
 await expect(form.locator('[data-calc-total]')).toContainText('315,00');
 await disc.scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('discount-percent.png')});
 if(testInfo.project.name.includes('mobile')){
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+4);
 }
 expect(errors).toEqual([]);
});

test('Invoice credit note: « Annuler ou réduire (avoir) » with full/partial and reason, then listed with its PDF',async({page},testInfo)=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&invoiceFixture=1',{waitUntil:'domcontentloaded'});
 await page.locator('[data-project-tab="billing"]').click();
 const final=page.locator('#invs .invr').filter({hasText:'F-2026-0003'});
 const btn=final.locator('[data-a="credit-note"]');
 await expect(btn).toBeVisible();
 // Paid invoices have nothing left to cancel.
 await expect(page.locator('#invs .invr').filter({hasText:'F-2026-0001'}).locator('[data-a="credit-note"]')).toHaveCount(0);
 await btn.click();
 const d=page.locator('#credit-note-dialog');
 await expect(d).toBeVisible();
 await expect(d).toContainText('la loi demande un avoir');
 await expect(d).toContainText('reste : 700,00');
 // Cancel closes without issuing anything.
 await d.locator('[data-cancel]').click();
 await expect(d).toHaveCount(0);
 expect(await page.evaluate(()=>window.__creditArgs||null)).toBeNull();
 await btn.click();
 await d.locator('[name=kind][value=part]').check();
 await expect(d.locator('[name=effect][value=reissue]')).toBeDisabled();
 await d.locator('[name=amount]').fill('800');
 await d.locator('[name=reason]').fill('Remise accordée pour le retard');
 await d.locator('[data-go]').click();
 await expect(d.locator('[data-out]')).toContainText('entre 0,01');
 await d.locator('[name=amount]').fill('50');
 await page.screenshot({path:testInfo.outputPath('credit-dialog.png')});
 await d.locator('[data-go]').click();
 await expect(d).toHaveCount(0);
 const args=await page.evaluate(()=>window.__creditArgs);
 expect(args).toMatchObject({p_invoice:'unpaid-final',p_amount:50,p_effect:'reduce',p_reason:'Remise accordée pour le retard'});
 expect(args.p_request_key).toMatch(/^[0-9a-f-]{36}$/);
 await expect(final.locator('.invoice-credits')).toContainText('A-2026-0001');
 await expect(final.locator('.invoice-credits')).toContainText('50,00');
 const download=page.waitForEvent('download');
 await final.locator('[data-a="credit-pdf"]').click();
 expect((await download).suggestedFilename()).toBe('Avoir-A-2026-0001.pdf');
 await page.screenshot({path:testInfo.outputPath('credit-listed.png')});
 if(testInfo.project.name.includes('mobile')){
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+4);
 }
 expect(errors).toEqual([]);
});

test('Calculator « Annuler » clears the lines and closes the form without saving anything',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&summaryFixture=1',{waitUntil:'domcontentloaded'});
 await page.locator('[data-workspace-action="extra"]').click();
 const det=page.locator('#dzoft-owner-changes .dzoft-change-new[data-new-proposal]');
 await expect(det).toHaveAttribute('open','');
 const form=det.locator('form[data-change-offer]');
 // Pre-filled line, as one added from the price list or the journal (values in the HTML attributes).
 await form.evaluate(f=>{const r=f.querySelector('[data-line]');r.querySelector('[name=label]').setAttribute('value','Ligne de la liste');r.querySelector('[name=price]').setAttribute('value','80');r.dataset.when='2026-11-10';r.querySelector('[data-line-detail]').textContent='Note de la liste';});
 await form.locator('[data-line] [name=label]').first().fill('Page supplémentaire');
 await form.locator('[data-line] [name=price]').first().fill('120');
 await expect(form.locator('[data-calc-total]')).toContainText('120,00');
 const before=await page.evaluate(()=>window.__syntheticCalls.filter(c=>/create_priced|price_change/.test(c)).length);
 await form.locator('[data-form-cancel="calc"]').click();
 await expect(det).not.toHaveAttribute('open','');
 await expect(form.locator('[data-line]')).toHaveCount(1);
 await expect(form.locator('[data-line] [name=label]').first()).toHaveValue('');
 await expect(form.locator('[data-calc-total]')).toContainText('0,00');
 // The fresh line keeps no note or date from the removed one.
 await expect(form.locator('[data-line] [data-line-detail]').first()).toHaveText('');
 expect(await form.locator('[data-line]').first().getAttribute('data-when')).toBe('');
 // A later reset must not bring the pre-filled line back.
 await form.evaluate(f=>f.reset());
 await expect(form.locator('[data-line] [name=label]').first()).toHaveValue('');
 await expect(form.locator('[data-line] [name=price]').first()).toHaveValue('');
 expect(await page.evaluate(()=>window.__syntheticCalls.filter(c=>/create_priced|price_change/.test(c)).length)).toBe(before);
 expect(errors).toEqual([]);
});

test('An unsent draft extra can be edited in place: add a line and a 30 % discount, same number, still a draft',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&draftFixture=1#billing',{waitUntil:'domcontentloaded'});
 const card=page.locator('#dzoft-owner-changes [data-change-card="33333333-3333-4333-8333-333333333333"]');
 await expect(card).toContainText('400,00');
 const edit=card.locator('details.dzoft-change-edit');
 await expect(edit.locator('summary')).toHaveText(/Modifier ce brouillon|Edit this draft/);
 await edit.locator('summary').click();
 const form=edit.locator('form[data-change-offer][data-edit]');
 await expect(form.locator('[data-line]')).toHaveCount(4);
 await expect(form.locator('[data-calc-total]')).toContainText('400,00');
 await expect(form.locator('[name=done]')).toBeChecked();
 // Cancel puts the saved lines back.
 await form.locator('[data-line]').first().locator('[data-line-remove]').click();
 await expect(form.locator('[data-line]')).toHaveCount(3);
 await form.locator('[data-form-cancel="calc"]').click();
 await expect(edit).not.toHaveAttribute('open','');
 await expect(form.locator('[data-line]')).toHaveCount(4);
 await expect(form.locator('[data-calc-total]')).toContainText('400,00');
 // Edit: add a 100 € line and a 30 % discount → 500 − 150 = 350.
 await edit.locator('summary').click();
 await form.locator('[data-calc-add-line]').click();
 const last=form.locator('[data-line]').last();
 await last.locator('[name=label]').fill('Comptes professionnels');
 await last.locator('[name=price]').fill('100');
 await form.locator('[data-calc-discount]').click();
 await form.locator('[data-discount] [name=pct]').fill('30');
 await expect(form.locator('[data-calc-total]')).toContainText('350,00');
 await form.locator('button[type=submit]').click();
 await expect.poll(()=>page.evaluate(()=>window.__priceArgs&&window.__priceArgs.p_request)).toBe('33333333-3333-4333-8333-333333333333');
 const args=await page.evaluate(()=>window.__priceArgs);
 expect(args.p_lines.find(l=>/Remise commerciale/.test(l.label))).toMatchObject({qty:1,price:-150});
 expect(args.p_lines.find(l=>l.label==='Logo plus grand').source).toBe('j1');
 expect(args.p_already_done).toBe(true);
 expect(args.p_lines.reduce((n,l)=>n+l.qty*l.price,0)).toBe(350);
 await expect(card).toContainText('350,00');
 await expect(card).toContainText('D-SYNTHETIC-001-C1');
 await expect(card.locator('[data-change-send]')).toBeVisible();
 expect(errors).toEqual([]);
});
test('Project page menu on a phone: closed = unreachable, open = focus inside, Escape gives focus back',async({page},testInfo)=>{
 test.skip(!testInfo.project.name.includes('mobile'),'Only the mobile layout is relevant');
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 const aside=page.locator('#dzoft-editor-sidebar'),toggle=page.locator('.dzoft-editor-menu-toggle');
 await expect(toggle).toBeVisible();
 // Closed: the off-screen menu is inert (no keyboard focus, hidden from screen readers).
 expect(await aside.evaluate(a=>a.inert)).toBe(true);
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 expect(await aside.evaluate(a=>a.inert)).toBe(false);
 await expect(aside.locator('a[href]').first()).toBeFocused();
 // Tab stays inside the open menu.
 const count=await aside.locator('a[href]').count();
 for(let i=0;i<count;i++)await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>document.getElementById('dzoft-editor-sidebar').contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(toggle).toBeFocused();
 expect(await aside.evaluate(a=>a.inert)).toBe(true);
 await expect(page.locator('.dzoft-editor-overlay')).toBeHidden();
 expect(errors).toEqual([]);
});

test('Project page menu on a computer stays reachable (never inert)',async({page},testInfo)=>{
 test.skip(testInfo.project.name.includes('mobile'),'Desktop layout only');
 await syntheticOwner(page);
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 const aside=page.locator('#dzoft-editor-sidebar');
 await expect(aside).toBeVisible();
 expect(await aside.evaluate(a=>a.inert)).toBe(false);
 await expect(page.locator('.dzoft-editor-overlay')).toBeHidden();
});

test('Journal « Importer des lignes » › Annuler forgets the pasted text and saves nothing',async({page})=>{
 await syntheticOwner(page);
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 await page.locator('[data-project-tab="work"]').click();
 await page.locator('details > summary').filter({hasText:'Journal privé du projet'}).first().click();
 const writes=[];
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
 await page.locator('.jr-advanced > summary').click();
 await page.locator('#jr-paste').click();
 await page.locator('#jr-text').fill('2026-11-18 | fait | Test à ne pas garder');
 await page.locator('#jr-cancel').click();
 await expect(page.locator('#jr-bulk')).toBeHidden();
 await expect(page.locator('#jr-paste')).toBeFocused();
 await page.locator('#jr-paste').click();
 await expect(page.locator('#jr-text')).toHaveValue('');
 await expect(page.locator('#journal')).not.toContainText('Test à ne pas garder');
 expect(writes).toEqual([]);
});

test('Editing a draft keeps an older discount saved in euros exact until its percentage is changed',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0&draftFixture=1&euroDiscount=1#billing',{waitUntil:'domcontentloaded'});
 const edit=page.locator('#dzoft-owner-changes details.dzoft-change-edit');
 await edit.locator('summary').click();
 const form=edit.locator('form[data-edit]');
 // 100 € off 30 000 € is about 0,33 %: the editor must not turn it into 99 €.
 await expect(form.locator('[data-calc-total]')).toContainText('29 900,00');
 await form.locator('[name=timeline]').fill('+ 2 jours');
 await form.locator('button[type=submit]').click();
 await expect.poll(()=>page.evaluate(()=>!!window.__priceArgs)).toBe(true);
 let args=await page.evaluate(()=>window.__priceArgs);
 expect(args.p_lines[1]).toMatchObject({label:'Remise commerciale',qty:1,price:-100});
 // Typing a percentage switches the line to a percentage discount.
 await page.evaluate(()=>{window.__priceArgs=null;});
 await edit.locator('summary').click();
 await form.locator('[data-discount] [name=pct]').fill('10');
 await expect(form.locator('[data-calc-total]')).toContainText('27 000,00');
 await form.locator('button[type=submit]').click();
 await expect.poll(()=>page.evaluate(()=>!!window.__priceArgs)).toBe(true);
 args=await page.evaluate(()=>window.__priceArgs);
 expect(args.p_lines[1]).toMatchObject({label:'Remise commerciale (10 %)',price:-3000});
 expect(errors).toEqual([]);
});

test('« Préparer l’e-mail » opens Hotmail (Outlook.com) with the quote, not the default mail app',async({page})=>{
 await syntheticOwner(page);
 await page.addInitScript(()=>{window.__opened=[];window.open=(u,t)=>{window.__opened.push(u);return {opener:1};};});
 await page.goto('admin/devis.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#b-mail')).toBeEnabled();
 await page.locator('#b-mail').click();
 await expect.poll(()=>page.evaluate(()=>window.__opened.length)).toBe(1);
 const url=new URL(await page.evaluate(()=>window.__opened[0]));
 expect(url.origin+url.pathname).toBe('https://outlook.live.com/mail/0/deeplink/compose');
 expect(url.searchParams.get('subject')).toMatch(/^Votre devis /);
 expect(url.searchParams.get('body').length).toBeGreaterThan(20);
 expect(page.url()).toContain('admin/devis.html');
});
