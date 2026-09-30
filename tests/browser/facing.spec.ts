import { test, expect } from '@playwright/test';

test('corriendo hacia un lado y atacando hacia el otro, el cuerpo mira al ataque y después vuelve', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#entry-classes [data-class="archer"]').click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  const facing = () =>
    page.evaluate(async () => {
      const { arena } = await import('/src/main.ts');
      const { PRACTICE_PLAYER } = await import('/src/practice.ts');
      return (arena as unknown as { visuals: Map<string, { locomotion: { facing: number } }> }).visuals.get(PRACTICE_PLAYER)!.locomotion.facing;
    });
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  // Aim behind: the cursor far to the left of the archer, who walks right.
  await page.mouse.move(canvas.x + 4, canvas.y + canvas.height / 2);
  await expect
    .poll(() => page.evaluate(async () => (await import('/src/main.ts')).arena.controls.aim.pointed))
    .toBe(true);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  // Walking east with no fight: it faces the way it walks.
  expect(await facing()).toBe(0);
  await page.mouse.down();
  await page.waitForTimeout(300);
  // Drawing the bow at the cursor behind it: it faces west while it keeps walking east.
  expect(await facing()).toBe(4);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  // A moment after the shot it faces the way it walks again.
  expect(await facing()).toBe(0);
  await page.keyboard.up('KeyD');
  expect(errors).toEqual([]);
});
