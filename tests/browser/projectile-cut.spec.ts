import { test, expect } from '@playwright/test';

test('one projectileCut snapshot event renders exactly two fading fragments', async ({ page }) => {
  await page.goto('/');
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  await page.waitForFunction(async () => {
    const { arena } = await import('/src/main.ts');
    return Boolean((arena as any).snapshot);
  });
  const fragments = await page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    const { Practice } = await import('/src/practice.ts');
    const snapshot = structuredClone(new Practice('guardian').duel.state);
    arena.receive(snapshot, 'practice-player');
    const event = {
      id: 1_000_000_000, kind: 'projectileCut', x: 480, y: 270,
      team: 'blue', classId: 'guardian', angle: 0, power: 6, color: '#bada55',
    };
    const withCut = { ...snapshot, events: [...snapshot.events, event] };
    arena.receive(withCut, 'practice-player');
    const pieces = () => arena.children.list.filter((object: any) =>
      object.type === 'Rectangle' && object.fillColor === 0xbada55 && object.width === 12 && object.height === 3,
    ) as any[];
    const first = pieces().map(piece => piece.rotation).sort((a, b) => a - b);
    arena.receive(withCut, 'practice-player');
    return { first, repeated: pieces().length };
  });
  expect(fragments.first).toHaveLength(2);
  expect(fragments.first[0]).toBeCloseTo(-3 * Math.PI / 4);
  expect(fragments.first[1]).toBeCloseTo(3 * Math.PI / 4);
  expect(fragments.repeated).toBe(2);
  await expect.poll(() => page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    return arena.children.list.filter((object: any) =>
      object.type === 'Rectangle' && object.fillColor === 0xbada55 && object.width === 12 && object.height === 3,
    ).length;
  })).toBe(0);
});
