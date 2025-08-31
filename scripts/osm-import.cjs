#!/usr/bin/env node
/*
 OSM Overpass から name=... のPOIを取得して stores.csv 形式で出力します。
 使い方:
   node scripts/osm-import.cjs "しゃぶ葉" chain-syabuyo out/syabuyo-osm.csv

 注意:
 - 公開APIのため過度な負荷を避けてください（用途が大きい場合はミラーやレート制御を）
 - すべての店舗がOSMに登録されているわけではありません。
*/

const fs = require('fs');
const path = require('path');

const brandName = process.argv[2];
const chainId = process.argv[3];
const outPath = process.argv[4] || path.join(process.cwd(), 'out', 'stores-osm.csv');

if (!brandName || !chainId) {
  console.error('Usage: node scripts/osm-import.cjs <brandName> <chainId> [out.csv]');
  process.exit(1);
}

const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const NOMINATIM = process.env.NOMINATIM_BASE || 'https://nominatim.openstreetmap.org';
const REVERSE = process.env.OSM_IMPORT_REVERSE === '1';

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

async function overpassQuery(q) {
  const body = new URLSearchParams({ data: q });
  const res = await fetch(OVERPASS, { method: 'POST', body });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return res.json();
}

function buildQuery(name) {
  // 日本全域で name=... を探す。way/relation は center を取得
  const escaped = name.replace(/"/g, '\\"');
  return `
    [out:json][timeout:60];
    area["ISO3166-1"="JP"][admin_level=2]->.jp;
    (node["name"="${escaped}"](area.jp);
     way["name"="${escaped}"](area.jp);
     relation["name"="${escaped}"](area.jp);
    );
    out center tags;
  `;
}

async function reverseGeocode(lat, lon) {
  const email = process.env.NOMINATIM_EMAIL || '';
  const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const headers = { 'User-Agent': `my-yutai-pwa/0.1 ${email ? '('+email+')' : ''}` };
  const res = await fetch(url, { headers });
  if (!res.ok) return undefined;
  const js = await res.json();
  return js.display_name || undefined;
}

async function main() {
  const q = buildQuery(brandName);
  const js = await overpassQuery(q);
  const rows = [];
  for (const el of js.elements || []) {
    let lat, lon, name, addr;
    const tags = el.tags || {};
    // 店名: name:ja / name / branch を考慮
    const baseName = tags['name:ja'] || tags.name || brandName;
    const branch = tags.branch || tags['branch:ja'] || '';
    if (branch && !baseName.includes(branch)) {
      name = `${baseName} ${branch}`;
    } else {
      name = baseName;
    }
    // 住所: できる限り addr:* を結合 + postcode
    const addrParts = [
      tags['addr:postcode'],
      tags['addr:state'],
      tags['addr:province'],
      tags['addr:prefecture'],
      tags['addr:county'],
      tags['addr:city'],
      tags['addr:district'],
      tags['addr:subdistrict'],
      tags['addr:suburb'],
      tags['addr:neighbourhood'],
      tags['addr:street'],
      tags['addr:block_number'],
      tags['addr:housenumber'],
      tags['addr:full'],
    ].filter(Boolean);
    addr = addrParts.join(' ');
    if (el.type === 'node') { lat = el.lat; lon = el.lon; }
    else if (el.center) { lat = el.center.lat; lon = el.center.lon; }
    if (lat == null || lon == null) continue;
    // 住所が空なら（オプション）リバースジオコーディングで補完
    if (!addr && REVERSE) {
      try {
        const rev = await reverseGeocode(lat, lon);
        if (rev) addr = rev;
        await new Promise(r => setTimeout(r, 1100)); // 1 req/sec
      } catch (_) {}
    }
    const id = `store-${chainId.replace(/^chain-/, '')}-osm-${el.type}-${el.id}`;
    rows.push({ id, chainId, name, address: addr, lat, lng: lon, tags: '', updatedAt: new Date().toISOString() });
  }

  if (rows.length === 0) {
    console.warn('No results from Overpass.');
  }

  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  const header = 'id,chainId,name,address,lat,lng,tags,updatedAt\n';
  const lines = rows.map((r) => toCsvLine([r.id, r.chainId, r.name, r.address, r.lat, r.lng, r.tags, r.updatedAt])).join('\n');
  fs.writeFileSync(outPath, header + lines + (lines ? '\n' : ''));
  console.log(`Wrote ${rows.length} rows -> ${outPath}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
