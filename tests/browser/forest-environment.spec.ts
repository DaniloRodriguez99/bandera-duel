import { test, expect, type Page } from '@playwright/test';

async function forest(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#map-select').selectOption('forest');
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
}

test('authored forest loads receiving surfaces and retains a playable route past the flank wall', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/texture.*(?:missing|not found)|failed to load/i.test(message.text())) errors.push(message.text());
  });
  await forest(page);
  const sample = () => page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const own = arena.snapshot.players.find((p: any) => p.id === arena.localId);
    return { x: own.x, y: own.y,
      textures: ['forest-terrain-atlas', 'forest-props-atlas'].map(key => ({ exists: arena.textures.exists(key),
        width: arena.textures.get(key).source[0].width, frames: arena.textures.get(key).getFrameNames().length })),
      receivers: arena.forestEnvironment.surfaces.length,
      attached: arena.forestEnvironment.surfaces.every((surface: any) => arena.lighting.surfaces.has(surface)),
      temporary: arena.textures.getTextureKeys().filter((key: string) => key.startsWith('forest-composite-')) };
  });
  const before = await sample();
  expect(before.receivers).toBe(5);
  expect(before.attached).toBe(true);
  expect(before.temporary).toEqual([]);
  for (const texture of before.textures) {
    expect(texture.exists).toBe(true);
    expect(texture.width).toBeGreaterThanOrEqual(1024);
    expect(texture.frames).toBeGreaterThanOrEqual(16);
  }
  // Forest's flank walls intentionally block y=270. Follow the existing passage below
  // them before entering the central clearing; do not mistake new art for new collision.
  await page.keyboard.down('KeyS');
  try { await expect.poll(async () => (await sample()).y, { timeout: 3000, intervals: [16] }).toBeGreaterThan(355); }
  finally { await page.keyboard.up('KeyS'); }
  const passage = await sample();
  expect(passage.y).toBeLessThan(400);
  await page.keyboard.down('KeyD');
  try { await expect.poll(async () => (await sample()).x, { timeout: 5000 }).toBeGreaterThan(350); }
  finally { await page.keyboard.up('KeyD'); }
  const after = await sample();
  expect(Math.abs(after.y - passage.y)).toBeLessThan(8);
  await page.locator('#game canvas').screenshot({ path: info.outputPath('authored-forest.png') });
  expect(errors).toEqual([]);
});

test('forest wall foreground fades for an actor behind it and restores after departure', async ({ page }) => {
  await forest(page);
  const state = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const environment = arena.forestEnvironment;
    const records = environment.architecture.map(({ surface, wall }: any) => {
      const behind = { x: wall.x + wall.w / 2, y: wall.y - 6 };
      const ahead = { x: behind.x, y: wall.y + wall.h + 10 };
      environment.update(1000, 90, [behind]);
      const faded = surface.alpha;
      environment.update(1090, 90, [ahead]);
      return { faded, restored: surface.alpha, depth: surface.depth,
        behindDepth: arena.bodyDepth(behind.y), aheadDepth: arena.bodyDepth(ahead.y) };
    });
    return records;
  });
  expect(state.length).toBeGreaterThan(0);
  for (const wall of state) {
    expect(wall.faded).toBeLessThan(.8);
    expect(wall.faded).toBeGreaterThan(.2);
    expect(wall.restored).toBeCloseTo(1);
    expect(wall.depth).toBeGreaterThan(wall.behindDepth);
    expect(wall.depth).toBeLessThan(wall.aheadDepth);
  }
});

test('forest crowns react to visible actors with fixed roots and ignore hidden actors', async ({ page }) => {
  await forest(page);
  const result = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const wind = arena.wind, spec = wind.environment, view = arena.cameras.main.worldView;
    const draw = (actors: any[]) => {
      wind.setEnvironment(spec); wind.setActors(actors);
      for (let i = 0; i < 8; i++) wind.update(3000, 100);
      return { roots: wind.nodes.map((node: any) => [node.x, node.y]), commands: [...wind.graphic.commandBuffer] };
    };
    const idle = draw([]);
    const node = wind.nodes.find((n: any) => n.crown && n.x > view.left + 4 && n.x < view.right - 4 && n.y > view.top + 4 && n.y < view.bottom - 4);
    if (!node) throw new Error('Expected visible forest crown');
    const actor = { x: node.x - 2, y: node.y, visible: true };
    const visible = draw([actor]);
    const hidden = draw([{ ...actor, visible: false }]);
    wind.setActors([]);
    return { idle, visible, hidden };
  });
  expect(result.visible.roots).toEqual(result.idle.roots);
  expect(result.hidden.roots).toEqual(result.idle.roots);
  expect(result.visible.commands).not.toEqual(result.idle.commands);
  expect(result.hidden.commands).toEqual(result.idle.commands);
});

test('forest, courtyard and world transitions release forest surfaces and return to baseline', async ({ page }) => {
  await forest(page);
  const result = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts'))!.src;
    const { arena } = await import(entry);
    const snapshot = arena.snapshot, id = arena.localId;
    const sample = () => ({ textures: arena.textures.getTextureKeys().length, children: arena.children.length,
      listeners: arena.events.listenerCount('shutdown'), receivers: arena.lighting.surfaces.size });
    arena.drawZone('umbral'); arena.receive(snapshot, id);
    const baseline = sample();
    const cycles = [];
    for (let i = 0; i < 2; i++) {
      const surfaces = [...arena.forestEnvironment.surfaces];
      arena.drawMap('courtyard');
      const released = surfaces.every((surface: any) => !surface.scene && !arena.lighting.surfaces.has(surface));
      arena.drawZone('umbral'); arena.receive(snapshot, id);
      cycles.push({ released, counts: sample(), forest: !!arena.forestEnvironment });
    }
    return { baseline, cycles };
  });
  for (const cycle of result.cycles) {
    expect(cycle.released).toBe(true);
    expect(cycle.forest).toBe(true);
    expect(cycle.counts).toEqual(result.baseline);
  }
});
