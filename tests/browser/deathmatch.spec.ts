import { test, expect } from '@playwright/test';

test('creación Deathmatch y cambios del anfitrión sincronizados con jugador, espectador y listado', async ({ page, browser }) => {
  await page.goto('/');
  await page.locator('#name').fill('Host');
  await page.locator('#room-title').fill('Arena Deathmatch');
  await page.locator('#visibility').selectOption('public');
  await page.locator('#game-objective').selectOption('deathmatch');
  await expect(page.locator('#create-kill-target')).toBeVisible();
  await page.locator('#kill-target').selectOption('5');
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#room-rules')).toContainText('primero a 5 bajas');
  await expect(page.locator('#timer')).toHaveText('∞');
  await expect(page.locator('#host-settings')).toBeVisible();

  const playerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  try {
    const player = await playerContext.newPage();
    await player.goto('/');
    const playerCard = player.locator('.room-list-card').filter({ hasText: 'Arena Deathmatch' });
    await expect(playerCard).toContainText('primero a 5 bajas');
    await playerCard.getByRole('button', { name: 'Jugar' }).click();
    await player.locator('#name').fill('Rival');
    await player.locator('#enter').click();
    await expect(player.locator('#room-rules')).toContainText('primero a 5 bajas');
    await expect(player.locator('#host-settings')).toBeHidden();

    const viewer = await viewerContext.newPage();
    await viewer.goto('/');
    const viewerCard = viewer.locator('.room-list-card').filter({ hasText: 'Arena Deathmatch' });
    await viewerCard.getByRole('button', { name: 'Observar' }).click();
    await viewer.locator('#name').fill('Vista');
    await viewer.locator('#enter').click();
    await expect(viewer.locator('#room-rules')).toContainText('primero a 5 bajas');
    await expect(viewer.locator('#host-settings')).toBeHidden();

    await page.locator('#ready').click();
    await expect(page.locator('#ready')).toContainText('Listo');
    await page.locator('#host-game-mode').selectOption('ffa3');
    await page.locator('#host-kind').selectOption('time');
    await page.locator('#host-duration').selectOption('600');
    await page.locator('#host-save').click();
    await expect(page.locator('#room-rules')).toContainText('10 minutos');
    await expect(player.locator('#room-rules')).toContainText('10 minutos');
    await expect(viewer.locator('#room-rules')).toContainText('10 minutos');
    await expect(page.locator('#overlay-kicker')).toContainText('2/3');
    await expect(page.locator('#ready')).toHaveText(/Estoy listo/);
    await viewer.locator('#leave').click();
  } finally {
    await playerContext.close();
    await viewerContext.close();
  }
});
