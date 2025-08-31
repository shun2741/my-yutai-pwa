#!/usr/bin/env node
// 追加店舗CSVを data/stores.csv に追記します（重複チェック付き）
// 使い方: node scripts/append-stores.cjs path/to/stores.csv
// stores.csv ヘッダ: id,chainId,name,address,lat,lng,tags,updatedAt

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const STORES_PATH = path.join(DATA_DIR, 'stores.csv');
const CHAINS_PATH = path.join(DATA_DIR, 'chains.csv');

function toCsvLine(values) {
  return values
    .map((v) => {
      const s = v == null ? '' : String(v);
      if (s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
      if (s.includes(',') || s.includes('\n')) return '"' + s + '"';
      return s;
    })
    .join(',');
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/append-stores.cjs <stores.csv>');
    process.exit(1);
  }
  const inRows = readCsv(inputPath);
  const stores = readCsv(STORES_PATH);
  const chains = readCsv(CHAINS_PATH);
  const chainIds = new Set(chains.map((c) => c.id));
  const existingIds = new Set(stores.map((s) => s.id));

  let added = 0; let skipped = 0;
  const header = 'id,chainId,name,address,lat,lng,tags,updatedAt\n';
  const hasHeader = fs.readFileSync(STORES_PATH, 'utf8').startsWith('id,');
  const fd = fs.openSync(STORES_PATH, 'a');
  if (!hasHeader) fs.writeSync(fd, header);

  for (const r of inRows) {
    if (!r.id || !r.chainId || !r.name) { skipped++; continue; }
    if (!chainIds.has(r.chainId)) { console.warn(`WARN: 未知のchainId ${r.chainId} 行をスキップ: ${r.id}`); skipped++; continue; }
    if (existingIds.has(r.id)) { console.warn(`INFO: 既存ID ${r.id} をスキップ`); skipped++; continue; }
    const lat = r.lat && r.lat !== '' ? Number(r.lat) : '';
    const lng = r.lng && r.lng !== '' ? Number(r.lng) : '';
    const line = toCsvLine([r.id, r.chainId, r.name, r.address || '', lat, lng, r.tags || '', r.updatedAt || new Date().toISOString()]) + '\n';
    fs.writeSync(fd, line);
    existingIds.add(r.id);
    added++;
  }
  fs.closeSync(fd);
  console.log(`stores.csv: 追加 ${added} 件 / スキップ ${skipped} 件`);
}

try { main(); } catch (e) { console.error(e.message || e); process.exit(1);} 

