import { test, expect, type Page } from '@playwright/test';
async function practice(page: Page, classId: string) {
  await page.goto('/');
  await page.locator(`#entry-classes [data-class="${classId}"]`).click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-class', classId);
}
test('mantener clic carga la bola de fuego y soltar la lanza; un clic corto sigue normal', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await practice(page, 'mage');
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('#cd-shot')).toContainText('Cargando', { timeout: 2000 });
  await expect(page.locator('#cd-shot')).toHaveText('⚡ Cargando 100 %', { timeout: 3000 });
  await page.screenshot({ path: info.outputPath('carga-mago.png') });
  await page.mouse.up();
  await expect(page.locator('#stage')).toHaveAttribute('data-charge', '0');
  await expect(page.locator('#cd-shot')).toHaveText(/✦ 0\.\ds/);
  await page.waitForTimeout(160);
  await page.screenshot({ path: info.outputPath('gran-bola-de-fuego.png') });
  await expect(page.locator('#cd-shot')).toHaveText('✦ Lista', { timeout: 3000 });
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height / 2);
  await expect(page.locator('#cd-shot')).toHaveText(/✦ 0\.\ds/);
  expect(errors).toEqual([]);
});
test('nigromante: mantener espacio invoca al zombie con gorro', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await practice(page, 'necromancer');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2200);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('Space');
  await expect(page.locator('#cd-summon')).toContainText('Cargando', { timeout: 2000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: info.outputPath('carga-nigromante.png') });
  await page.keyboard.up('Space');
  await expect(page.locator('#cd-summon')).toHaveText(/☠ \d\/2 · [34]\.\ds/);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: info.outputPath('zombie-con-gorro.png') });
  expect(errors).toEqual([]);
});
