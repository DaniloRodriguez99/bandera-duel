import { test, expect } from '@playwright/test';

test('música tras interacción, volumen persistente y silencio global', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      document.documentElement.dataset.audioNotes = String(Number(document.documentElement.dataset.audioNotes ?? 0) + 1);
      start.call(this, when);
    };
  });
  await page.goto('/');
  const volume = page.getByRole('slider', { name: 'Volumen de música' });
  await expect(volume).toHaveValue('35');
  await page.locator('#name').click();
  await expect.poll(() => page.locator('html').getAttribute('data-audio-notes')).not.toBeNull();
  await volume.fill('20');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bandera-music-volume'))).toBe('0.2');
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(volume).toHaveValue('20');
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#mute').click();
  await volume.fill('0');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bandera-music-volume'))).toBe('0');
  expect(errors).toEqual([]);
});
