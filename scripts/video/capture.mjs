#!/usr/bin/env node
/**
 * Capture screenshots of key pages using Playwright (Chromium).
 * Env:
 *  - SITE_URL: base URL (e.g., https://shun2741.github.io/my-yutai-pwa)
 *  - VIEWPORT: WxH (default 1280x720)
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const SITE_URL = process.env.SITE_URL;
if (!SITE_URL) {
  console.error('ERROR: Set SITE_URL env (e.g., https://<user>.github.io/my-yutai-pwa)');
  process.exit(1);
}
const [w, h] = (process.env.VIEWPORT || '1280x720').split('x').map(Number);
const outDir = 'scripts/video/out';
mkdirSync(outDir, { recursive: true });

const pages = [
  { path: '/', name: 'home' },
  { path: '/map', name: 'map' },
  { path: '/holdings', name: 'holdings' },
  { path: '/settings', name: 'settings' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();

  for (const p of pages) {
    const url = new URL(p.path.replace(/^\//, ''), SITE_URL.replace(/\/$/, '/') + '/').toString();
    console.log('capture', url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Wait for network and UI settle
    try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
    await sleep(1200);
    // Map page may need an extra delay for tiles
    if (p.name === 'map') await sleep(1800);
    await page.screenshot({ path: join(outDir, `${p.name}.png`) });
  }

  await browser.close();
  console.log('Screenshots saved to', outDir);
}

run().catch((e) => { console.error(e); process.exit(1); });

