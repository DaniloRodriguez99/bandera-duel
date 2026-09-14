import {test,expect} from '@playwright/test';
test('sala pública protegida y contador visible para jugador y espectador',async({page,browser})=>{
  await page.goto('/');
  await page.locator('#name').fill('Host');
  await page.locator('#room-title').fill('Torneo del castillo');
  await page.locator('#visibility').selectOption('public');
  await page.locator('#room-password').fill('castillo');
  await page.locator('#enter').click();
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#spectator-count')).toHaveText('Espectadores: 0/5');
  const context=await browser.newContext();
  try {
    const viewer=await context.newPage();await viewer.goto('/');
    const card=viewer.locator('.room-list-card').filter({hasText:'Torneo del castillo'});
    await expect(card).toBeVisible();await expect(card).toContainText('Con contraseña');
    await card.getByRole('button',{name:'Observar',exact:true}).click();
    await viewer.locator('#name').fill('Publico');
    await viewer.locator('#room-password').fill('incorrecta');await viewer.locator('#enter').click();
    await expect(viewer.locator('#status')).toContainText('Contraseña incorrecta');
    await viewer.locator('#room-password').fill('castillo');await viewer.locator('#enter').click();
    await expect(viewer.locator('#stage')).toHaveAttribute('data-role','spectator');
    await expect(viewer.locator('#spectator-count')).toHaveText('Espectadores: 1/5');
    await expect(page.locator('#spectator-count')).toHaveText('Espectadores: 1/5');
    await viewer.locator('#leave').click();
    await expect(page.locator('#spectator-count')).toHaveText('Espectadores: 0/5');
  } finally {await context.close();}
});
