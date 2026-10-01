import { test, expect, type Page } from '@playwright/test';

async function practice(page: Page, map = 'courtyard') {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#entry-classes [data-class="mage"]').click();
  await page.locator('#map-select').selectOption(map);
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
}

async function watchProjectiles(page: Page) {
  await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const samples: { id: string; x: number; y: number; authoritative: boolean }[] = [];
    (window as any).__lightSamples = samples;
    arena.events.on('postupdate', () => {
      for (const light of arena.abilityLighting.diagnostics) {
        if (!light.id.startsWith('ability:projectile:') || samples.length >= 500) continue;
        samples.push({ id: light.id, x: light.x, y: light.y,
          authoritative: arena.snapshot.arrows.some((arrow: any) => light.id === 'ability:projectile:' + arrow.id) });
      }
    });
  });
}

async function assertMovingProjectile(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const samples = (window as any).__lightSamples as { id: string; x: number; y: number }[];
    if (!samples.length) return 0;
    const first = samples[0];
    return Math.max(...samples.filter(s => s.id === first.id).map(s => Math.hypot(s.x - first.x, s.y - first.y)));
  })).toBeGreaterThan(15);
  const samples = await page.evaluate(() => (window as any).__lightSamples as { id: string; x: number; y: number; authoritative: boolean }[]);
  const first = samples[0];
  expect(samples.some(sample => sample.authoritative)).toBe(true);
  expect(Math.max(...samples.filter(sample => sample.id === first.id).map(sample => Math.hypot(sample.x - first.x, sample.y - first.y)))).toBeGreaterThan(15);
  await expect.poll(() => page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    return arena.abilityLighting.diagnostics.filter((light: any) => light.id.startsWith('ability:projectile:')).length;
  }), { timeout: 5000 }).toBe(0);
}

test('torch tongues animate and their light changes nearby rendered terrain', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await practice(page);
  const shape = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    arena.torches.update(1000, 0);
    const before = arena.torches.diagnostics.map((s: any) => ({ ...s }));
    arena.torches.update(1310, 0);
    return { before, after: arena.torches.diagnostics.map((s: any) => ({ ...s })),
      shader: !!arena.lighting.pipeline, surfaces: arena.lighting.surfaces.size };
  });
  expect(shape.shader).toBe(true);
  expect(shape.surfaces).toBeGreaterThan(0);
  expect(shape.before.length).toBeGreaterThan(0);
  expect(shape.after.some((s: any, i: number) => s.frame !== shape.before[i].frame)).toBe(true);
  expect(shape.after.some((s: any, i: number) => s.radius !== shape.before[i].radius && s.x !== shape.before[i].x)).toBe(true);
  const pixel = async (intensity: number) => page.evaluate(async intensity => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const { visualSettings } = await import('/src/visual-effects.ts');
    visualSettings.intensity = intensity;
    // Sample actual terrain away from the flame silhouette, near the courtyard's NW torch.
    // Wait for two draws so uniforms and the completed frame reflect the new setting.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const camera = arena.cameras.main;
    const x = Math.round(camera.x + (245 - camera.worldView.x) * camera.zoom);
    const y = Math.round(camera.y + (116 - camera.worldView.y) * camera.zoom);
    return new Promise<{ r: number; g: number; b: number }>(resolve => {
      arena.game.renderer.snapshotPixel(x, y, (color: any) => resolve({ r: color.r, g: color.g, b: color.b }));
    });
  }, intensity);
  const dark = await pixel(0);
  const lit = await pixel(1);
  expect(Math.abs(lit.r - dark.r) + Math.abs(lit.g - dark.g) + Math.abs(lit.b - dark.b)).toBeGreaterThan(4);
  await page.locator('#game canvas').screenshot({ path: info.outputPath('torch-surface-lighting.png') });
  expect(errors).toEqual([]);
});

test('wind changes crowns while roots stay fixed, and reduced motion freezes it', async ({ page }) => {
  await practice(page, 'forest');
  const moving = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const wind = arena.wind;
    wind.update(1000, 100);
    const roots = wind.nodes.map((n: any) => [n.x, n.y]);
    const first = [...wind.graphic.commandBuffer];
    wind.update(4000, 100);
    return { roots, afterRoots: wind.nodes.map((n: any) => [n.x, n.y]), first, second: [...wind.graphic.commandBuffer] };
  });
  expect(moving.roots.length).toBeGreaterThan(0);
  expect(moving.afterRoots).toEqual(moving.roots);
  expect(moving.second).not.toEqual(moving.first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const frozen = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    arena.wind.update(1000, 100);
    const first = [...arena.wind.graphic.commandBuffer];
    arena.wind.update(8000, 100);
    return { first, second: [...arena.wind.graphic.commandBuffer] };
  });
  expect(frozen.second).toEqual(frozen.first);
});

test('a real local mage shot carries a moving light which expires', async ({ page }) => {
  await practice(page);
  await watchProjectiles(page);
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width * .7, canvas.y + canvas.height / 2);
  await assertMovingProjectile(page);
});

test('remote mage projectiles also emit and release light on another client', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#name').fill('Light mage');
  await page.locator('#entry-classes [data-class="mage"]').click();
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
  const context = await browser.newContext();
  try {
    const remote = await context.newPage();
    remote.on('pageerror', error => errors.push(error.message));
    await remote.goto(page.url());
    await remote.locator('#name').fill('Observer knight');
    await remote.locator('#enter').click();
    await expect(remote.locator('#overlay')).toBeVisible();
    await page.locator('#ready').click();
    await remote.locator('#ready').click();
    await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 10000 });
    await expect(remote.locator('#stage')).toHaveAttribute('data-phase', 'playing');
    await watchProjectiles(remote);
    const canvas = (await page.locator('#game canvas').boundingBox())!;
    await page.mouse.click(canvas.x + canvas.width * .7, canvas.y + canvas.height / 2);
    await assertMovingProjectile(remote);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('map cycling releases old light sources without allocating new resources', async ({ page }) => {
  await practice(page);
  const counts = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const sample = () => {
      arena.torches.update(1000, 0);
      arena.lighting.update(1000, 100);
      return { children: arena.children.length, textures: arena.textures.getTextureKeys().length,
        shutdown: arena.events.listenerCount('shutdown'), torches: arena.torches.sources.length,
        lights: arena.lighting.sources.size, surfaces: arena.lighting.surfaces.size };
    };
    arena.drawMap('courtyard');
    const before = sample();
    arena.lighting.setLight('qa-expired-map-source', { x: 200, y: 100, color: 0xffffff, radius: 100, intensity: 1 });
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const map of ['forest', 'ruins', 'crossroads', 'courtyard']) arena.drawMap(map);
    }
    return { before, after: sample(), abilities: arena.abilityLighting.diagnostics.length,
      stale: arena.lighting.sources.has('qa-expired-map-source') };
  });
  expect(counts.after).toEqual(counts.before);
  expect(counts.abilities).toBe(0);
  expect(counts.stale).toBe(false);
  expect(counts.after.surfaces).toBeGreaterThan(0);
});

test('short terrain shadows respond to a source moving across an obstacle', async ({ page }) => {
  await practice(page);
  const shadows = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const manager = arena.lighting;
    const wall = manager.environment.walls.find((w: any) => w.w >= 20 && w.h >= 20);
    const x = wall.x + wall.w / 2, y = wall.y + wall.h / 2;
    manager.sources.clear();
    manager.setLight('qa-shadow', { x: x - 80, y, color: 0xffaa55, radius: 200, intensity: 1 });
    manager.update(1000, 100);
    const left = [...manager.shadows.commandBuffer];
    manager.setLight('qa-shadow', { x: x + 80, y, color: 0xffaa55, radius: 200, intensity: 1 });
    manager.update(2000, 100);
    const right = [...manager.shadows.commandBuffer];
    manager.removeLight('qa-shadow');
    return { left, right };
  });
  expect(shadows.left.length).toBeGreaterThan(0);
  expect(shadows.right).not.toEqual(shadows.left);
});

test('Canvas fallback keeps animated fire, moving ability lights and wind usable', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: any[]) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
      return original.call(this, kind as any, ...args);
    } as typeof original;
  });
  await practice(page, 'forest');
  const state = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    arena.torches.update(1000, 100);
    arena.wind.update(1000, 100);
    return { renderer: arena.game.renderer.type, flames: arena.torches.diagnostics.length, wind: arena.wind.nodes.length };
  });
  expect(state.renderer).toBe(1);
  expect(state.flames).toBeGreaterThan(0);
  expect(state.wind).toBeGreaterThan(0);
  await watchProjectiles(page);
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width * .7, canvas.y + canvas.height / 2);
  await assertMovingProjectile(page);
  await page.locator('#game canvas').screenshot({ path: info.outputPath('dynamic-canvas-fallback.png') });
  expect(errors).toEqual([]);
});
