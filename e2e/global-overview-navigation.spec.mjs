import {test,expect} from '@playwright/test';

// Read-only navigation smoke: the DOM is revealed only inside Playwright so
// that the new shell can be checked without owner credentials or test accounts.
// This does NOT grant authenticated access or fetch any private data.
async function revealShell(page){
 await page.goto('admin/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.dzoft-global-overview')).toHaveCount(1);
 await page.evaluate(()=>{
  document.querySelector('#auth').hidden=true;
  document.querySelector('#app').hidden=false;
  location.hash='#/vue-globale';
  window.dispatchEvent(new Event('hashchange'));
 });
}
test('Vue globale has one selected destination and no duplicated client summary',async({page},testInfo)=>{
 test.skip(testInfo.project.name.includes('mobile'),'Desktop sidebar-only check');
 await revealShell(page);
 await expect(page.locator('#sd-title')).toHaveText('Vue globale');
 await expect(page.locator('.dzoft-global-overview')).toHaveAttribute('aria-current','page');
 await expect(page.locator('.side [data-tab="dash"]')).toHaveAttribute('aria-selected','false');
 await expect(page.locator('#sd-dashboard .sd-selected')).toBeHidden();
 await expect(page.locator('#sd-dashboard .sd-activity')).toBeVisible();
 await expect(page.locator('body')).toHaveClass(/dzoft-global-view/);
 const selected=await page.locator('.side [aria-selected="true"],.side [aria-current="page"]').count();
 expect(selected).toBe(1);
 await page.locator('.side [data-tab="dossiers"]').click();
 await expect(page.locator('.side [data-tab="dossiers"]')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.dzoft-global-overview')).not.toHaveAttribute('aria-current','page');
 await expect(page.locator('body')).not.toHaveClass(/dzoft-global-view/);
});
test('mobile installed navigation offers one global overview destination',async({page},testInfo)=>{
 test.skip(!testInfo.project.name.includes('mobile'),'Mobile-specific navigation check');
 await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true});});
 await revealShell(page);
 await expect(page.locator('#dzoft-installed-app-menu')).toBeVisible();
 await page.locator('#dzoft-installed-menu-toggle').click();
 const overview=page.locator('#dzoft-installed-menu-panel [data-app-route="vue-globale"]');
 await expect(overview).toBeVisible();
 await expect(overview).toHaveAttribute('aria-current','page');
 await overview.click();
 await expect(page.locator('#dzoft-installed-app-menu')).not.toHaveAttribute('open','');
});
