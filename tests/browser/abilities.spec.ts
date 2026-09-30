import { test, expect, type Page } from '@playwright/test';
async function practice(page: Page, classId: string, mobile = false) {
  await page.goto('/');
  await page.locator(`#entry-classes [data-class="${classId}"]`).click();
  await page.locator('#practice-start').click();
  await expect(page.locator(mobile ? '#touch-controls' : '#abilities')).toBeVisible();
}
test('panel de habilidades abajo a la izquierda con teclas y recargas', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const classId of ['archer', 'mage', 'necromancer', 'guardian', 'vanguard']) {
    await practice(page, classId);
    const panel = page.locator('#abilities');
    // Every class, the same seven positions and keys: M1 M2 · Q E F R, and Space.
    await expect(panel.locator('.ability kbd')).toHaveText(['CLIC', 'CLIC DER.', 'Q', 'E', 'F', 'R', 'ESPACIO']);
    const stage = (await page.locator('#stage').boundingBox())!,
      box = (await panel.boundingBox())!;
    expect(box.x - stage.x).toBeLessThan(40);
    expect(stage.y + stage.height - (box.y + box.height)).toBeLessThan(40);
  }
  await practice(page, 'mage');
  await page.screenshot({ path: info.outputPath('habilidades-mago.png') });
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width * 0.7, canvas.y + canvas.height / 2);
  const shot = page.locator('#abilities [data-ability="shot"]');
  await expect(shot).toHaveAttribute('data-ready', 'false');
  await expect(shot.locator('.ability-state')).toHaveText(/^\d\.\ds$/);
  await expect(shot).toHaveAttribute('data-ready', 'true', { timeout: 3000 });
  await page.keyboard.press('Space');
  await expect(page.locator('#abilities [data-ability="dash"]')).toHaveAttribute('data-ready', 'false');
  await practice(page, 'necromancer');
  // No mobility of its own: Space is a locked position, and the summon is its powerful F.
  await expect(page.locator('#abilities [data-position="mobility"] .ability')).toHaveAttribute('data-locked', 'true');
  await page.keyboard.press('KeyF');
  const summon = page.locator('#abilities [data-ability="summon"]');
  await expect(summon).toHaveAttribute('data-ready', 'false');
  await expect(summon.locator('kbd')).toHaveText('F');
  await expect(page.locator('#abilities [data-ability="mark"] kbd')).toHaveText('CLIC DER.');
  await expect(page.locator('#abilities .ability-tree li', { hasText: 'zombie mago' })).toBeVisible();
  const command = page.locator('#abilities [data-ability="command"] .ability-state');
  await expect(command).toHaveText('Mando');
  await page.keyboard.press('e');
  await expect(command).toHaveText('Auto');
  await expect(page.locator('#abilities .ability-tree li[data-active="true"]', { hasText: 'atacan solos' })).toBeVisible();
  await page.keyboard.press('e');
  await expect(command).toHaveText('Mando');
  await page.screenshot({ path: info.outputPath('habilidades-nigromante.png') });
  expect(errors).toEqual([]);
});
test('en táctil los botones de habilidades no tapan la palanca', async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await practice(page, 'archer', true);
  await expect(page.locator('#abilities')).toBeHidden();
  const panel = (await page.locator('#touch-actions').boundingBox())!,
    stick = (await page.locator('#stick-move').boundingBox())!;
  const overlap = !(
    panel.x + panel.width <= stick.x ||
    stick.x + stick.width <= panel.x ||
    panel.y + panel.height <= stick.y ||
    stick.y + stick.height <= panel.y
  );
  expect(overlap).toBe(false);
  await page.screenshot({ path: info.outputPath('habilidades-movil.png') });
  await context.close();
});

test('el caballero muestra sus técnicas: cadena de cortes, carga por estados, Ráfaga y Despertar', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await practice(page, 'guardian');
  const abilities = page.locator('#abilities');
  const flurry = abilities.locator('[data-ability="flurry"]');
  const fury = abilities.locator('[data-ability="fury"]');
  await expect(abilities.locator('[data-ability="sword"]')).toContainText('Tres Cortes');
  await expect(flurry).toContainText('Ráfaga de Acero');
  await expect(flurry.locator('kbd')).toHaveText('Q');
  await expect(abilities.locator('[data-ability="dash"]')).toContainText('Paso Relámpago');
  await expect(fury).toContainText('Despertar');
  await expect(fury.locator('kbd')).toHaveText('R');
  // No shield and no bash: the right click, E and F are free.
  for (const position of ['secondary', 'e', 'f'])
    await expect(abilities.locator(`[data-position="${position}"] .ability`)).toHaveAttribute('data-locked', 'true');
  await expect(abilities.locator('[data-ability="guard"], [data-ability="shield-bash"]')).toHaveCount(0);
  // The awakening needs no bar: it is ready from the start.
  await expect(fury).toHaveAttribute('data-ready', 'true');

  // A click is a cut, and the chain remembers which one comes next.
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height / 2);
  const tree = abilities.locator('[data-position="primary"] .ability-tree li');
  const chain = tree.first().locator('.tier-state');
  // Its card draws the cut that comes next: across one way, back the other, then down.
  const face = abilities.locator('[data-position="primary"] .ability-face');
  await expect(chain).toHaveText('1/3');
  await expect(face).toHaveAttribute('data-face', '0');
  await page.mouse.down();
  await page.mouse.up();
  await expect(chain).toHaveText('2/3');
  await expect(face).toHaveAttribute('data-face', '1');
  // Holding charges through its states; the last one lights up, and the chain waits for it.
  await page.mouse.down();
  await expect(page.locator('#cd-sword')).toContainText('Cargando');
  await expect(tree.filter({ hasText: '100 %' })).toHaveAttribute('data-active', 'true', { timeout: 4000 });
  await page.screenshot({ path: info.outputPath('caballero-carga.png') });
  await page.mouse.up();
  await expect(chain).toHaveText('3/3');
  await expect(face).toHaveAttribute('data-face', '2');
  await expect(page.locator('#cd-sword')).toHaveText('⚔ Lista', { timeout: 3000 });

  // The flurry has a cooldown, and so does the step.
  await page.keyboard.press('KeyQ');
  await expect(flurry).toHaveAttribute('data-ready', 'false');
  await expect(flurry.locator('.ability-state')).toHaveText(/^\d\.\ds$/);
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await expect(abilities.locator('[data-ability="dash"]')).toHaveAttribute('data-ready', 'false');
  // R wakes the violet lightning for its seconds, and then the minute of its cooldown runs.
  await page.keyboard.press('KeyR');
  await expect(page.locator('#stage')).toHaveAttribute('data-fury', 'true');
  await expect(fury).toHaveAttribute('data-ready', 'false');
  await expect(fury.locator('.ability-state')).toHaveText(/^\d\d\.\ds$/);
  await expect(abilities.locator('[data-position="r"] .ability-tree li').first()).toHaveAttribute('data-active', 'true');
  await page.screenshot({ path: info.outputPath('caballero-tecnicas.png') });
  expect(errors).toEqual([]);
});
