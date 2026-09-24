import {test,expect} from '@playwright/test';
test('arquero practica trampas y triple en teclado y táctil',async({page,browser})=>{
 await page.goto('/');await page.locator('#entry-classes [data-class="archer"]').click();await page.locator('#practice-start').click();
 await expect(page.locator('#stage')).toHaveAttribute('data-class','archer');
 await page.keyboard.press('KeyQ');await expect(page.locator('#stage')).toHaveAttribute('data-traps','1');
 await page.keyboard.press('KeyE');await expect(page.locator('#cd-volley')).toContainText('s');
 const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 try {
  const touch=await mobile.newPage();
  await touch.goto('/');
  await touch.locator('#entry-classes [data-class="archer"]').click();
  await touch.locator('#practice-start').click();
  await touch.locator('#touch-trap').tap();
  await expect(touch.locator('#stage')).toHaveAttribute('data-traps','1');
  await touch.locator('#touch-volley').tap();
  await expect(touch.locator('#touch-volley')).toHaveAttribute('data-ready','false');
 } finally { await mobile.close(); }
});
