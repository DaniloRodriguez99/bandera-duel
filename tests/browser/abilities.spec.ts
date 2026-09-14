import { test, expect, type Page } from '@playwright/test';
async function practice(page: Page, classId: string) {
  await page.goto('/');
  await page.locator(`#entry-classes [data-class="${classId}"]`).click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#abilities')).toBeVisible();
}
test('panel de habilidades abajo a la izquierda con teclas y recargas', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const classId of ['archer', 'mage', 'necromancer', 'guardian', 'vanguard']) {
    await practice(page, classId);
    const panel = page.locator('#abilities');
    await expect(panel.locator('kbd').first()).toHaveText('CLIC');
    if (['archer', 'mage', 'necromancer'].includes(classId))
      await expect(panel.locator('kbd').nth(1)).toHaveText('ESPACIO');
    const stage = (await page.locator('#stage').boundingBox())!,
      box = (await panel.boundingBox())!;
    expect(box.x - stage.x).toBeLessThan(40);
    expect(stage.y + stage.height - (box.y + box.height)).toBeLessThan(40);
  }
  await practice(page, 'mage');
  await page.screenshot({ path: info.outputPath('habilidades-mago.png') });
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width * 0.7, canvas.y + canvas.height / 2);
  const shot = page.locator('#abilities [data-ability="shot"]');
  await expect(shot).toHaveAttribute('data-ready', 'false');
  await expect(shot.locator('.ability-state')).toHaveText(/^\d\.\ds$/);
  await expect(shot).toHaveAttribute('data-ready', 'true', { timeout: 3000 });
  await page.keyboard.press('Space');
  await expect(page.locator('#abilities [data-ability="dash"]')).toHaveAttribute('data-ready', 'false');
  await practice(page, 'necromancer');
  await page.keyboard.press('Space');
  const summon = page.locator('#abilities [data-ability="summon"]');
  await expect(summon).toHaveAttribute('data-ready', 'false');
  await expect(summon.locator('kbd')).toHaveText('ESPACIO');
  await page.screenshot({ path: info.outputPath('habilidades-nigromante.png') });
  expect(errors).toEqual([]);
});
test('en táctil el panel queda arriba a la izquierda sin tapar la palanca', async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await practice(page, 'archer');
  const panel = (await page.locator('#abilities').boundingBox())!,
    stick = (await page.locator('#stick-move').boundingBox())!;
  const overlap = !(
    panel.x + panel.width <= stick.x ||
    stick.x + stick.width <= panel.x ||
    panel.y + panel.height <= stick.y ||
    stick.y + stick.height <= panel.y
  );
  expect(overlap).toBe(false);
  expect(panel.y).toBeLessThan(stick.y);
  await page.screenshot({ path: info.outputPath('habilidades-movil.png') });
  await context.close();
});
