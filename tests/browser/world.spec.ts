import { test, expect } from '@playwright/test';

test('permite devolver chispas y cerrar la creación de personaje', async ({ page }) => {
  await page.goto('/');
  await page.locator('#world-open').click();
  await page.locator('#world-name').fill('Sylphie');
  await page.locator('#world-user').fill(`cerrar${Date.now().toString(36).slice(-6)}`);
  await page.locator('#world-pass').fill('mundo123');
  await page.locator('#world-new').check();
  await page.locator('#world-enter').click();

  await expect(page.locator('#wh-creation')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-affinity=fuego]').click();
  await page.locator('[data-remove-affinity=fuego]').click();
  await expect(page.locator('[data-affinity=fuego]')).toHaveAttribute('data-count', '0');
  await page.locator('#wh-creation-close').click();
  await expect(page.locator('#wh-creation')).toBeHidden();
  await expect(page.locator('#intro')).toBeVisible();
});

test('entra al mundo: nace en el vacío blanco, aparece en el valle y el Sistema le responde', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  // The world is not a match format: it has its own gate, not an option in the duel's list.
  await expect(page.locator('#game-mode option[value=world]')).toHaveCount(0);
  await expect(page.locator('#world-form')).toBeHidden();
  await page.locator('#world-gate').screenshot({ path: test.info().outputPath('0-puerta.png') });
  await page.locator('#world-open').click();
  await expect(page.locator('#world-account')).toBeVisible();

  await page.locator('#world-name').fill('Noor');
  await page.locator('#world-user').fill(`visual${Date.now().toString(36).slice(-6)}`);
  await page.locator('#world-pass').fill('mundo123');
  await page.locator('#world-new').check();
  await page.locator('#world-enter').click();

  // A new account has nobody to come back with: it goes straight to the Man-God's white void,
  // never through a duel lobby. Three sparks, a weapon, and fate picks the skill.
  await expect(page.locator('#wh-creation')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#ready')).toBeHidden();
  await expect(page.locator('#wh-born')).toBeDisabled();
  await page.locator('[data-affinity=fuego]').click();
  await page.locator('[data-affinity=fuego]').click();
  await page.locator('[data-affinity=viento]').click();
  await expect(page.locator('#wh-creation-close')).toBeVisible();
  // Every assigned affinity exposes an ordinary left-click control to take sparks back.
  await page.locator('[data-remove-affinity=fuego]').click();
  await expect(page.locator('[data-affinity=fuego]')).toHaveAttribute('data-count', '1');
  await expect(page.locator('#wh-born')).toBeDisabled();
  await page.locator('[data-affinity=fuego]').click();
  // A fourth spark does not exist; right click takes one back.
  await page.locator('[data-affinity=agua]').click();
  await expect(page.locator('[data-affinity=agua]')).toHaveAttribute('data-count', '0');
  await page.locator('[data-weapon=baston]').click();
  await page.screenshot({ path: test.info().outputPath('2-el-vacio-blanco.png') });
  await expect(page.locator('#wh-born')).toBeEnabled();
  await page.locator('#wh-born').click();

  await expect(page.locator('#stage')).toHaveAttribute('data-mode', 'world', { timeout: 15000 });
  await expect(page.locator('#stage')).toHaveAttribute('data-zone', 'umbral');
  await expect(page.locator('#stage')).toHaveAttribute('data-level', '1');
  // Fate turns its card over, and the skill it gave sits in the E slot.
  await expect(page.locator('#wh-destiny')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#skillbar [data-slot=e]')).toHaveAttribute('data-skill', /\w+/);
  await expect(page.locator('#skillbar [data-slot=x]')).toHaveAttribute('data-locked', 'true');
  await page.waitForTimeout(700);
  await page.screenshot({ path: test.info().outputPath('3-destino.png') });

  // None of the match chrome survives in the world: no clock counting from infinity, no scores.
  await expect(page.locator('#world-hud')).toBeVisible();
  await expect(page.locator('#timer')).toHaveText('Valle de Umbral');
  await expect(page.locator('#stage')).toHaveAttribute('data-pvp', 'safe');
  await expect(page.locator('#abilities')).toBeHidden();
  await expect(page.locator('#team-blue')).toBeHidden();
  await expect(page.locator('#arena-hint')).not.toHaveText(/bandera/i);

  // The client must recognise its own character (by character id, not session id), or it never
  // sends input and thinks it is a spectator. The connection must also survive its own pings.
  await expect(page.locator('#stage')).toHaveAttribute('data-x', /\d+/, { timeout: 15000 });
  const startX = Number(await page.locator('#stage').getAttribute('data-x'));

  // Walk east for a while: in an arena the border would stop the character at x=940.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(4500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(600);
  await page.screenshot({ path: test.info().outputPath('4-camino-al-este.png') });

  const endX = Number(await page.locator('#stage').getAttribute('data-x'));
  expect(endX).toBeGreaterThan(startX + 300);
  expect(endX).toBeGreaterThan(960);
  await expect(page.locator('#overlay')).toBeHidden();

  // E casts the destiny skill. Whatever fate gave, the System answers: a shouted name, or its
  // voice explaining why not (a thief's eye with nobody to steal from, say).
  const box = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.45);
  // A short skill (Chispa recharges in about a second) can be ready again before a poll looks, so
  // the page itself records whether the slot ever went into cooldown.
  await page.evaluate(() => {
    const slot = document.querySelector('#skillbar [data-slot=e]')!;
    const w = window as unknown as { __cooled?: boolean };
    w.__cooled = false;
    new MutationObserver(() => {
      if (slot.getAttribute('data-cooling') === 'true') w.__cooled = true;
    }).observe(slot, { attributes: true, attributeFilter: ['data-cooling'] });
  });
  await page.keyboard.press('KeyE');
  await expect(page.locator('#wh-callout:visible, .wh-notice[data-kind=denied]').first()).toBeVisible({ timeout: 5000 });
  if (await page.locator('#wh-callout').isVisible())
    await expect.poll(() => page.evaluate(() => (window as unknown as { __cooled?: boolean }).__cooled)).toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({ path: test.info().outputPath('5-grito.png') });

  // K opens the System: attributes, affinities, and every skill with its own tree.
  await page.keyboard.press('KeyK');
  await expect(page.locator('#wh-panel')).toBeVisible();
  await expect(page.locator('#wh-panel .wh-skill').first()).toBeVisible();
  await expect(page.locator('#wh-panel .wh-affinity', { hasText: 'Fuego' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('6-sistema.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#wh-panel')).toBeHidden();

  // A Warcraft-style minimap sits in the bottom-right corner the whole time.
  await expect(page.locator('#wh-minimap[data-zone=umbral] canvas')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('6b-minimapa.png') });

  // M opens the map: the valley to scale, its border to the forest locked below level 5.
  await page.keyboard.press('KeyM');
  await expect(page.locator('#wh-map canvas[data-zone=umbral]')).toBeVisible();
  await expect(page.locator('#wh-map [data-portal=bosque]')).toHaveClass(/locked/);
  await expect(page.locator('#wh-map [data-stop=umbral]')).toHaveAttribute('data-current', 'true');
  await page.screenshot({ path: test.info().outputPath('7-mapa.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#wh-map')).toBeHidden();
  expect(errors).toEqual([]);
});

test('quien se queda quieto queda afuera con su personaje guardado, y vuelve con un clic', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#world-open').click();
  await page.locator('#world-name').fill('Quieto');
  await page.locator('#world-user').fill(`quieto${Date.now().toString(36).slice(-6)}`);
  await page.locator('#world-pass').fill('mundo123');
  await page.locator('#world-new').check();
  await page.locator('#world-enter').click();
  await expect(page.locator('#wh-creation')).toBeVisible({ timeout: 15000 });
  for (const affinity of ['fuerza', 'fuerza', 'destreza']) await page.locator(`[data-affinity=${affinity}]`).click();
  await page.locator('#wh-born').click();
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#stage')).toHaveAttribute('data-x', /\d+/, { timeout: 15000 });

  // The Playwright server disconnects after 12 s without moving (60 s in production).
  await expect(page.locator('#overlay-title')).toHaveText('Te desconectamos por inactividad', { timeout: 30000 });
  await expect(page.locator('#world-hud')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('inactivo.png') });

  await page.locator('#world-return').click();
  await expect(page.locator('#overlay')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('#world-hud')).toBeVisible();
  await expect(page.locator('#stage')).toHaveAttribute('data-zone', 'umbral');
  // Moving again works: the connection is live, not a leftover screen.
  const x = Number(await page.locator('#stage').getAttribute('data-x'));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  await expect.poll(async () => Number(await page.locator('#stage').getAttribute('data-x'))).toBeGreaterThan(x + 100);
  expect(errors).toEqual([]);
});

test('el Sistema muestra el equipo puesto, la bolsa y lo que da un cofre', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#world-open').click();
  await page.locator('#world-name').fill('Armero');
  await page.locator('#world-user').fill(`armero${Date.now().toString(36).slice(-6)}`);
  await page.locator('#world-pass').fill('mundo123');
  await page.locator('#world-new').check();
  await page.locator('#world-enter').click();
  await expect(page.locator('#wh-creation')).toBeVisible({ timeout: 15000 });
  for (const affinity of ['fuego', 'fuego', 'agua']) await page.locator(`[data-affinity=${affinity}]`).click();
  await page.locator('[data-weapon=baston]').click();
  await page.locator('#wh-born').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-weapon-item', 'baston_aprendiz', { timeout: 15000 });
  await expect(page.locator('#stage')).toHaveAttribute('data-bag', '0');

  await page.keyboard.press('KeyK');
  await page.locator('#wh-tabs [data-tab=items]').click();
  await expect(page.locator('#wh-equipment [data-slot=weapon]')).toHaveAttribute('data-item', 'baston_aprendiz');
  await expect(page.locator('#wh-bag')).toHaveAttribute('data-capacity', '20');
  await expect(page.locator('#wh-bag')).toHaveAttribute('data-count', '0');
  await page.locator('#wh-equipment [data-slot=weapon]').click();
  await expect(page.locator('.wh-item h4')).toHaveText('Bastón de Aprendiz');
  await page.screenshot({ path: test.info().outputPath('equipo.png') });
  await page.keyboard.press('Escape');

  // What a chest window looks like: one card per item, framed by its rarity. (After fate's card from
  // birth has gone, which never coincides with a chest in play.)
  await expect(page.locator('#wh-destiny')).toHaveCount(0, { timeout: 10000 });
  await page.evaluate(() =>
    (window as unknown as { __worldHud: { notice(n: object): void } }).__worldHud.notice({
      id: 'x',
      kind: 'loot',
      title: '¡Cofre legendario abierto!',
      text: 'Conseguiste: Arco del Viento de Vael, Grimorio: Mil Espadas, Talismán de Jade.',
      tier: 'legendario',
      items: [
        { uid: 'i90', itemId: 'arco_vael' },
        { uid: 'i91', itemId: 'grimorio:mil_espadas' },
        { uid: 'i92', itemId: 'talisman_jade' },
      ],
    }),
  );
  await expect(page.locator('#wh-loot .reward-card')).toHaveCount(3);
  await expect(page.locator('#wh-loot [data-item=arco_vael]')).toHaveAttribute('data-rarity', 'legendaria');
  await page.waitForTimeout(600);
  await page.screenshot({ path: test.info().outputPath('botin.png') });
  expect(errors).toEqual([]);
});

test('volver con la cuenta muestra tus personajes y los lugares libres, no una sala de duelo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const account = `vuelvo${Date.now().toString(36).slice(-6)}`;
  const login = async (create: boolean) => {
    await page.goto('/');
    await expect(page.locator('#world-gate h2')).toContainText('Lugunica');
    await page.locator('#world-open').click();
    if (create) await page.locator('#world-gate').screenshot({ path: test.info().outputPath('0-portada.png') });
    await page.locator('#world-name').fill('Subaru');
    await page.locator('#world-user').fill(account);
    await page.locator('#world-pass').fill('mundo123');
    // The checkbox is a checkbox: small, beside its text, not a stretched field.
    const box = await page.locator('#world-new').boundingBox();
    expect(box!.width).toBeLessThan(30);
    if (create) await page.locator('#world-new').check();
    await page.locator('#world-enter').click();
  };
  await login(true);
  await expect(page.locator('#wh-creation')).toBeVisible({ timeout: 15000 });
  for (const affinity of ['agua', 'agua', 'luz']) await page.locator(`[data-affinity=${affinity}]`).click();
  await page.locator('#wh-born').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-x', /\d+/, { timeout: 15000 });

  await login(false);
  await expect(page.locator('#overlay-title')).toHaveText('Tus personajes', { timeout: 15000 });
  await expect(page.locator('.world-character:not(.new)')).toHaveCount(1);
  await expect(page.locator('.world-character:not(.new)')).toContainText('Subaru');
  await expect(page.locator('.world-character.new')).toHaveCount(4);
  for (const duel of ['#ready', '#invitation', '#room-picker']) await expect(page.locator(duel)).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('1-personajes.png') });
  await page.locator('.world-character:not(.new)').click();
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});
