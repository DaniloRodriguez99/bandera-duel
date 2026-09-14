import {test,expect} from '@playwright/test';
test('práctica sin servidor: disparar, reiniciar y volver al inicio',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/health',route=>route.abort());
  await page.route('**/rooms',route=>route.abort());
  await page.route('**/matchmake/**',route=>route.abort());
  await page.goto('/');
  await page.locator('#entry-classes [data-class="archer"]').click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role','practice');
  await expect(page.locator('#health')).toHaveText('♥ 3/3');
  await expect(page.locator('#practice-toolbar')).toHaveAttribute('data-dummy-hp','3');
  // Move into bow range and shoot along the open central lane.
  await page.keyboard.down('KeyD');await page.waitForTimeout(900);await page.keyboard.up('KeyD');
  const box=(await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x+650/960*box.width,box.y+270/540*box.height);
  await expect(page.locator('#practice-toolbar')).toHaveAttribute('data-dummy-hp','2');
  await page.locator('#practice-reset').click();
  await expect(page.locator('#practice-toolbar')).toHaveAttribute('data-dummy-hp','3');
  await page.locator('#practice-exit').click();
  await expect(page.locator('#intro')).toBeVisible();
  await expect(page.locator('#practice-toolbar')).toBeHidden();
  expect(page.url()).not.toContain('sala=');
  await page.locator('#entry-classes [data-class="vanguard"]').click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#health')).toHaveText('♥ 5/5');
  expect(errors).toEqual([]);
});
