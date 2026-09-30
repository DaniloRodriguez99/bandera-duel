import { test, expect, type Page } from '@playwright/test';

/** The local player's predicted body and its aim, read from the running scene. */
const state = (page: Page) =>
  page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    const body = (arena as any).predicted;
    const controls = arena.controls;
    return {
      x: body.x as number,
      y: body.y as number,
      angle: controls.angle,
      aimX: controls.aimX,
      aimY: controls.aimY,
      pointed: controls.aim.pointed,
    };
  });
/**
 * The angles of the shots loosed so far. Read from the events, which stay in the snapshot, rather
 * than from the arrows themselves: one that meets a wall at once is gone before anyone looks.
 */
const shotAngles = (page: Page) =>
  page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    return ((arena as any).snapshot?.events ?? [])
      .filter((event: any) => event.kind === 'shot' || event.kind === 'wind')
      .map((event: any) => event.angle as number);
  });

test('caminar sin mover el mouse sigue apuntando al cursor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#entry-classes [data-class="archer"]').click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.5);
  await expect.poll(async () => (await state(page)).pointed).toBe(true);
  const before = await state(page);

  await page.keyboard.down('KeyS');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyS');
  const after = await state(page);
  expect(after.y - before.y).toBeGreaterThan(60);
  // The cursor did not move, so the aim point is the same place...
  expect(after.aimX).toBeCloseTo(before.aimX, 0);
  expect(after.aimY).toBeCloseTo(before.aimY, 0);
  // ...and the direction was taken again from where the body stands now.
  expect(after.angle).toBeCloseTo(Math.atan2(after.aimY - after.y, after.aimX - after.x), 2);
  expect(Math.abs(after.angle - before.angle)).toBeGreaterThan(0.1);

  // An arrow loosed now flies at the cursor.
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(async () => (await shotAngles(page)).length).toBeGreaterThan(0);
  expect((await shotAngles(page))[0]).toBeCloseTo(after.angle, 1);
  expect(errors).toEqual([]);
});

test('la palanca derecha apunta sin atacar y conserva la última dirección', async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.locator('#entry-classes [data-class="archer"]').click();
    await page.locator('#practice-start').click();
    await expect(page.locator('#touch-shot')).toBeVisible();
    const zone = (await page.locator('#aim-zone').boundingBox())!;
    const cdp = await context.newCDPSession(page);

    // A free spot of the right side, clear of the ability buttons: the stick appears under the thumb.
    const thumb = { id: 1, x: zone.x + 40, y: zone.y + 60 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb] });
    await expect(page.locator('#stick-aim')).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...thumb, y: thumb.y - 40 }],
    });
    await expect.poll(async () => (await state(page)).angle).toBeCloseTo(-Math.PI / 2, 1);
    await page.screenshot({ path: info.outputPath('palanca-apuntar.png') });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#stick-aim')).toBeHidden();

    // Walk with the left stick: the aim stays where the thumb left it, never the way of the feet.
    const move = (await page.locator('#stick-move').boundingBox())!;
    const walk = { id: 2, x: move.x + move.width / 2, y: move.y + move.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [walk] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...walk, x: walk.x + 30 }],
    });
    const before = await state(page);
    await page.waitForTimeout(500);
    const after = await state(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(after.x - before.x).toBeGreaterThan(30);
    expect(after.angle).toBeCloseTo(-Math.PI / 2, 1);
    expect(after.pointed).toBe(false);
    // Aiming alone never attacks.
    expect(await shotAngles(page)).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
