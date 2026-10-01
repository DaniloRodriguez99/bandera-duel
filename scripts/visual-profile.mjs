import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.argv[2] || 'after';
const out = `artifacts/visual-overhaul/${label}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.argv[3] || 'http://127.0.0.1:5175');
  await page.locator('#practice-start').click();
  await page.waitForTimeout(1500);
  const results = [];
  for (const quality of ['low', 'medium', 'high']) {
    await page.evaluate(async quality => {
      const { visualSettings } = await import('/src/visual-effects.ts');
      visualSettings.quality = quality;
      if (!('intensity' in visualSettings)) visualSettings.low = quality === 'low';
    }, quality);
    await page.waitForTimeout(400);
    const result = await page.evaluate(async () => {
      const entry = [...document.scripts].find(script => script.src.includes('/src/main.ts')).src;
      const { arena } = await import(entry);
      const samples = [];
      let last = performance.now();
      const listener = () => { const now = performance.now(); samples.push(now - last); last = now; };
      arena.events.on('postupdate', listener);
      await new Promise(resolve => setTimeout(resolve, 3000));
      arena.events.off('postupdate', listener);
      samples.sort((a, b) => a - b);
      const gl = arena.game.renderer.gl;
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return { frames: samples.length, medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)], renderer: gl ? 'WebGL' : 'Canvas', gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable', objects: arena.children.length, textures: arena.textures.getTextureKeys().length };
    });
    results.push({ quality, ...result });
    await page.locator('#game').screenshot({ path: `${out}/${quality}.png` });
  }
  for (const map of ['forest', 'ruins', 'crossroads']) {
    await page.locator('#practice-exit').click();
    await page.locator('#map-select').selectOption(map);
    await page.locator('#practice-start').click();
    await page.waitForTimeout(300);
    await page.locator('#game').screenshot({ path: `${out}/${map}.png` });
  }
  await writeFile(`${out}/profile.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); }
