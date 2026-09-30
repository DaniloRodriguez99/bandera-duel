import { expect, test } from '@playwright/test';

test('the dizziness badge follows a stunned player and clears with the stun', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  await page.waitForFunction(async () => Boolean((await import('/src/main.ts')).arena.controls));
  const state = await page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    const { Practice, PRACTICE_PLAYER } = await import('/src/practice.ts');
    const snapshot = structuredClone(new Practice('guardian').duel.state);
    const player = snapshot.players.find(p => p.id === PRACTICE_PLAYER)!;
    player.stunLeft = 2;
    arena.localStep = undefined;
    arena.receive(snapshot, PRACTICE_PLAYER);
    (arena as any).drawPlayer(player, true, 1000);
    const visual = (arena as any).visuals.get(PRACTICE_PLAYER);
    return { visible: visual.stun.visible, text: visual.stun.text, aboveName: visual.stun.y < visual.name.y };
  });
  expect(state).toEqual({ visible: true, text: '✦ ATURDIDO ✦', aboveName: true });
  await page.locator('#game canvas').screenshot({ path: info.outputPath('stunned-player.png') });
  const cleared = await page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    const { PRACTICE_PLAYER } = await import('/src/practice.ts');
    const player = (arena as any).snapshot.players.find((p: any) => p.id === PRACTICE_PLAYER);
    const visual = (arena as any).visuals.get(PRACTICE_PLAYER);
    const beforeX = visual.stun.x;
    player.x += 40;
    (arena as any).drawPlayer(player, true, 1050);
    const follows = visual.stun.x === beforeX + 40 && visual.stun.y < visual.name.y;
    player.stunLeft = 0;
    (arena as any).drawPlayer(player, true, 1100);
    const recovered = visual.stun.visible;
    player.stunLeft = 2;
    player.hp = 0;
    (arena as any).drawPlayer(player, true, 1200);
    return { follows, recovered, dead: visual.stun.visible };
  });
  expect(cleared).toEqual({ follows: true, recovered: false, dead: false });
});
