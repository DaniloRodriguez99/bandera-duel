import {test,expect} from '@playwright/test';
test('mantener clic carga y soltar dispara; cancelar no dispara',async({page})=>{
 await page.goto('/');await page.locator('#entry-classes [data-class="archer"]').click();await page.locator('#practice-start').click();
 const box=(await page.locator('canvas').boundingBox())!;await page.mouse.move(box.x+box.width*.7,box.y+box.height/2);
 await page.mouse.down();await expect(page.locator('#cd-shot')).toContainText('Cargada');
 await page.mouse.up();await expect(page.locator('#stage')).toHaveAttribute('data-charge','0');await expect(page.locator('#cd-shot')).toContainText('s');
 await page.locator('#practice-reset').click();await page.mouse.move(box.x+box.width*.7,box.y+box.height/2);await page.mouse.down();
 await expect(page.locator('#cd-shot')).toContainText('Cargada');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.mouse.up();await expect(page.locator('#stage')).toHaveAttribute('data-charge','0');await expect(page.locator('#cd-shot')).toContainText('Lista');
});
