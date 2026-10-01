import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const targetMap = process.argv[2] || 'courtyard';
const output = targetMap === 'courtyard' ? 'artifacts/dynamic-lighting' : `artifacts/redesign-${targetMap}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', message => { if (message.type() === 'error' && /shader|WebGL|pipeline/i.test(message.text())) errors.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:5175');
  await page.locator('#entry-classes [data-class="mage"]').click();
  await page.locator('#map-select').selectOption(targetMap);
  await page.locator('#practice-start').click();
  await page.waitForTimeout(700);
  const sample = () => page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts')).src;
    const { arena } = await import(entry);
    return { torches: arena.torches.diagnostics, objects: arena.children.length,
      textures: arena.textures.getTextureKeys().length, projectiles: arena.snapshot.arrows.length };
  });
  const first = await sample();
  await page.locator('#game').screenshot({ path: `${output}/torch-a.png` });
  await page.waitForTimeout(380);
  const second = await sample();
  await page.locator('#game').screenshot({ path: `${output}/torch-b.png` });
  const box = await page.locator('#game canvas').boundingBox();
  await page.mouse.move(box.x + box.width * .75, box.y + box.height * .5);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.locator('#game').screenshot({ path: `${output}/mage-charge.png` });
  await page.mouse.up();
  await page.waitForTimeout(140);
  const ability = await sample();
  await page.locator('#game').screenshot({ path: `${output}/mage-projectile.png` });
  await page.waitForTimeout(1800);
  await page.locator('#practice-exit').click();
  await page.locator('#map-select').selectOption('forest');
  await page.locator('#practice-start').click();
  await page.waitForTimeout(400);
  await page.locator('#game').screenshot({ path: `${output}/wind-a.png` });
  await page.waitForTimeout(700);
  await page.locator('#game').screenshot({ path: `${output}/wind-b.png` });
  const performance = await page.evaluate(async () => {
    const entry = [...document.scripts].find(s => s.src.includes('/src/main.ts')).src;
    const { arena } = await import(entry);
    const settings = (await import('/src/visual-effects.ts')).visualSettings;
    const profiles = [];
    for (const quality of ['low', 'medium', 'high']) {
      settings.quality = quality;
      for (let i = 0; i < 16; i++) arena.lighting.setLight(`stress-${i}`, {
        x: 100 + i % 8 * 100, y: 200 + Math.floor(i / 8) * 160,
        color: i % 2 ? 0xff9944 : 0x77aaff, radius: 100, intensity: .7,
      });
      const frames = []; let last = window.performance.now();
      const listener = () => { const now = window.performance.now(); frames.push(now - last); last = now; };
      arena.events.on('postupdate', listener);
      await new Promise(resolve => setTimeout(resolve, 3000));
      arena.events.off('postupdate', listener); frames.sort((a,b) => a-b);
      profiles.push({ quality, frames: frames.length, median: frames[Math.floor(frames.length * .5)], p95: frames[Math.floor(frames.length * .95)] });
      for (let i = 0; i < 16; i++) arena.lighting.removeLight(`stress-${i}`);
    }
    return profiles;
  });
  const report = { first, second, ability, performance, errors };
  await writeFile(`${output}/validation.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
