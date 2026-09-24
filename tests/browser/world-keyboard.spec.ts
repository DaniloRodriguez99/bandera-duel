import { test, expect, type Page } from '@playwright/test';

/** A newborn with a bow in the valley, ready to be played without ever touching the mouse. */
async function born(page: Page) {
  await page.goto('/');
  await page.locator('#world-open').click();
  await page.locator('#world-name').fill('Teclas');
  await page.locator('#world-user').fill(`teclado${Date.now().toString(36).slice(-6)}`);
  await page.locator('#world-pass').fill('mundo123');
  await page.locator('#world-new').check();
  await page.locator('#world-enter').click();
  await expect(page.locator('#world-selection')).toBeVisible({ timeout: 15000 });
  await page.locator('#world-create').click();
  await expect(page.locator('#wh-creation')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-affinity=viento]').click();
  await page.locator('[data-affinity=viento]').click();
  await page.locator('[data-affinity=destreza]').click();
  await page.locator('[data-weapon=arco]').click();
  await page.locator('#wh-born').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-x', /\d+/, { timeout: 15000 });
  await expect(page.locator('#skillbar [data-slot=e]')).toHaveAttribute('data-skill', /\w+/);
}

test('el mundo se juega entero con el teclado: WASD mueve, flechas apuntan, Q arma, E X C habilidades', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await born(page);
  const stage = page.locator('#stage');
  const pos = async () => [Number(await stage.getAttribute('data-x')), Number(await stage.getAttribute('data-y'))];

  // The bar names the keys: Q for the weapon, E, X and C for skills.
  await expect(page.locator('#skillbar [data-slot=click] kbd')).toHaveText('Q');
  for (const slot of ['e', 'x', 'c']) await expect(page.locator(`#skillbar [data-slot=${slot}]`)).toBeVisible();
  await expect(page.locator('#skillbar [data-slot=x]')).toHaveAttribute('data-locked', 'true');
  await expect(page.locator('#control-guide')).toContainText('Apuntar');

  // Arrows aim, and never move the character in the world.
  const [x0, y0] = await pos();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => Number(await stage.getAttribute('data-aim'))).toBe(-90);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => Math.abs(Number(await stage.getAttribute('data-aim')))).toBe(180);
  const [x1, y1] = await pos();
  expect(Math.abs(x1 - x0) + Math.abs(y1 - y0)).toBeLessThan(4);

  // WASD walks.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  await expect.poll(async () => (await pos())[0]).toBeGreaterThan(x1 + 60);

  // Q held charges the weapon like the mouse button did; the aim guide shows where it goes.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('KeyQ');
  await expect(stage).toHaveAttribute('data-windup', 'true', { timeout: 3000 });
  await page.waitForTimeout(300);
  await page.locator('#game canvas').screenshot({ path: test.info().outputPath('1-q-cargando.png') });
  await page.keyboard.up('KeyQ');

  // E casts the destiny skill: the System answers with its name or with why not.
  await page.keyboard.press('KeyE');
  await expect(page.locator('#wh-callout:visible, .wh-notice[data-kind=denied]').first()).toBeVisible({ timeout: 5000 });
  // X is still closed at level 1, and says so. (A key pressed while E is still being chanted is
  // ignored, so it waits for the incantation to end first.)
  await page.waitForTimeout(900);
  await page.keyboard.press('KeyX');
  await expect(page.locator('.wh-notice[data-kind=denied]', { hasText: 'nivel 5' }).first()).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});
