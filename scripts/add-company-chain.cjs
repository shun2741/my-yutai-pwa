#!/usr/bin/env node
// JSON入力から companies.csv / chains.csv に追記します
// 使い方: node scripts/add-company-chain.cjs path/to/input.json
// input.json 例:
// {
//   "company": {"id":"comp-skylark","name":"すかいらーく","voucherTypes":["食事"],"ticker":"", "notes":""},
//   "chain": {"id":"chain-skylark","displayName":"すかいらーく","category":"飲食","companyIds":["comp-skylark"],"voucherTypes":["食事"],"tags":[],"url":""}
// }

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const COMP_PATH = path.join(DATA_DIR, 'companies.csv');
const CHAIN_PATH = path.join(DATA_DIR, 'chains.csv');

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
    console.error('Usage: node scripts/add-company-chain.cjs <input.json>');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const c = data.company; const ch = data.chain;
  if (!c?.id || !c?.name || !Array.isArray(c?.voucherTypes)) {
    throw new Error('company.id/name/voucherTypes は必須です');
  }
  if (!ch?.id || !ch?.displayName || !ch?.category || !Array.isArray(ch?.voucherTypes)) {
    throw new Error('chain.id/displayName/category/voucherTypes は必須です');
  }
  if (!Array.isArray(ch.companyIds) || ch.companyIds.length === 0) ch.companyIds = [c.id];

  // companies.csv 追記（重複チェック）
  const comps = readCsv(COMP_PATH);
  if (comps.find((x) => x.id === c.id)) {
    console.log(`companies.csv: id=${c.id} は既に存在します。スキップします。`);
  } else {
    const header = 'id,name,ticker,chainIds,voucherTypes,notes\n';
    const line = toCsvLine([
      c.id,
      c.name,
      c.ticker || '',
      (c.chainIds || []).join(','),
      (c.voucherTypes || []).join(','),
      c.notes || ''
    ]) + '\n';
    const hasHeader = fs.readFileSync(COMP_PATH, 'utf8').startsWith('id,');
    fs.appendFileSync(COMP_PATH, hasHeader ? line : header + line);
    console.log(`companies.csv: 追加 -> ${c.id}`);
  }

  // chains.csv 追記（重複チェック）
  const chains = readCsv(CHAIN_PATH);
  if (chains.find((x) => x.id === ch.id)) {
    console.log(`chains.csv: id=${ch.id} は既に存在します。スキップします。`);
  } else {
    const header = 'id,displayName,category,companyIds,voucherTypes,tags,url\n';
    const line = toCsvLine([
      ch.id,
      ch.displayName,
      ch.category,
      (ch.companyIds || [c.id]).join(','),
      (ch.voucherTypes || []).join(','),
      (ch.tags || []).join(','),
      ch.url || ''
    ]) + '\n';
    const hasHeader = fs.readFileSync(CHAIN_PATH, 'utf8').startsWith('id,');
    fs.appendFileSync(CHAIN_PATH, hasHeader ? line : header + line);
    console.log(`chains.csv: 追加 -> ${ch.id}`);
  }
}

try { main(); } catch (e) { console.error(e.message || e); process.exit(1);} 

