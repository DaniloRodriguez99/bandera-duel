import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page, url: string, name: string, classId: string) {
  await page.goto(url);
  await page.locator('#name').fill(name);
  await page.locator(`#entry-classes [data-class="${classId}"]`).click();
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
}

/** Where a point of the arena is on this page's screen. */
async function screen(page: Page, x: number, y: number) {
  const box = (await page.locator('#game canvas').boundingBox())!;
  const scale = Math.min(box.width / 960, box.height / 540);
  return {
    x: box.x + (box.width - 960 * scale) / 2 + x * scale,
    y: box.y + (box.height - 540 * scale) / 2 + y * scale,
  };
}

/** The players as this page last heard of them. */
const players = (page: Page) =>
  page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    const snapshot = (arena as unknown as { snapshot: { players: { id: string; classId: string; x: number; y: number; hp: number }[] } }).snapshot;
    return snapshot.players.map(({ id, classId, x, y, hp }) => ({ id, classId, x, y, hp }));
  });

test('en PvP el Parry sostenido devuelve la flecha del arquero y todos lo ven', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enter(page, '/', 'Robin', 'archer');
  const context = await browser.newContext();
  const warrior = await context.newPage();
  warrior.on('pageerror', (error) => errors.push(error.message));
  await enter(warrior, page.url(), 'Arthur', 'vanguard');
  await page.locator('#ready').click();
  await warrior.locator('#ready').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 7000 });
  await expect(warrior.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 7000 });

  // The archer walks into range of the warrior.
  await page.locator('#game canvas').hover();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(300);
  const [archerAt, warriorAt] = await players(page).then((list) => [
    list.find((p) => p.classId === 'archer')!,
    list.find((p) => p.classId === 'vanguard')!,
  ]);
  expect(warriorAt.x - archerAt.x).toBeLessThan(600);

  // The warrior faces the archer and holds the guard up.
  const towardArcher = await screen(warrior, archerAt.x, archerAt.y);
  await warrior.mouse.move(towardArcher.x, towardArcher.y);
  await warrior.keyboard.down('KeyE');
  await expect(warrior.locator('#stage')).toHaveAttribute('data-guard', 'held');

  // The archer shoots straight at him.
  const towardWarrior = await screen(page, warriorAt.x, warriorAt.y);
  await page.mouse.move(towardWarrior.x, towardWarrior.y);
  await page.mouse.down();
  await page.mouse.up();

  // The arrow comes back: the archer is hit by her own shot, the warrior is untouched, and both
  // clients saw the parry happen.
  // Held this long, the guard sends it back far harder than it came.
  await expect.poll(async () => (await players(page)).find((p) => p.classId === 'archer')!.hp, { timeout: 4000 }).toBeLessThan(2);
  await expect(page.locator('#health')).toHaveText(/^♥ \d(,\d)?\/3$/);
  await expect(warrior.locator('#health')).toHaveText('♥ 5/5');
  for (const viewer of [page, warrior])
    await expect
      .poll(() =>
        viewer.evaluate(async () => {
          const { arena } = await import('/src/main.ts');
          return (arena as unknown as { snapshot: { events: { kind: string }[] } }).snapshot.events.some((e) => e.kind === 'counter');
        }),
      )
      .toBe(true);

  // Nobody holds a guard forever: past its cap it lets go by itself, and holding E does not raise
  // it again; it takes a new press.
  await expect(warrior.locator('#stage')).toHaveAttribute('data-guard', 'down', { timeout: 4000 });
  await warrior.waitForTimeout(500);
  await expect(warrior.locator('#stage')).toHaveAttribute('data-guard', 'down');
  await warrior.keyboard.up('KeyE');
  expect(errors).toEqual([]);
  await context.close();
});
