import {test,expect} from '@playwright/test';

// A fake, in-memory owner and quote. This suite never signs into Supabase,
// never reads Rodney's actual notes, never writes payments or sends an email.
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
   return [];
  },
  rpc:async(name)=>{window.__syntheticCalls.push('rpc:'+name);
   if(name==='is_owner')return true;
   if(name==='project_tracking')return {received:450,remaining:1050,payment_statuses:[],receipts:[]};
   if(name==='list_project_work_items')return work;
   if(name==='rodney_sync_overview')return {backend_enabled:true,last_success_at:now,last_checked:2,last_inserted:0};
   if(name==='sync_project_github_groups')return {added:0,checked:0,client_notified:false};
   if(name==='project_payment_admin_meta')return {};
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

test('Rodney project weekly review and private task statuses render without a real account',async({page})=>{
 await syntheticOwner(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0',{
  waitUntil:'domcontentloaded'
 });
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
 expect(errors,'JavaScript exceptions in synthetic Rodney project').toEqual([]);
});

test('Read-only synthetic owner tests never emit network requests containing real client information',async({page})=>{
 const external=[];
 await syntheticOwner(page);
 page.on('request',req=>{
  if(req.url().includes('supabase.co/rest/v1')||req.url().includes('supabase.co/functions/v1'))external.push(req.url());
 });
 await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0');
 await expect.poll(async()=> {
  const text=await page.locator('#jr-tasks-slot').textContent();return /Tâches et validations|Tasks and approvals/.test(text||'');
 }).toBeTruthy();
 expect(external,'Synthetic browser tests should not send API calls to production').toEqual([]);
});
