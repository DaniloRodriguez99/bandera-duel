import { expect,test } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>localStorage.removeItem('bandera-customization:v1'));await page.reload();});

test('personaliza skins, loadout híbrido y persiste el preset',async({page})=>{
  await page.getByRole('button',{name:'PERSONALIZAR'}).first().click();
  await expect(page.getByRole('heading',{name:'Forjá tu arcanista'})).toBeVisible();
  await page.getByRole('button',{name:'SKINS'}).click();
  await expect(page.locator('[data-skin]')).toHaveCount(10);
  await page.getByRole('button',{name:'Sabio Glacial'}).click();
  await expect(page.locator('.custom-preview')).toContainText('Sabio Glacial');
  await page.getByRole('button',{name:'HABILIDADES'}).click();
  await page.getByRole('button',{name:/Alzar a los caídos/}).click();
  await page.locator('[data-slot="secondary"]').click();
  await expect(page.locator('[data-slot="secondary"]')).toContainText('Alzar a los caídos');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bandera-customization:v1')!));
  expect(saved.selectedSkin).toBe('mage.glacialSage');expect(saved.presets.default.loadout.secondary).toBe('necromancer.summon');
});

test('solo permite intercambiar o cancelar un binding ocupado',async({page})=>{
  await page.getByRole('button',{name:'PERSONALIZAR'}).first().click();
  await page.getByRole('button',{name:'CLIC DER.'}).click();
  await page.keyboard.press('Space');
  await expect(page.locator('.binding-conflict')).toContainText('ESPACIO ya controla Movilidad');
  await expect(page.getByRole('button',{name:'Intercambiar'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cancelar'})).toBeVisible();
  await page.getByRole('button',{name:'Intercambiar'}).click();
  await expect(page.locator('[data-slot="secondary"] .binding')).toHaveText('ESPACIO');
  await expect(page.locator('[data-slot="mobility"] .binding')).toHaveText('CLIC DER.');
});

test('la carta usa controles válidos y no anida botones',async({page})=>{
  await expect(page.locator('.class-card button button')).toHaveCount(0);
  await expect(page.locator('#entry-classes [data-class-card="mage"] .class-skill')).toHaveCount(4);
  await page.getByRole('button',{name:'PERSONALIZAR'}).first().click();
  await page.getByRole('button',{name:'Restablecer todo'}).click();
  await expect(page.locator('[data-slot="skill1"]')).toContainText('Saeta glacial');
});
