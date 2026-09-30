import { test, expect } from '@playwright/test';

test('práctica: sin límite de maná la Ráfaga no gasta; con límite gasta y se recarga', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#entry-classes [data-class="guardian"]').click();
  await page.locator('#practice-start').click();
  const tools = page.locator('#dev-tools');
  const mana = page.locator('#dev-mana');
  const limit = page.locator('#dev-mana-limit');
  await expect(tools).toBeVisible();
  await expect(limit).toBeChecked();
  await expect(mana).toHaveText('MANÁ 100/100');
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  // Clicking the controls moves the mouse off the arena: point back at the rival before each use.
  const aim = () => page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height / 2);
  const flurry = page.locator('#abilities [data-ability="flurry"]');

  // No limit: a held flurry and its release leave the pool full.
  await limit.uncheck();
  await aim();
  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(700);
  await expect(mana).toHaveText('MANÁ 100/100');
  await page.keyboard.up('KeyQ');
  await expect(flurry).toHaveAttribute('data-ready', 'false');
  await expect(mana).toHaveText('MANÁ 100/100');

  // With the limit back on, the next one costs, and the refill gives it back at once.
  await limit.check();
  await expect(flurry).toHaveAttribute('data-ready', 'true', { timeout: 7000 });
  await aim();
  await page.keyboard.press('KeyQ');
  await expect(mana).not.toHaveText('MANÁ 100/100');
  await page.locator('#dev-mana-refill').click();
  await expect(mana).toHaveText('MANÁ 100/100');
  expect(errors).toEqual([]);
});
