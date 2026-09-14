import {test,expect} from '@playwright/test';
test('combate pasa al listado en vivo y permite observar',async({page,browser})=>{
  await page.goto('/');await page.locator('#name').fill('Azul');
  await page.locator('#visibility').selectOption('public');
  await page.locator('#room-title').fill('Duelo en vivo');await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();const url=page.url();
  const rc=await browser.newContext(),vc=await browser.newContext();
  try {
    const rival=await rc.newPage();await rival.goto(url);await rival.locator('#name').fill('Rojo');await rival.locator('#enter').click();
    await expect(rival.locator('#overlay')).toBeVisible();
    const viewer=await vc.newPage();await viewer.goto('/');
    await expect(viewer.locator('#rooms-list')).toContainText('Duelo en vivo');
    await page.locator('#ready').click();await rival.locator('#ready').click();
    const card=viewer.locator('#live-rooms-list .room-list-card').filter({hasText:'Duelo en vivo'});
    await expect(card).toBeVisible({timeout:10000});await expect(card).toContainText('Azul vs Rojo');
    await card.getByRole('button',{name:'Ver combate'}).click();
    await viewer.locator('#name').fill('Publico');await viewer.locator('#enter').click();
    await expect(viewer.locator('#stage')).toHaveAttribute('data-role','spectator');
    await expect(viewer.locator('#spectator-count')).toHaveText('Espectadores: 1/5');
  } finally {await rc.close();await vc.close();}
});
