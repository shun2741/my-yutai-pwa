#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '/my-yutai-pwa';
const out = 'out';
const pages = ['index.html', 'map/index.html', 'holdings/index.html', 'settings/index.html'];

function fail(msg) { console.error(`check-export: ${msg}`); process.exit(1); }

for (const p of pages) {
  const fp = join(out, p);
  if (!existsSync(fp)) fail(`missing ${fp}. Did build run with output export?`);
  const html = readFileSync(fp, 'utf8');
  if (!html.includes(`${base}/_next/static/`)) {
    fail(`${p} does not reference CSS/JS with basePath '${base}'. Check NEXT_PUBLIC_BASE_PATH and next.config.mjs`);
  }
}

// basic SW query check in generated HTML script chunks
// non-fatal: only warn if not present (runtime-only)
try {
  const swJs = readFileSync('public/sw.js', 'utf8');
  if (!swJs.includes("new URL(self.location).searchParams.get('v')")) {
    console.warn('check-export: sw.js is not versioned by ?v=. Consider updating.');
  }
} catch (_) {}

console.log('check-export: OK');
