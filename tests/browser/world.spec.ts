import { test, expect } from '@playwright/test';

test('entra al mundo: crea cuenta y personaje, y aparece en el valle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  await page.locator('#game-mode').selectOption('world');
  // Choosing the world must not hide the mode selector, and the button must stop saying "duel".
  await expect(page.locator('#game-mode')).toBeVisible();
  await expect(page.locator('#enter')).toHaveText(/mundo/i);
  await expect(page.locator('#world-account')).toBeVisible();

  await page.locator('#name').fill('Noor');
  await page.locator('#world-user').fill(`visual${Date.now().toString(36).slice(-6)}`);
  await page.locator('#world-pass').fill('mundo123');
  await page.locator('#world-new').check();
  await page.locator('#enter').click();

  // No character named yet: the server answers with the (empty) list and the create button.
  await expect(page.locator('#world-create')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: test.info().outputPath('1-lista-personajes.png') });

  await page.locator('#world-create').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-mode', 'world', { timeout: 15000 });
  await expect(page.locator('#stage')).toHaveAttribute('data-zone', 'umbral');
  await expect(page.locator('#stage')).toHaveAttribute('data-level', '1');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: test.info().outputPath('2-valle.png') });

  // The client must recognise its own character (by character id, not session id), or it never
  // sends input and thinks it is a spectator. The connection must also survive its own pings.
  await expect(page.locator('#stage')).toHaveAttribute('data-x', /\d+/, { timeout: 15000 });
  const startX = Number(await page.locator('#stage').getAttribute('data-x'));

  // Walk east for a while: in an arena the border would stop the character at x=940.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(4500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(600);
  await page.screenshot({ path: test.info().outputPath('3-camino-al-este.png') });

  const endX = Number(await page.locator('#stage').getAttribute('data-x'));
  expect(endX).toBeGreaterThan(startX + 300);
  expect(endX).toBeGreaterThan(960);
  await expect(page.locator('#overlay')).toBeHidden();
  expect(errors).toEqual([]);
});
