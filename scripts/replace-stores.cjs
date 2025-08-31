#!/usr/bin/env node
// 指定チェーンの既存店舗を data/stores.csv から削除し、入力CSVで置き換えます。
// 使い方: node scripts/replace-stores.cjs <chainId> <input.csv>

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const ROOT = process.cwd();
const STORES = path.join(ROOT, 'data', 'stores.csv');

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function toCsv(rows) {
  const headers = ['id','chainId','name','address','lat','lng','tags','updatedAt'];
  const headerLine = headers.join(',') + '\n';
  const lines = rows.map((r) => headers.map((h) => {
    const v = r[h] == null ? '' : String(r[h]);
    if (v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
    if (v.includes(',') || v.includes('\n')) return '"' + v + '"';
    return v;
  }).join(',')).join('\n');
  return headerLine + lines + (lines ? '\n' : '');
}

function main() {
  const chainId = process.argv[2];
  const input = process.argv[3];
  if (!chainId || !input) {
    console.error('Usage: node scripts/replace-stores.cjs <chainId> <input.csv>');
    process.exit(1);
  }
  const base = readCsv(STORES);
  const next = base.filter((r) => r.chainId !== chainId);
  const inRows = readCsv(input);
  const merged = next.concat(inRows);
  fs.writeFileSync(STORES, toCsv(merged));
  console.log(`Replaced chain ${chainId}: removed ${base.length - next.length}, added ${inRows.length}`);
}

try { main(); } catch (e) { console.error(e.message || e); process.exit(1);} 

