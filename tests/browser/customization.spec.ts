import { expect,test } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>localStorage.removeItem('bandera-customization:v1'));await page.reload();});

test('personaliza skins, loadout híbrido y persiste el preset',async({page})=>{
  await page.locator('#entry-classes [data-class-card="mage"] .customize-class').click();
  await expect(page.getByRole('heading',{name:'Forjá tu mago'})).toBeVisible();
  await page.getByRole('button',{name:'SKINS'}).click();
  await expect(page.locator('[data-skin]')).toHaveCount(10);
  await page.getByRole('button',{name:'Sabio Glacial'}).click();
  await expect(page.locator('.custom-preview')).toContainText('Sabio Glacial');
  await page.getByRole('button',{name:'HABILIDADES'}).click();
  await page.getByRole('button',{name:/Alzar a los caídos/}).click();
  // The summon is a powerful ability: it takes the F slot, in place of Singularidad.
  await page.locator('.loadout-slot[data-slot="f"]').click();
  await expect(page.locator('.loadout-slot[data-slot="f"]')).toContainText('Alzar a los caídos');
  // With the summon, Mando and Marcar get keys of their own.
  await expect(page.locator('.context-binding')).toHaveCount(2);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bandera-customization:v1')!));
  expect(saved.version).toBe(2);
  expect(saved.selectedSkin).toBe('mage.glacialSage');expect(saved.presets.default.loadout.f).toBe('necromancer.summon');
});

test('solo permite intercambiar o cancelar un binding ocupado',async({page})=>{
  await page.locator('#entry-classes [data-class-card="mage"] .customize-class').click();
  await page.getByRole('button',{name:'CLIC DER.'}).click();
  await page.keyboard.press('Space');
  await expect(page.locator('.binding-conflict')).toContainText('ESPACIO ya controla Movilidad');
  await expect(page.getByRole('button',{name:'Intercambiar'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cancelar'})).toBeVisible();
  await page.getByRole('button',{name:'Intercambiar'}).click();
  await expect(page.locator('.loadout-slot[data-slot="secondary"] .binding')).toHaveText('ESPACIO');
  await expect(page.locator('.loadout-slot[data-slot="mobility"] .binding')).toHaveText('CLIC DER.');
});

test('la carta usa controles válidos y no anida botones',async({page})=>{
  await expect(page.locator('.class-card button button')).toHaveCount(0);
  await expect(page.locator('#entry-classes .customize-class')).toHaveCount(5);
  await expect(page.locator('#entry-classes [data-class-card="mage"] .class-skill')).toHaveCount(5);
  await page.locator('#entry-classes [data-class-card="mage"] .customize-class').click();
  await page.getByRole('button',{name:'Restablecer todo'}).click();
  await expect(page.locator('.loadout-slot[data-slot="q"]')).toContainText('Saeta glacial');
  await expect(page.locator('.loadout-slot[data-slot="f"]')).toContainText('Singularidad');
});

test('todas las clases abren su personalización y guardan controles y skins',async({page})=>{
  for(const [classId,title] of [['archer','arquero'],['necromancer','nigromante'],['guardian','caballero'],['vanguard','guerrero']] as const){
    await page.locator(`#entry-classes [data-class-card="${classId}"] .customize-class`).click();
    await expect(page.getByRole('heading',{name:`Forjá tu ${title}`})).toBeVisible();
    await page.getByRole('button',{name:'SKINS'}).click();
    await expect(page.locator('[data-skin]')).toHaveCount(5);
    await page.locator('[data-skin]').nth(1).click();
    await page.getByRole('button',{name:'Cerrar'}).click();
  }
  const saved=await page.evaluate(()=>['archer','necromancer','guardian','vanguard'].map(id=>JSON.parse(localStorage.getItem(`bandera-customization:v1:${id}`)!)));
  expect(saved.map(profile=>profile.selectedSkin)).toEqual(['archer.crimsonStalker','necromancer.boneLord','guardian.crimsonGuard','vanguard.crimsonGreatsword']);
});
