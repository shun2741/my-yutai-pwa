#!/usr/bin/env node
// 住所のあるCSVに lat/lng を埋めます（未入力のみ）。
// 使い方: node scripts/geocode-nominatim.cjs input.csv output.csv
// 入力ヘッダ: id,chainId,name,address,lat,lng,tags,updatedAt
// 注意: Nominatimの利用規約に従い、1req/sec でスロットリングします。環境変数 NOMINATIM_EMAIL を設定してください。

const fs = require('fs');
const { parse } = require('csv-parse/sync');

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] || { id: '', chainId: '', name: '', address: '', lat: '', lng: '', tags: '', updatedAt: '' });
  const headerLine = headers.join(',') + '\n';
  const lines = rows.map((r) => headers.map((h) => {
    const v = r[h] == null ? '' : String(r[h]);
    if (v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
    if (v.includes(',') || v.includes('\n')) return '"' + v + '"';
    return v;
  }).join(',')).join('\n');
  return headerLine + lines + (lines ? '\n' : '');
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function geocode(addr) {
  const base = process.env.NOMINATIM_BASE || 'https://nominatim.openstreetmap.org';
  const email = process.env.NOMINATIM_EMAIL || '';
  const params = new URLSearchParams({ q: addr, format: 'jsonv2', limit: '1', addressdetails: '0' });
  const url = `${base}/search?${params.toString()}`;
  const headers = { 'User-Agent': `my-yutai-pwa/0.1 ${email ? '('+email+')' : ''}` };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const js = await res.json();
  const hit = js[0];
  if (!hit) return undefined;
  return { lat: Number(hit.lat), lng: Number(hit.lon) };
}

async function main() {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) {
    console.error('Usage: node scripts/geocode-nominatim.cjs <input.csv> <output.csv>');
    process.exit(1);
  }
  const rows = readCsv(input);
  let countNeed = 0, countOk = 0, countSkip = 0;
  for (const r of rows) {
    const has = r.lat && r.lng && String(r.lat).trim() !== '' && String(r.lng).trim() !== '';
    if (has) { countSkip++; continue; }
    if (!r.address) { continue; }
    countNeed++;
    try {
      const p = await geocode(r.address);
      if (p) { r.lat = p.lat; r.lng = p.lng; countOk++; }
    } catch (e) {
      console.error(`Geocode失敗: ${r.id || r.name}: ${e.message}`);
    }
    await sleep(1100); // 1 req/sec より少し余裕
  }
  fs.writeFileSync(output, toCsv(rows));
  console.log(`Geocode: 必要 ${countNeed}, 成功 ${countOk}, 既存 ${countSkip}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });

