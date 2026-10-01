import { test, expect } from '@playwright/test';

test('legacy visual settings migrate and quality/intensity survive reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('bandera-quality');
    localStorage.setItem('bandera-fx', 'low');
    localStorage.setItem('bandera-intensity', '0.3');
  });
  await page.reload();
  await page.locator('#display-settings').click();
  await expect(page.locator('#fx-quality')).toHaveValue('low');
  await expect(page.locator('#fx-intensity')).toHaveValue('30');
  await page.locator('#fx-quality').selectOption('medium');
  await page.locator('#fx-intensity').focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 6; step++) await page.keyboard.press('ArrowRight');
  await page.reload();
  await page.locator('#display-settings').click();
  await expect(page.locator('#fx-quality')).toHaveValue('medium');
  await expect(page.locator('#fx-intensity')).toHaveValue('60');
  expect(await page.evaluate(async () => {
    const { visualSettings } = await import('/src/visual-effects.ts');
    return { quality: visualSettings.quality, intensity: visualSettings.intensity };
  })).toEqual({ quality: 'medium', intensity: 0.6 });
});

for (const canvas of [false, true]) {
  test(`visual resources stay bounded and render with ${canvas ? 'Canvas fallback' : 'automatic renderer'}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (canvas) await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: any[]) {
        if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
        return original.call(this, kind as any, ...args);
      } as typeof original;
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.locator('#practice-start').click();
    await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
    const results = await page.evaluate(async () => {
      const entry = [...document.scripts].find(script => script.src.includes('/src/main.ts'))!.src;
      const { arena } = await import(entry);
      const { visualSettings } = await import('/src/visual-effects.ts');
      const scene = arena as any;
      const textureKeys = () => scene.textures.getTextureKeys() as string[];
      scene.drawMap('courtyard');
      const baseline = { textures: textureKeys().length, children: scene.children.length, listeners: scene.events.listenerCount('shutdown') };
      const oldKeys = textureKeys().filter(key => key.startsWith('environment-'));
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const map of ['forest', 'ruins', 'crossroads', 'courtyard']) scene.drawMap(map);
      }
      const after = { textures: textureKeys().length, children: scene.children.length, listeners: scene.events.listenerCount('shutdown') };
      const staleKeys = oldKeys.filter(key => scene.textures.exists(key));
      const pool = scene.particles;
      const samples = [];
      for (const [quality, limit] of [['low', 64], ['medium', 128], ['high', 192]] as const) {
        visualSettings.quality = quality;
        visualSettings.intensity = 1;
        pool.clear();
        for (let burst = 0; burst < 40; burst++) {
          pool.burst(480, 270, 0xffaa55, 30);
          scene.lighting.flash(480, 270, 0xffaa55);
        }
        scene.lighting.update(0, 0);
        samples.push({ quality, limit, alive: pool.bursts.getAliveParticleCount(), total: pool.bursts.getParticleCount(), lights: scene.lighting.flashes.filter((light: any) => light.image.visible).length });
      }
      // Apply the populated high budget before changing settings so the next update must
      // discard old particles, rather than merely preventing new emissions.
      pool.update(0);
      visualSettings.quality = 'low';
      pool.update(0);
      const downgraded = pool.bursts.getAliveParticleCount();
      pool.burst(480, 270, 0xffffff, 100);
      visualSettings.intensity = 0;
      pool.burst(480, 270, 0xffffff, 100);
      pool.update(100);
      scene.lighting.update(0, 0);
      const disabled = { particles: pool.bursts.getAliveParticleCount(), lights: [...scene.lighting.pools, ...scene.lighting.flashes].filter((light: any) => light.image.visible).length };
      visualSettings.intensity = 1;
      return { baseline, after, oldCount: oldKeys.length, staleKeys, samples, downgraded, disabled, renderer: scene.game.renderer.type };
    });
    // Static source chunks are released as soon as they are flattened into the map.
    expect(results.oldCount).toBe(0);
    expect(results.staleKeys).toEqual([]);
    expect(results.after).toEqual(results.baseline);
    for (const sample of results.samples) {
      expect(sample.alive).toBeGreaterThan(0);
      expect(sample.alive).toBeLessThanOrEqual(sample.limit);
      expect(sample.total).toBeLessThanOrEqual(193);
      expect(sample.lights).toBeLessThanOrEqual(sample.quality === 'low' ? 2 : sample.quality === 'medium' ? 4 : 6);
    }
    expect(results.disabled).toEqual({ particles: 0, lights: 0 });
    expect(results.downgraded).toBeLessThanOrEqual(64);
    if (canvas) expect(results.renderer).toBe(1);
    await page.locator('#game canvas').screenshot({ path: info.outputPath(canvas ? 'canvas-fallback.png' : 'visual-overhaul.png') });
    expect(errors).toEqual([]);
  });
}

test('actor bodies sort by feet and retain overhead combat information', async ({ page }) => {
  await page.goto('/');
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyS');
  const actors = await page.evaluate(async () => {
    const entry = [...document.scripts].find(script => script.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    return [...(arena as any).visuals.values()].map((v: any) => ({ y: v.y, depth: v.body.depth, hp: v.hp.depth, weapon: v.weapon.depth }));
  });
  expect(actors.length).toBeGreaterThanOrEqual(2);
  actors.sort((a, b) => a.y - b.y);
  expect(actors.at(-1)!.y - actors[0].y).toBeGreaterThan(2);
  expect(actors.at(-1)!.depth).toBeGreaterThan(actors[0].depth);
  for (const actor of actors) {
    expect(actor.hp).toBeGreaterThan(actor.depth);
    expect(Math.abs(actor.weapon - actor.depth)).toBeLessThan(0.001);
  }
});

test('returning from the valley to the same arena releases world decoration', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  const results = await page.evaluate(async () => {
    const entry = [...document.scripts].find(script => script.src.includes('/src/main.ts'))!.src;
    const { arena: scene } = await import(entry);
    const snapshot = scene.snapshot;
    const localId = scene.localId;
    const stats = () => ({
      textures: scene.textures.getTextureKeys().length,
      children: scene.children.length,
      listeners: scene.events.listenerCount('shutdown'),
    });
    // Warm any shared world textures once; each subsequent traversal must return to baseline.
    scene.drawZone('umbral');
    scene.receive(snapshot, localId);
    const baseline = stats();
    const cycles = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      scene.drawZone('umbral');
      const worldKeys = scene.textures.getTextureKeys().filter((key: string) => key.startsWith('environment-'));
      const worldChunks = worldKeys.length;
      scene.receive(snapshot, localId);
      cycles.push({
        resources: stats(), worldChunks,
        remainingWorldKeys: worldKeys.filter((key: string) => scene.textures.exists(key)),
        zone: scene.currentZoneId,
        map: scene.currentMapId,
        settlementReleased: scene.settlement === undefined,
      });
    }
    return { baseline, cycles, map: snapshot.mapId };
  });
  for (const cycle of results.cycles) {
    expect(cycle.worldChunks).toBe(0);
    expect(cycle.remainingWorldKeys).toEqual([]);
    expect(cycle.resources).toEqual(results.baseline);
    expect(cycle.zone).toBe('');
    expect(cycle.map).toBe(results.map);
    expect(cycle.settlementReleased).toBe(true);
  }
  expect(errors).toEqual([]);
});
