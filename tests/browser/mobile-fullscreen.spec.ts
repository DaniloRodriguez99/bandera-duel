import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * A phone: touch, the page laid out at device width. The orientation lock is recorded instead of
 * applied, since a desktop browser cannot turn its screen. `refuseFirst` makes the browser turn down
 * the first fullscreen request, as it does when a match starts without a tap behind it.
 */
async function phone(browser: Browser, width: number, height: number, options: { refuseFirst?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
  await context.addInitScript((refuseFirst) => {
    const w = window as unknown as { orientationCalls: string[] };
    w.orientationCalls = [];
    const orientation = screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> };
    orientation.lock = (o: string) => (w.orientationCalls.push(o), Promise.resolve());
    orientation.unlock = () => void w.orientationCalls.push('unlock');
    if (!refuseFirst) return;
    const request = Element.prototype.requestFullscreen;
    let refused = false;
    Element.prototype.requestFullscreen = function (this: Element, ...args: Parameters<Element['requestFullscreen']>) {
      if (!refused) {
        refused = true;
        return Promise.reject(new TypeError('Permissions check failed'));
      }
      return request.apply(this, args);
    };
  }, !!options.refuseFirst);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Practice runs without a server.
  await page.route('**/health', (route) => route.abort());
  await page.route('**/rooms', (route) => route.abort());
  await page.route('**/matchmake/**', (route) => route.abort());
  await page.goto('/');
  return { context, page, errors };
}

const fullscreen = (page: Page) => page.evaluate(() => !!document.fullscreenElement);
const orientationCalls = (page: Page) => page.evaluate(() => (window as unknown as { orientationCalls: string[] }).orientationCalls);

async function practice(page: Page, classId = 'vanguard') {
  await page.locator(`#entry-classes [data-class="${classId}"]`).tap();
  await page.locator('#practice-start').tap();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
}

test('en el celular la partida ocupa toda la pantalla en horizontal y la devuelve al salir', async ({ browser }) => {
  const { context, page, errors } = await phone(browser, 844, 390);
  // The lobby is still a page: nothing goes fullscreen just for being on a phone.
  expect(await fullscreen(page)).toBe(false);
  await practice(page);
  // The tap that enters is enough: fullscreen, without browser bars, locked to landscape.
  await expect.poll(() => fullscreen(page)).toBe(true);
  await expect.poll(() => orientationCalls(page)).toContain('landscape');
  await expect(page.locator('.platform-fullscreen')).toBeHidden();
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  expect([canvas.x, canvas.y, canvas.width, canvas.height]).toEqual([0, 0, 844, 390]);

  // The player swipes fullscreen away: taps in the arena do not drag them back into it...
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => fullscreen(page)).toBe(false);
  await expect(page.locator('.platform-fullscreen')).toBeVisible();
  await page.locator('#game canvas').tap({ position: { x: 420, y: 200 } });
  await page.waitForTimeout(300);
  expect(await fullscreen(page)).toBe(false);
  // ...the button does.
  await page.locator('.platform-fullscreen').tap();
  await expect.poll(() => fullscreen(page)).toBe(true);
  await expect(page.locator('.platform-fullscreen')).toBeHidden();

  // The settings can leave it too, and that choice holds as well.
  await page.locator('.platform-game-settings').tap();
  await page.locator('#game-fullscreen').tap();
  await expect.poll(() => fullscreen(page)).toBe(false);
  await page.locator('#game canvas').tap({ position: { x: 420, y: 200 } });
  await page.waitForTimeout(300);
  expect(await fullscreen(page)).toBe(false);
  await page.locator('.platform-game-settings').tap();
  await expect(page.locator('#game-fullscreen')).toHaveText('Pantalla completa');
  await page.locator('#game-fullscreen').tap();
  await expect.poll(() => fullscreen(page)).toBe(true);

  // Leaving the match gives the screen back: no fullscreen, no lock, the lobby as it was.
  await page.locator('#practice-exit').tap();
  await expect(page.locator('#intro')).toBeVisible();
  await expect.poll(() => fullscreen(page)).toBe(false);
  expect((await orientationCalls(page)).at(-1)).toBe('unlock');
  await expect(page.locator('.platform-fullscreen')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('al entrar a una sala desde el celular también pasa a pantalla completa, y la deja al salir', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#name').fill('Robin');
  await page.locator('#entry-classes [data-class="archer"]').tap();
  // The tap that creates the room is the one that asks: the room answers well within the time the
  // browser lets a page use it.
  await page.locator('#enter').tap();
  await expect(page.locator('#overlay')).toBeVisible();
  await expect.poll(() => fullscreen(page)).toBe(true);
  await expect(page.locator('#ready')).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('sala.png') });
  await page.locator('#leave').tap();
  await expect(page.locator('#intro')).toBeVisible();
  expect(await fullscreen(page)).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});

test('si el navegador no la dio al entrar, el primer toque en la arena pide la pantalla completa', async ({ browser }) => {
  const { context, page, errors } = await phone(browser, 844, 390, { refuseFirst: true });
  await practice(page);
  await page.waitForTimeout(300);
  expect(await fullscreen(page)).toBe(false);
  await expect(page.locator('.platform-fullscreen')).toBeVisible();
  await page.locator('#game canvas').tap({ position: { x: 420, y: 200 } });
  await expect.poll(() => fullscreen(page)).toBe(true);
  await expect.poll(() => orientationCalls(page)).toContain('landscape');
  expect(errors).toEqual([]);
  await context.close();
});

test('en vertical pide girar el celular, y tocar la pantalla lo pone en horizontal', async ({ browser }) => {
  const { context, page, errors } = await phone(browser, 390, 844);
  await practice(page);
  // A browser that can turn the screen does it on the same tap; here the screen does not turn, so
  // the arena still asks for it, and says a tap does it.
  await expect(page.locator('#rotate')).toBeVisible();
  await expect(page.locator('#rotate .rotate-tap')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('vertical.png') });
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => fullscreen(page)).toBe(false);
  const before = (await orientationCalls(page)).filter((call) => call === 'landscape').length;
  await page.locator('#rotate').tap();
  await expect.poll(() => fullscreen(page)).toBe(true);
  await expect.poll(async () => (await orientationCalls(page)).filter((call) => call === 'landscape').length).toBe(before + 1);
  expect(errors).toEqual([]);
  await context.close();
});

test('en la computadora la partida no pide pantalla completa', async ({ page }) => {
  await page.route('**/health', (route) => route.abort());
  await page.route('**/rooms', (route) => route.abort());
  await page.route('**/matchmake/**', (route) => route.abort());
  await page.goto('/');
  await page.locator('#entry-classes [data-class="archer"]').click();
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  await page.locator('#game canvas').click({ position: { x: 300, y: 200 } });
  await page.waitForTimeout(300);
  expect(await fullscreen(page)).toBe(false);
  await expect(page.locator('.platform-fullscreen')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/can-fullscreen/);
});

/** Landscape screens, from a small 16:9 phone to tall tablets; the notched ones with their insets. */
const SCREENS = [
  { name: 'iphone-se', width: 667, height: 375 },
  { name: 'galaxy-s9', width: 740, height: 360 },
  { name: 'fold-21x9', width: 780, height: 360, insets: { top: 0, left: 32, right: 0, bottom: 0 } },
  { name: 'iphone-14', width: 844, height: 390, insets: { top: 0, left: 47, right: 47, bottom: 21 } },
  { name: 'pixel-7', width: 915, height: 412, insets: { top: 0, left: 36, right: 0, bottom: 0 } },
  { name: 'iphone-pro-max', width: 932, height: 430, insets: { top: 0, left: 59, right: 59, bottom: 21 } },
  { name: 'ipad', width: 1024, height: 768, insets: { top: 24, left: 0, right: 0, bottom: 20 } },
  { name: 'ipad-pro', width: 1366, height: 1024 },
];

for (const screen of SCREENS)
  test(`en ${screen.name} (${screen.width}×${screen.height}) la arena entra completa y los controles quedan a mano`, async ({ browser }) => {
    const { context, page, errors } = await phone(browser, screen.width, screen.height);
    const insets = screen.insets ?? { top: 0, left: 0, right: 0, bottom: 0 };
    if (screen.insets) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets } as never);
    }
    await practice(page, 'necromancer');
    await expect.poll(() => fullscreen(page)).toBe(true);
    await page.waitForTimeout(400);
    // The canvas covers the screen and the whole arena is drawn in it, undistorted.
    const canvas = (await page.locator('#game canvas').boundingBox())!;
    expect([canvas.x, canvas.y, canvas.width, canvas.height]).toEqual([0, 0, screen.width, screen.height]);
    const camera = await page.evaluate(async () => {
      const { arena } = await import('/src/main.ts');
      const { zoom, worldView } = (arena as unknown as { cameras: { main: { zoom: number; worldView: { x: number; y: number; right: number; bottom: number } } } }).cameras.main;
      return { zoom, x: worldView.x, y: worldView.y, right: worldView.right, bottom: worldView.bottom };
    });
    expect(camera.zoom).toBeCloseTo(Math.min(screen.width / 960, screen.height / 540), 3);
    expect(camera.x).toBeLessThanOrEqual(0.5);
    expect(camera.y).toBeLessThanOrEqual(0.5);
    expect(camera.right).toBeGreaterThanOrEqual(959.5);
    expect(camera.bottom).toBeGreaterThanOrEqual(539.5);

    // Every control is on screen and clear of the notch and the rounded corners.
    const controls = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '#stick-move, #touch-actions .touch-ability, .platform-game-settings, .platform-fullscreen, .in-room .hud .team, .in-room .clock, #mobile-player-status, #practice-toolbar',
        ),
      ]
        .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
        .map((element) => {
          const { left, top, right, bottom } = element.getBoundingClientRect();
          return { id: element.id || element.className || element.dataset.touchAbility || '', left, top, right, bottom };
        }),
    );
    expect(controls.length).toBeGreaterThan(8);
    for (const control of controls) {
      expect.soft(control.left, `${control.id} left`).toBeGreaterThanOrEqual(insets.left - 0.5);
      expect.soft(control.top, `${control.id} top`).toBeGreaterThanOrEqual(insets.top - 0.5);
      expect.soft(control.right, `${control.id} right`).toBeLessThanOrEqual(screen.width - insets.right + 0.5);
      expect.soft(control.bottom, `${control.id} bottom`).toBeLessThanOrEqual(screen.height - insets.bottom + 0.5);
    }
    // The buttons a thumb presses never cover one another.
    const buttons = controls.filter((c) => c.id === 'stick-move' || /touch-ability/.test(c.id));
    for (const [i, a] of buttons.entries())
      for (const b of buttons.slice(i + 1)) {
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        expect.soft(overlap, `${a.id} / ${b.id}`).toBe(false);
      }
    await page.screenshot({ path: test.info().outputPath(`${screen.name}.png`) });
    expect(errors).toEqual([]);
    await context.close();
  });
