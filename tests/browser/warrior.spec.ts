import { test, expect, type Page } from '@playwright/test';

async function practice(page: Page) {
  await page.goto('/');
  await page.locator('#entry-classes [data-class="vanguard"]').click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
}

test('el guerrero carga la Creciente más allá del 100 % y la ola alcanza al rival', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await practice(page);
  const abilities = page.locator('#abilities');
  await expect(abilities.locator('[data-ability="sword"]')).toContainText('Mandoble Colosal');
  await expect(abilities.locator('[data-ability="slash"]')).toContainText('Creciente Escarlata');
  await expect(abilities.locator('[data-ability="counter"]')).toContainText('Revancha de Hierro');
  await expect(abilities.locator('[data-ability="dash"]')).toContainText('Avance Imparable');
  await expect(abilities.locator('[data-ability="reinforce"]')).toContainText('Cuerpo de Hierro');
  await expect(page.locator('#practice-toolbar')).toHaveAttribute('data-dummy-hp', '3');
  // Walk in a little, aim at the rival, and hold Q well past a full charge.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.move(canvas.x + (760 / 960) * canvas.width, canvas.y + (270 / 540) * canvas.height);
  await page.keyboard.down('KeyQ');
  const slash = abilities.locator('[data-ability="slash"] .ability-state');
  await expect(slash).toHaveText(/^1\d\d %$/, { timeout: 6000 });
  await expect(abilities.locator('.ability-tree li[data-active="true"]', { hasText: 'sobrecarga' })).toBeVisible();
  await page.keyboard.up('KeyQ');
  await expect(page.locator('#practice-toolbar')).not.toHaveAttribute('data-dummy-hp', '3', { timeout: 3000 });
  await expect(abilities.locator('[data-ability="slash"]')).toHaveAttribute('data-ready', 'false');
  // The parry goes up at once and says so.
  await page.keyboard.press('KeyE');
  await expect(abilities.locator('[data-ability="counter"]')).toHaveAttribute('data-ready', 'false');
  expect(errors).toEqual([]);
});

test('en táctil el guerrero tiene sus botones: tajo, parry, embestida y cuerpo de hierro', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await practice(page);
  for (const id of ['sword', 'slash', 'counter', 'dash', 'reinforce'])
    await expect(page.locator(`#touch-${id}`)).toBeVisible();
  await expect(page.locator('#touch-counter')).toHaveAttribute('data-mode', 'press');
  await expect(page.locator('#touch-slash')).toHaveAttribute('data-mode', 'charge');
  await page.locator('#touch-reinforce').tap();
  await expect(page.locator('#stage')).toHaveAttribute('data-iron', 'true');
  await expect(page.locator('#mobile-state')).toHaveText(/^HIERRO/);
  expect(errors).toEqual([]);
  await context.close();
});
