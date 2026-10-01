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

test('tres jugadores hablan a la vez: cada uno ve las tres burbujas, una por personaje', async ({ browser }) => {
  const errors: string[] = [];
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  for (const p of pages) p.on('pageerror', (error) => errors.push(error.message));
  const [host, ...guests] = pages;
  await host.goto('/');
  await host.locator('#name').fill('Uno');
  await host.locator('#entry-classes [data-class="archer"]').click();
  await host.locator('#game-mode').selectOption('ffa3');
  await host.locator('#enter').click();
  await expect(host.locator('#overlay')).toBeVisible();
  for (const [i, guest] of guests.entries()) await enter(guest, host.url(), ['Dos', 'Tres'][i], ['vanguard', 'guardian'][i]);
  for (const p of pages) await p.locator('#ready').click();
  for (const p of pages) await expect(p.locator('#stage')).toHaveAttribute('data-phase', 'playing', { timeout: 7000 });
  const ids = await Promise.all(
    pages.map((p) =>
      p.evaluate(async () => {
        const { arena } = await import('/src/main.ts');
        return (arena as unknown as { localId: string }).localId;
      }),
    ),
  );
  // All three speak at about the same time.
  await Promise.all(
    pages.map(async (p, i) => {
      await p.locator('#game canvas').hover();
      await p.keyboard.press('Enter');
      await expect(p.locator('#chat-input')).toBeFocused();
      await p.keyboard.type(['cuidado atrás!', 'voy por la bandera', 'cubro el centro'][i]);
      await p.keyboard.press('Enter');
    }),
  );
  // Every player sees all three, at once: in the log and as one bubble over each speaker.
  await Promise.all(
    pages.map(async (p) => {
      for (const text of ['cuidado atrás!', 'voy por la bandera', 'cubro el centro'])
        await expect(p.locator('#chat-messages')).toContainText(text);
      await expect.poll(() => bubbles(p).then((list) => [...list].sort()), { timeout: 2500 }).toEqual([...ids].sort());
    }),
  );
  // Speaking again replaces the bubble: still one per character.
  await pages[0].keyboard.press('Enter');
  await pages[0].keyboard.type('otra vez');
  await pages[0].keyboard.press('Enter');
  await expect(pages[1].locator('#chat-messages')).toContainText('otra vez');
  expect((await bubbles(pages[1])).filter((id) => id === ids[0])).toHaveLength(1);
  expect(errors).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});

