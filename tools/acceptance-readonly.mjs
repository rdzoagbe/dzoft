/**
 * DZOFT authenticated acceptance — local, opt-in, read-only browser probe.
 * Run on the owner's trusted computer: node tools/acceptance-readonly.mjs [--client]
 * Never run in CI. No credentials, tokens, browser profiles, downloads or screenshots saved.
 */
import { chromium } from '@playwright/test';
import readline from 'node:readline/promises';
import process from 'node:process';

const BASE = 'https://rdzoagbe.github.io/dzoft/';
const API = 'rzghbvmszbjlqkdjzpxc.supabase.co';
const READ_RPCS = new Set([
  'is_owner','project_tracking','portal_project_tracking','owner_backup_status',
  'owner_open_change_requests','owner_list_change_requests','owner_list_credit_notes',
  'list_project_work_items','project_payment_admin_meta','invoice_draft_amount',
  'project_sync_overview','portal_get_project','my_space','my_projects','my_project'
]);
const NAV = [
  ['tableau-de-bord','#v-dash'],['clients','#v-clients'],
  ['devis','#v-quotes'],['projets','#v-projects'],
  ['comptabilite','#v-finance'],['messages','#v-inbox'],
  ['parametres','#v-settings']
];
const counts = { pass:0, fail:0, blocked:new Map() };
function report(name,ok) {
  counts[ok?'pass':'fail']++;
  process.stdout.write((ok?'PASS ':'FAIL ') + name + '\n');
}
function blocked(name) {
  counts.blocked.set(name,(counts.blocked.get(name)||0)+1);
}
async function protect(context) {
  await context.route('**/*', async route => {
    const request = route.request();
    let url;
    try { url = new URL(request.url()); } catch { await route.abort('blockedbyclient'); return; }
    const method = request.method().toUpperCase();
    const safeMethod = ['GET','HEAD','OPTIONS'].includes(method);
    // Permit only sign-in/passkey/TOTP verification writes to Supabase Auth.
    const authLogin = method==='POST' && url.hostname===API &&
      /^\/auth\/v1\/(?:token|verify|factors\/[a-zA-Z0-9_-]+\/(?:challenge|verify)|mfa\/(?:challenge|verify)|passkeys\/authentication\/(?:options|verify))\/?$/.test(url.pathname);
    const rpc = url.hostname===API && url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)\/?$/i);
    const readRPC = method==='POST' && rpc && READ_RPCS.has(rpc[1]);
    if (safeMethod || authLogin || readRPC) { await route.continue(); return; }
    blocked(rpc ? 'RPC '+rpc[1] : (url.hostname===API ? 'Supabase write' : 'external write'));
    await route.abort('blockedbyclient');
  });
}
async function visible(page,selector,timeout=12000) {
  try { await page.locator(selector).first().waitFor({state:'visible',timeout}); return true; }
  catch { return false; }
}
async function mobileWidth(page,label) {
  await page.setViewportSize({width:390,height:844});
  const fits=await page.evaluate(() => document.documentElement.scrollWidth<=document.documentElement.clientWidth+4);
  report(label,fits);
  await page.setViewportSize({width:1365,height:900});
}
async function contextFor(browser) {
  const context=await browser.newContext({
    viewport:{width:1365,height:900},acceptDownloads:false,serviceWorkers:'block'
  });
  await protect(context);
  return context;
}
async function anonymous(browser) {
  const context=await contextFor(browser);
  try {
    const page=await context.newPage();
    await page.goto(BASE+'admin/suivi.html?q=00000000-0000-4000-8000-000000000000',{waitUntil:'domcontentloaded'});
    let redirected=false;
    try { await page.waitForURL(u=>!u.pathname.endsWith('/admin/suivi.html'),{timeout:12000}); redirected=true; }
    catch {}
    report('Anonymous project guarded',redirected);
  } finally { await context.close(); }
}
async function owner(browser,prompt) {
  const context=await contextFor(browser);
  try {
    const page=await context.newPage();
    await page.goto(BASE+'admin/#/tableau-de-bord',{waitUntil:'domcontentloaded'});
    process.stdout.write('\nLog in in the browser as owner using normal passkey/password and TOTP. No secrets are collected.\n');
    if (!await visible(page,'#app',480000)) {report('Owner login',false);return;}
    report('Owner login',true);
    report('Login form hidden',!(await page.locator('#auth').isVisible()));
    for(const [name,selector] of NAV) {
      await page.evaluate(n=>{location.hash='#/'+n;},name);
      report('Admin '+name,await visible(page,selector));
    }
    await page.evaluate(()=>{location.hash='#/tableau-de-bord';});
    report('Dashboard stats container visible',await visible(page,'#sd-stats'));
    await mobileWidth(page,'Owner browser 390px viewport');
    process.stdout.write('\nOptional: open a project through the browser UI; do not change or save anything.\n');
    const reply=(await prompt.question('Press Enter once project is open, or type skip: ')).trim().toLowerCase();
    if(reply!=='skip') {
      const projectPage=context.pages().find(p=>p.url().includes('/admin/suivi.html?')) || page;
      const hasProject=projectPage.url().includes('/admin/suivi.html?');
      report('Project opened',hasProject);
      if(hasProject) {
        for(const name of ['overview','work','billing','documents','messages']) {
          const selector='[data-project-tab="'+name+'"]';
          const ready=await visible(projectPage,selector);
          if(ready)await projectPage.locator(selector).click();
          report('Project '+name,ready && await visible(projectPage,'#project-panel-'+name));
        }
        await mobileWidth(projectPage,'Project browser 390px viewport');
      }
    }
  } finally { await context.close(); }
}
async function client(browser) {
  const context=await contextFor(browser);
  try {
    const page=await context.newPage();
    await page.goto(BASE+'espace/',{waitUntil:'domcontentloaded'});
    process.stdout.write('\nUse only an explicitly authorized TEST client account. Do not impersonate a real client.\n');
    const loggedIn=await visible(page,'#app',480000);
    report('Client login',loggedIn);
    if(loggedIn) {
      report('Client login form hidden',!(await page.locator('#s-auth').isVisible()));
      report('Client homepage',await visible(page,'#app main, #app .hello'));
      await mobileWidth(page,'Client browser 390px viewport');
    }
  } finally { await context.close(); }
}
async function main() {
  if(process.env.CI)throw Error('Not permitted in CI — execute only on the owner computer.');
  const input=readline.createInterface({input:process.stdin,output:process.stdout});
  let browser;
  try {
    browser=await chromium.launch({headless:false});
    await anonymous(browser);
    await owner(browser,input);
    if(process.argv.includes('--client'))await client(browser);
  } finally { await browser?.close(); input.close(); }
  for(const [operation,n] of counts.blocked)process.stdout.write('BLOCKED '+operation+': '+n+'\n');
  process.stdout.write('\nRead-only results: '+counts.pass+' passed, '+counts.fail+' failed.\n');
  process.stdout.write('Not certified: physical PWA, passkey UV, 7-day MFA expiration, cross-client isolation, financial writes or actual full restore.\n');
  if(counts.fail || counts.blocked.size)process.exitCode=1;
}
main().catch(error=>{process.stderr.write('Probe stopped: '+String(error?.message||error).slice(0,180)+'\n');process.exitCode=1;});
