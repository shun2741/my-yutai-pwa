#!/usr/bin/env node
/*
 CSV(Companies/Chains/Stores) -> public/catalog/catalog-YYYY-MM-DD.json を生成し、
 manifest の version/hash/url を自動更新します。Ajv で schema 準拠も検証します。
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const Ajv = require('ajv');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, 'public', 'catalog');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'app.schema.json');

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function listFromCSV(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function buildCatalog() {
  const companiesCsv = path.join(DATA_DIR, 'companies.csv');
  const chainsCsv = path.join(DATA_DIR, 'chains.csv');
  const storesCsv = path.join(DATA_DIR, 'stores.csv');

  if (!fs.existsSync(companiesCsv) || !fs.existsSync(chainsCsv) || !fs.existsSync(storesCsv)) {
    throw new Error('data/*.csv が見つかりません。companies.csv, chains.csv, stores.csv を用意してください。');
  }

  const companies = readCsv(companiesCsv).map((r) => ({
    id: r.id,
    name: r.name,
    ticker: r.ticker || undefined,
    chainIds: listFromCSV(r.chainIds),
    voucherTypes: listFromCSV(r.voucherTypes),
    notes: r.notes || undefined,
  }));

  const chains = readCsv(chainsCsv).map((r) => ({
    id: r.id,
    displayName: r.displayName,
    category: r.category,
    companyIds: listFromCSV(r.companyIds),
    voucherTypes: listFromCSV(r.voucherTypes),
    tags: listFromCSV(r.tags),
    url: r.url || undefined,
  }));

  const stores = readCsv(storesCsv).map((r) => ({
    id: r.id,
    chainId: r.chainId,
    name: r.name,
    address: r.address,
    lat: Number(r.lat),
    lng: Number(r.lng),
    tags: listFromCSV(r.tags),
    updatedAt: r.updatedAt,
  }));

  const version = today();
  const catalog = { version, companies, chains, stores };
  return catalog;
}

function validateCatalog(catalog) {
  const schemaAll = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const schema = Object.assign({ $id: 'catalog' }, schemaAll.catalog);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(catalog);
  if (!ok) {
    const msgs = (validate.errors || []).map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('\n');
    throw new Error(`Catalog schema validation failed:\n${msgs}`);
  }
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function main() {
  const catalog = buildCatalog();
  validateCatalog(catalog);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const filename = `catalog-${catalog.version}.json`;
  const outPath = path.join(OUT_DIR, filename);
  const json = JSON.stringify(catalog, null, 2);
  fs.writeFileSync(outPath, json);

  const hash = sha256Hex(Buffer.from(json));

  const manifestPath = path.join(OUT_DIR, 'catalog-manifest.json');
  let manifest = { version: catalog.version, hash, url: filename };
  if (fs.existsSync(manifestPath)) {
    try {
      const curr = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest = Object.assign(curr, { version: catalog.version, hash, url: filename });
    } catch (_) {}
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Generated: ${path.relative(ROOT, outPath)}`);
  console.log(`Updated manifest: ${path.relative(ROOT, manifestPath)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

