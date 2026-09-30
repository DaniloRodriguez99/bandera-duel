import { test, expect } from '@playwright/test';

test('la simulación local avanza en tiempo real desde el primer segundo', async ({ page }) => {
  await page.goto('/');
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  const sample = () =>
    page.evaluate(async () => {
      const { arena } = await import('/src/main.ts');
      return { tick: (arena as any).snapshot.tick as number, now: performance.now() };
    });
  const from = await sample();
  await page.waitForTimeout(2000);
  const to = await sample();
  // 30 ticks per second, whatever the frame rate: the engine's start-up cap on its smoothed
  // delta used to leave a slow machine near half speed for its first seconds.
  const rate = (to.tick - from.tick) / ((to.now - from.now) / 1000);
  expect(rate).toBeGreaterThan(28);
  expect(rate).toBeLessThan(32);
});
