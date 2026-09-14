import { test, expect } from '@playwright/test';

test('invitación permite observar un duelo en marcha', async ({ page, browser }) => {
  await page.goto('/');
  await page.locator('#name').fill('Azul');
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
  const url = page.url();
  const rivalContext = await browser.newContext();
  const viewerContext = await browser.newContext({ viewport: {width: 844, height: 390}, isMobile: true, hasTouch: true });
  try {
    const rival = await rivalContext.newPage();
    await rival.goto(url);
    await rival.locator('#name').fill('Rojo');
    await rival.locator('#enter').click();
    await expect(rival.locator('#overlay')).toBeVisible();
    await page.locator('#ready').click();
    await rival.locator('#ready').click();
    await expect(page.locator('#stage')).toHaveAttribute('data-phase','playing');
    const viewer = await viewerContext.newPage();
    await viewer.goto(url);
    await viewer.locator('#name').fill('Publico');
    await viewer.locator('#spectator').check();
    await expect(viewer.locator('#entry-class-picker')).toBeHidden();
    await viewer.locator('#enter').click();
    await expect(viewer.locator('#stage')).toHaveAttribute('data-role','spectator');
    await expect(viewer.locator('#stage')).toHaveAttribute('data-phase','playing');
    await expect(viewer.locator('#touch-controls')).toBeHidden();
    await expect(viewer.locator('#cooldowns')).toBeHidden();
    await viewer.reload();
    await expect(viewer.locator('#stage')).toHaveAttribute('data-role','spectator');
    await rival.locator('#leave').evaluate((el: HTMLButtonElement) => el.click());
    await expect(viewer.locator('#overlay-title')).toHaveText('Ganó Azur.');
    await expect(viewer.locator('#ready')).toBeHidden();
    await expect(viewer.locator('#room-picker')).toBeHidden();
  } finally {
    await viewerContext.close();
    await rivalContext.close();
  }
});
