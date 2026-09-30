import { test, expect } from '@playwright/test';
import { CHARACTER_SKINS, CLASS_IDS } from '@bandera/shared';
import { characterSkinArt, palette } from '../../packages/client/src/art';

test('visual settings persist and eight-direction sheets render all appearances', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Pantalla y efectos' }).click();
  await page.locator('#fx-quality').selectOption('low');
  await page.locator('#fx-shake').uncheck();
  await page.locator('.platform-close').click();
  await page.reload();
  await page.getByRole('button', { name: 'Pantalla y efectos' }).click();
  await expect(page.locator('#fx-quality')).toHaveValue('low');
  await expect(page.locator('#fx-shake')).not.toBeChecked();
  await page.locator('.platform-close').click();
  await page.evaluate(async () => {
    // Development modules provide the exact same matrices consumed by the game atlas.
    const { pose } = await import('/src/directional-art.ts');
    const { CLASS_ART, LOOK_ART, palette, characterSkinArt } = await import('/src/art.ts');
    const entries = Object.entries({ ...CLASS_ART, ...LOOK_ART });
    const canvas = document.createElement('canvas'); canvas.id = 'pose-review';
    canvas.width = 8 * 80 + 160; canvas.height = entries.length * 90;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#142127'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const colors = palette('#548cb7', '#f3ce86');
    entries.forEach(([name, rows], row) => {
      ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(name, 5, row * 90 + 40);
      for (let d = 0; d < 8; d++) {
        const pixels = pose(rows, d, 4);
        pixels.forEach((line: string, y: number) => [...line].forEach((c, x) => {
          if (!colors[c]) return; ctx.fillStyle = colors[c]; ctx.fillRect(160+d*80+x*3,row*90+y*3,3,3);
        }));
      }
    });
    document.body.append(canvas);
  });
  await page.locator('#pose-review').screenshot({ path: info.outputPath('directions.png') });
  for (const classId of CLASS_IDS) {
    const variants = CHARACTER_SKINS[classId].map(skin => ({ name: skin.id, rows: characterSkinArt(classId, skin.id), colors: palette(skin.cloth, skin.light) }));
    await page.evaluate(async variants => {
      const { pose } = await import('/src/directional-art.ts');
      const canvas = document.querySelector<HTMLCanvasElement>('#pose-review')!;
      canvas.height = variants.length * 70;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#142127'; ctx.fillRect(0,0,canvas.width,canvas.height);
      variants.forEach((v,row) => {
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(v.name,5,row*70+30);
        for(let d=0;d<8;d++) pose(v.rows,d,4).forEach((line:string,y:number)=>[...line].forEach((c,x)=>{
          if(!v.colors[c])return; ctx.fillStyle=v.colors[c];ctx.fillRect(160+d*80+x*3,row*70+y*3,3,3);
        }));
      });
    }, variants);
    await page.locator('#pose-review').screenshot({path:info.outputPath(`skins-${classId}.png`)});
  }
  expect(errors).toEqual([]);
});

test('native settings validate, save server and handle Android Back', async ({page}) => {
  await page.addInitScript(() => {
    const state = window as any;
    state.androidBridge = {};
    state.nativeEvents = {};
    state.Capacitor = {
      PluginHeaders: [{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'},{name:'minimizeApp',rtype:'promise'}]}],
      nativeCallback: (_plugin:string,method:string,options:any,callback:any) => {
        if(method==='addListener') state.nativeEvents[options.eventName]=callback;
        return 'test-listener';
      },
      nativePromise: () => Promise.resolve(),
    };
  });
  await page.route('https://bandera-test.example/health', route=>route.fulfill({json:{ok:true,game:'bandera-duel'}}));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  if (!await page.locator('.platform-dialog').isVisible()) await page.locator('#server-settings').click();
  await page.locator('#server-url').fill('ftp://bad.example');
  await page.getByRole('button',{name:'Comprobar y guardar'}).click();
  await expect(page.locator('#server-result')).toContainText('HTTP');
  await page.locator('#server-url').fill('https://bandera-test.example/');
  await page.getByRole('button',{name:'Comprobar y guardar'}).click();
  await expect(page.locator('.platform-dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('bandera-mobile-server'))).toBe('wss://bandera-test.example');
  await page.locator('#join-code').click();
  await page.locator('#code').fill('abc');
  await page.locator('#code-form button').click();
  await expect(page.locator('#code-form p')).toContainText('código');
  await page.evaluate(()=>(window as any).nativeEvents.backButton({}));
  await expect(page.locator('.platform-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('landscape touch layout starts practice without script errors', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.locator('#practice-start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-role', 'practice');
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('mobile-practice.png') });
  expect(errors).toEqual([]); await context.close();
});
