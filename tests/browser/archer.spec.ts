import {test,expect} from '@playwright/test';
test('arquero practica trampas y triple en teclado y táctil',async({page})=>{
 await page.goto('/');await page.locator('#entry-classes [data-class="archer"]').click();await page.locator('#practice-start').click();
 await expect(page.locator('#stage')).toHaveAttribute('data-class','archer');
 await page.keyboard.press('KeyQ');await expect(page.locator('#stage')).toHaveAttribute('data-traps','1');
 await page.keyboard.press('KeyE');await expect(page.locator('#cd-volley')).toContainText('s');
 await page.locator('#practice-reset').click();
 await page.setViewportSize({width:844,height:390});
 await page.locator('#touch-trap').dispatchEvent('pointerdown');
 await expect(page.locator('#stage')).toHaveAttribute('data-traps','1');
 await page.locator('#touch-volley').dispatchEvent('pointerdown');
 await expect(page.locator('#touch-volley')).toContainText('s');
});
