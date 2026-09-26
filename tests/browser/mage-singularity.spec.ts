import { test, expect } from '@playwright/test';

test('Parpadeo se activa al soltar su botón táctil', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.locator('#entry-classes [data-class="mage"]').click();
    await page.locator('#practice-start').click();
    const blink = page.locator('#touch-dash');
    await expect(blink).toBeVisible();
    for (const [ability, slot] of [
      ['shot', 'primary'],
      ['magic-shield', 'secondary'],
      ['dash', 'mobility'],
      ['ice', 'skill1'],
      ['black-hole', 'skill2'],
    ]) await expect(page.locator(`#touch-${ability}`)).toHaveAttribute('data-logical-slot', slot);
    await expect(page.locator('#cd-dash')).toContainText('Listo');
    await blink.tap();
    await expect(page.locator('#cd-dash')).toHaveText(/➟ \d\.\ds/);
    await expect(blink).toHaveAttribute('data-ready', 'false');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('el Mago carga Parpadeo y Singularidad manteniendo la tecla y las lanza al soltar',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('#entry-classes [data-class="mage"]').click();
  await expect(page.locator('#control-guide')).toContainText('Parpadeo · mantener y soltar');
  await expect(page.locator('#control-guide')).toContainText('Singularidad · mantener y soltar');
  await page.locator('#practice-start').click();
  const blink=page.locator('[data-ability="dash"]');
  const singularity=page.locator('[data-ability="black-hole"]');
  await expect(blink).toBeVisible();
  await expect(singularity).toBeVisible();
  await expect(singularity).toContainText('Singularidad');
  await expect(singularity).toContainText('E');
  expect(await singularity.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  const canvas=(await page.locator('#game canvas').boundingBox())!;
  await page.mouse.move(canvas.x+canvas.width*0.65,canvas.y+canvas.height*0.5);

  // Parpadeo: holding charges its reach and nothing happens until the key is let go.
  await page.keyboard.down('Space');
  await expect(page.locator('#cd-dash')).toContainText('Cargando');
  await page.waitForTimeout(700);
  await expect(blink).toHaveAttribute('data-ready','true');
  await page.screenshot({path:info.outputPath('parpadeo-carga.png')});
  await page.keyboard.up('Space');
  await expect(page.locator('#cd-dash')).toHaveText(/➟ \d\.\ds/);

  // Singularidad: the charge grows the mandala; the cooldown only starts on release.
  await page.keyboard.down('KeyE');
  await expect(page.locator('#cd-black-hole')).toContainText('Cargando');
  await expect(singularity.locator('.ability-state')).toHaveText(/\d+ %/);
  await page.waitForTimeout(1500);
  await expect(singularity).toHaveAttribute('data-ready','true');
  await page.screenshot({path:info.outputPath('singularidad-carga.png')});
  await page.keyboard.up('KeyE');
  await expect(page.locator('#cd-black-hole')).toHaveText(/◉ \d\.\ds/);
  await page.screenshot({path:info.outputPath('singularidad-viaje.png')});
  await expect(singularity).toHaveAttribute('data-ready','false');
  expect(errors).toEqual([]);
});

test('en móvil Singularidad apunta al punto tocado y el reloj no cubre la arena', async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.locator('#entry-classes [data-class="mage"]').click();
    await page.locator('#practice-start').click();
    const timer = (await page.locator('#timer').boundingBox())!;
    expect(timer.width).toBeLessThan(90);
    expect(timer.height).toBeLessThan(30);
    await expect(page.locator('#hud')).toHaveCSS('background-image', 'none');

    const button = (await page.locator('#touch-black-hole').boundingBox())!;
    const canvas = (await page.locator('#game canvas').boundingBox())!;
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, { steps: 12 });
    await expect(page.locator('#cd-black-hole')).toContainText('Cargando');
    // A full charge reaches the middle of the arena from the spawn.
    await page.waitForTimeout(2100);
    await page.mouse.up();
    await expect(page.locator('#cd-black-hole')).toHaveText(/◉ \d\.\ds/);
    await expect.poll(async () => Number(await page.locator('#stage').getAttribute('data-black-hole-target-x'))).toBeGreaterThan(350);
    const targetX = Number(await page.locator('#stage').getAttribute('data-black-hole-target-x'));
    const targetY = Number(await page.locator('#stage').getAttribute('data-black-hole-target-y'));
    expect(targetX).toBeLessThan(610);
    expect(targetY).toBeGreaterThan(180);
    expect(targetY).toBeLessThan(360);
    await page.screenshot({ path: info.outputPath('singularidad-movil.png') });
  } finally {
    await context.close();
  }
});
