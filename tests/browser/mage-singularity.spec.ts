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

test('el Mago muestra Parpadeo y Singularidad, y el casteo entra en enfriamiento',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('#entry-classes [data-class="mage"]').click();
  await expect(page.locator('#control-guide')).toContainText('Parpadeo');
  await expect(page.locator('#control-guide')).toContainText('Singularidad');
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
  await page.keyboard.press('KeyE');
  await expect(page.locator('#cd-black-hole')).toContainText('Casteando');
  await page.screenshot({path:info.outputPath('singularidad-casteo.png')});
  await expect(page.locator('#cd-black-hole')).toHaveText(/◉ [0-8]\.\ds/,{timeout:4000});
  await page.screenshot({path:info.outputPath('singularidad-activa.png')});
  await expect(singularity).toHaveAttribute('data-ready','false');
  expect(errors).toEqual([]);
});
