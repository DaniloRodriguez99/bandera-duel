import {test,expect} from '@playwright/test';

test('elige mapa para práctica y muestra sus arbustos',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('#map-select').selectOption('forest');
  await expect(page.locator('#map-preview')).toContainText('Bosque de Emboscadas');
  await page.locator('#practice-start').click();
  await expect(page.locator('#arena-label')).toContainText('BOSQUE DE EMBOSCADAS');
  await expect(page.locator('#stage')).toHaveAttribute('data-role','practice');
  expect(errors).toEqual([]);
});

test('crea 2v2 con mapa fijo y muestra cupo, equipo y metadatos públicos',async({page,browser})=>{
  await page.goto('/');
  await page.locator('#name').fill('Capitán');
  await page.locator('#room-title').fill('Batalla del bosque');
  await page.locator('#visibility').selectOption('public');
  await page.locator('#game-mode').selectOption('teams');
  await page.locator('#map-select').selectOption('forest');
  await page.locator('#enter').click();
  await expect(page.locator('#overlay-kicker')).toContainText('1/4');
  await expect(page.locator('#room-heading')).toContainText('Equipos 2v2 · Bosque de Emboscadas');
  await expect(page.locator('#team-choice')).toBeVisible();
  await expect(page.locator('#ready')).toBeDisabled();
  const other=await browser.newPage();
  try{
    await other.goto('/');
    const card=other.locator('.room-list-card').filter({hasText:'Batalla del bosque'});
    await expect(card).toContainText('Equipos 2v2 · Bosque de Emboscadas · 1/4 jugadores');
  }finally{await other.close();}
});
