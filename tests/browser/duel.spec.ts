import { test, expect, type Page } from '@playwright/test';
async function create(page: Page, name: string, classId='guardian') {
  await page.goto('/');
  await page.locator('#name').fill(name);
  await page.locator(`#entry-classes [data-class="${classId}"]`).click();
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
  return page.url();
}
async function join(page: Page, url: string, name: string, classId='guardian') {
  await page.goto(url);
  await page.locator('#name').fill(name);
  await page.locator(`#entry-classes [data-class="${classId}"]`).click();
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
}
test('dos navegadores: invitación, tres capturas y revancha', async ({ page, browser }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('canvas').waitFor();
  await page.screenshot({ path: info.outputPath('inicio.png'), fullPage: true });
  const url = await create(page, 'Aldric');
  const context = await browser.newContext();
  const rival = await context.newPage();
  rival.on('pageerror', (e) => errors.push(e.message));
  await join(rival, url, 'Rowena');
  await expect(page.locator('#roster')).toContainText('Rowena');
  await page.screenshot({ path: info.outputPath('sala.png'), fullPage: true });
  await page.locator('#ready').click();
  await rival.locator('#ready').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 7000 });
  // The central lane is unobstructed. The opponent remains at its spawn, not the flag.
  for (let capture = 1; capture <= 3; capture++) {
    await page.keyboard.down('KeyD');
    await expect(page.locator('#flag-red')).toHaveText('¡Robada!', { timeout: 9000 });
    await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyA');
    await expect(page.locator('#score-blue')).toHaveText(String(capture), { timeout: 10000 });
    await page.keyboard.up('KeyA');
    if (capture < 3)
      await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', {
        timeout: 5000,
      });
  }
  await expect(page.locator('#overlay-title')).toHaveText('La gloria es tuya.');
  await expect(rival.locator('#score-blue')).toHaveText('3');
  await page.screenshot({ path: info.outputPath('victoria.png'), fullPage: true });
  await page.locator('#room-classes [data-class="vanguard"]').click();
  await page.locator('#ready').click();
  await rival.locator('#ready').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 7000 });
  await expect(page.locator('#score-blue')).toHaveText('0');
  // A reload recovers the same seat and does not create a new player.
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
  await expect(page.locator('#arena-label')).toContainText('AZUR');
  await expect(page.locator('#stage')).toHaveAttribute('data-class','vanguard');
  await expect(page.locator('#health')).toHaveText('♥ 5/5');
  await expect(page.locator('#overlay')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});
test('celular horizontal, multitouch, cancelación y aviso vertical', async ({ browser }, info) => {
  const pc = await browser.newContext();
  const opponent = await pc.newPage();
  const url = await create(opponent, 'Desktop');
  const mobile = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await mobile.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await join(page, url, 'Mobile','archer');
  await opponent.locator('#ready').click();
  await page.locator('#ready').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 7000 });
  await expect(page.locator('#touch-controls')).toBeVisible();
  const move = (await page.locator('#stick-move').boundingBox())!,
    aim = (await page.locator('#stick-aim').boundingBox())!;
  const session = await mobile.newCDPSession(page);
  const touches = [
    { id: 1, x: move.x + move.width / 2, y: move.y + move.height / 2 },
    { id: 2, x: aim.x + aim.width / 2, y: aim.y + aim.height / 2 },
  ];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches });
  touches[0].x -= 25;
  touches[1].x -= 30;
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches });
  await expect(page.locator('#stick-move')).toHaveAttribute('style', /--dx: -/);
  await expect(page.locator('#stick-aim')).toHaveAttribute('style', /--dx: -/);
  await page.screenshot({ path: info.outputPath('mobile.png') });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#cd-shot')).toHaveText(/➶ 0\.\ds/);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touches[0]] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#stick-move')).toHaveAttribute('style', /--dx: 0px/);
  await page.waitForTimeout(250);
  await page.locator('#touch-sword').tap();
  await expect(page.locator('#cd-sword')).toHaveText(/⚔ 0\.\ds/);
  await page.waitForTimeout(250);
  await page.locator('#touch-dash').tap();
  await expect(page.locator('#cd-dash')).toHaveText(/➟ [01]\.\ds/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#rotate')).toBeVisible();
  expect(errors).toEqual([]);
  await mobile.close();
  await pc.close();
});
test('muestra errores de sala y permite empezar otra', async ({ page }) => {
  await page.goto('/?sala=inexistente');
  await page.locator('#name').fill('Visitante');
  await page.locator('#enter').click();
  await expect(page.locator('#status')).toContainText('no existe');
  await page.locator('#new-instead').click();
  await expect(page.locator('#enter')).toContainText('Crear un duelo');
});
