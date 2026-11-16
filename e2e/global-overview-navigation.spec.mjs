import {test,expect} from '@playwright/test';

// Desktop/mobile read-only smoke of the canonical v6 dashboard shell.
// No client credentials or financial writes.
async function reveal(page){
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  document.getElementById('auth').hidden=true;
  document.getElementById('app').hidden=false;
  location.hash='#/tableau-de-bord';
  window.dispatchEvent(new Event('hashchange'));
  window.DzoftWorkspaceDashboard?.render({
    projects:[],ready:true,failures:0,unread:[],newLeads:0,
    waitingQuotes:0,activeProjects:0,english:false
  });
 });
}
test('one canonical dashboard and one active navigation item on desktop',async({page},info)=>{
 test.skip(info.project.name.includes('mobile'),'Desktop-specific');
 await reveal(page);
 const dash=page.locator('#app .side [data-route="tableau-de-bord"]');
 await expect(dash).toHaveCount(1);
 await expect(dash).toHaveAttribute('aria-current','page');
 await expect(page.locator('#sd-title')).toHaveText('Tableau de bord');
 await expect(page.locator('#sd-dashboard .sd-selected')).toBeHidden();
 expect(await page.locator('#app .side [aria-current="page"]').count()).toBe(1);
 await page.locator('#app .side [data-route="clients"]').click();
 await expect(page.locator('#v-dossiers')).toBeVisible();
 await expect(page.locator('#app .side [data-route="clients"]')).toHaveAttribute('aria-current','page');
 expect(await page.locator('#app .side [aria-current="page"]').count()).toBe(1);
});
test('installed mobile menu opens dashboard and closes after changing page',async({page},info)=>{
 test.skip(!info.project.name.includes('mobile'),'Installed mobile-only');
 await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true,configurable:true});});
 await reveal(page);
 await expect(page.locator('#dzoft-installed-app-menu')).toBeVisible();
 await page.locator('#dzoft-installed-menu-toggle').click();
 const dashboard=page.locator('#dzoft-installed-menu-panel [data-app-route="tableau-de-bord"]');
 await expect(dashboard).toHaveCount(1);
 await expect(dashboard).toHaveAttribute('aria-current','page');
 await page.locator('#dzoft-installed-menu-panel [data-app-route="clients"]').click();
 await expect(page.locator('#v-dossiers')).toBeVisible();
 await expect(page.locator('#dzoft-installed-app-menu')).not.toHaveAttribute('open','');
});
