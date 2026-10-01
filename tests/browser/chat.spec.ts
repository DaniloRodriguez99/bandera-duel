import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page, url: string, name: string, classId: string) {
  await page.goto(url);
  await page.locator('#name').fill(name);
  await page.locator(`#entry-classes [data-class="${classId}"]`).click();
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
}

/** The ids of the characters that have a chat bubble over them right now, as this page draws them. */
const bubbles = (page: Page) =>
  page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    return [...(arena as unknown as { bubbles: Map<string, unknown> }).bubbles.keys()];
  });

test('Enter abre el chat listo para escribir, Enter lo manda y todos lo ven sobre el personaje', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enter(page, '/', 'Robin', 'archer');
  const context = await browser.newContext();
  const rival = await context.newPage();
  rival.on('pageerror', (error) => errors.push(error.message));
  await enter(rival, page.url(), 'Arthur', 'vanguard');
  await page.locator('#ready').click();
  await rival.locator('#ready').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 7000 });
  const speaker = await page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    return (arena as unknown as { localId: string }).localId;
  });

  // Enter, from the fight: the chat opens with its input ready.
  await page.locator('#game canvas').hover();
  await page.keyboard.press('Enter');
  await expect(page.locator('#chat-panel')).toBeVisible();
  await expect(page.locator('#chat-input')).toBeFocused();
  // Typing goes to the chat, not to the character: W does not walk it.
  const before = await page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    const me = (arena as unknown as { snapshot: { players: { id: string; y: number }[] }; localId: string });
    return me.snapshot.players.find((p) => p.id === me.localId)!.y;
  });
  await page.keyboard.type('wwww a pelear');
  await page.keyboard.press('Enter');
  // Sent: the chat closes and the keys go back to the game.
  await expect(page.locator('#chat-panel')).toBeHidden();
  await expect(page.locator('#chat-input')).not.toBeFocused();
  await expect(page.locator('#chat-input')).toHaveValue('');
  const after = await page.evaluate(async () => {
    const { arena } = await import('/src/main.ts');
    const me = (arena as unknown as { snapshot: { players: { id: string; y: number }[] }; localId: string });
    return me.snapshot.players.find((p) => p.id === me.localId)!.y;
  });
  expect(Math.abs(after - before)).toBeLessThan(2);

  // The rival sees it at once: in the room's log and in a bubble over the speaker.
  await expect(rival.locator('#chat-messages')).toContainText('wwww a pelear');
  await expect.poll(() => bubbles(rival)).toContain(speaker);
  await expect.poll(() => bubbles(page)).toContain(speaker);
  await rival.screenshot({ path: test.info().outputPath('burbuja.png') });

  // Escape closes a quick chat without sending anything.
  await page.keyboard.press('Enter');
  await expect(page.locator('#chat-input')).toBeFocused();
  await page.keyboard.type('nada');
  await page.keyboard.press('Escape');
  await expect(page.locator('#chat-panel')).toBeHidden();
  await expect(rival.locator('#chat-messages')).not.toContainText('nada');
  expect(errors).toEqual([]);
  await context.close();
});
