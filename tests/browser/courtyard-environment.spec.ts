import { test, expect, type Page } from '@playwright/test';
import { MAPS } from '@bandera/shared';

async function courtyard(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#map-select').selectOption('courtyard');
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
}

test('courtyard atlas supplies seven lit surfaces around unchanged shared wall footprints', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/texture.*(?:missing|not found)|failed to load/i.test(message.text())) errors.push(message.text());
  });
  await courtyard(page);
  const result = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const environment = arena.courtyardEnvironment;
    return {
      art: arena.textures.exists('courtyard-art-atlas'),
      frames: arena.textures.get('courtyard-art-atlas').getFrameNames().length,
      receivers: environment.surfaces.length,
      attached: environment.surfaces.every((surface: any) => arena.lighting.surfaces.has(surface)),
      walls: environment.architecture.map(({ wall }: any) => ({ ...wall })),
      architecture: environment.architecture.map(({ surface, wall }: any) => ({
        x: surface.x, width: surface.width, bottom: surface.y + surface.height,
        wallX: wall.x, wallWidth: wall.w, wallBottom: wall.y + wall.h,
      })),
      temporary: arena.textures.getTextureKeys().filter((key: string) => key.startsWith('courtyard-composite-')),
    };
  });
  expect(result.art).toBe(true);
  expect(result.frames).toBeGreaterThanOrEqual(16);
  expect(result.receivers).toBe(7);
  expect(result.attached).toBe(true);
  expect(result.walls).toEqual(MAPS.courtyard.walls);
  expect(result.temporary).toEqual([]);
  for (const wall of result.architecture) {
    expect(wall.x).toBe(wall.wallX);
    expect(wall.width).toBe(wall.wallWidth);
    expect(wall.bottom).toBe(wall.wallBottom);
  }
  await page.locator('#game canvas').screenshot({ path: info.outputPath('authored-courtyard.png') });
  expect(errors).toEqual([]);
});

test('courtyard architecture fades behind visible actors and restores in front', async ({ page }) => {
  await courtyard(page);
  const walls = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const environment = arena.courtyardEnvironment;
    return environment.architecture.map(({ surface, wall }: any) => {
      const behind = { x: wall.x + wall.w / 2, y: wall.y - 6 };
      const front = { x: behind.x, y: wall.y + wall.h + 10 };
      environment.update(1000, 90, [behind]);
      const faded = surface.alpha;
      environment.update(1090, 90, [front]);
      return { faded, restored: surface.alpha, depth: surface.depth,
        behindDepth: arena.bodyDepth(behind.y), frontDepth: arena.bodyDepth(front.y) };
    });
  });
  expect(walls).toHaveLength(MAPS.courtyard.walls.length);
  for (const wall of walls) {
    expect(wall.faded).toBeGreaterThan(.2);
    expect(wall.faded).toBeLessThan(.8);
    expect(wall.restored).toBeCloseTo(1);
    expect(wall.depth).toBeGreaterThan(wall.behindDepth);
    expect(wall.depth).toBeLessThan(wall.frontDepth);
  }
});

test('courtyard wind moves authored crowns without moving their roots', async ({ page }) => {
  await courtyard(page);
  const result = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const wind = arena.wind;
    wind.setActors([]);
    wind.update(1000, 100);
    const roots = wind.nodes.map((n: any) => [n.x, n.y]);
    const before = [...wind.graphic.commandBuffer];
    wind.update(4000, 100);
    return { authored: arena.courtyardEnvironment.windPoints.length,
      roots, afterRoots: wind.nodes.map((n: any) => [n.x, n.y]), before, after: [...wind.graphic.commandBuffer] };
  });
  expect(result.authored).toBeGreaterThan(0);
  expect(result.roots.length).toBeGreaterThan(0);
  expect(result.afterRoots).toEqual(result.roots);
  expect(result.after).not.toEqual(result.before);
});

test('courtyard and forest/world switches release old art and retain bounded resources', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await courtyard(page);
  const result = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const snapshot = arena.snapshot, id = arena.localId;
    const sample = () => {
      arena.torches.update(1000, 0); arena.wind.update(1000, 100); arena.lighting.update(1000, 100);
      return { textures: arena.textures.getTextureKeys().length, objects: arena.children.length,
        shutdown: arena.events.listenerCount('shutdown'), receivers: arena.lighting.surfaces.size,
        lights: arena.lighting.sources.size, windRoots: arena.wind.nodes.length,
        authoredRoots: arena.courtyardEnvironment.windPoints.length };
    };
    arena.drawMap('forest'); arena.drawZone('umbral'); arena.receive(snapshot, id);
    const baseline = sample();
    const cycles = [];
    for (let i = 0; i < 2; i++) {
      const old = [...arena.courtyardEnvironment.surfaces];
      arena.drawMap('forest');
      const released = old.every((surface: any) => !surface.scene && !arena.lighting.surfaces.has(surface));
      arena.drawZone('umbral'); arena.receive(snapshot, id);
      cycles.push({ released, stats: sample() });
    }
    return { baseline, cycles };
  });
  for (const cycle of result.cycles) {
    expect(cycle.released).toBe(true);
    expect(cycle.stats).toEqual(result.baseline);
  }
  expect(errors).toEqual([]);
});
