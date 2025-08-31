import { getCatalogMeta, setCatalog, setCatalogMeta } from "./db";
import { Catalog } from "./types";

type CatalogManifest = { version: string; hash: string; url: string };

// 現在のカタログ参照ベースURLを返す（UI表示用にも利用）
export function getCatalogBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_CATALOG_BASE;
  if (fromEnv) {
    // ユーザーが manifest のURLや JSON の直URLを設定しても安全に動くよう正規化
    let v = fromEnv.trim();
    v = v.replace(/\/$/, "");
    // 末尾が *.json ならファイル名を取り除き、ディレクトリをベースとする
    if (/\.json($|\?)/.test(v)) {
      v = v.replace(/\/[^/]+\.json($|\?.*)?$/, "");
    }
    return v;
  }
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  // デフォルトで公開配下の <basePath>/catalog を見る
  return `${basePath}/catalog`;
}

export async function syncCatalog(opts?: { force?: boolean }): Promise<boolean> {
  try {
    const b = getCatalogBase();
    // First try as-is. If not found, try with/without trailing /dist for robustness.
    const tried: string[] = [];
    const candidates = [
      `${b}/catalog-manifest.json`,
      b.endsWith('/dist') ? `${b.replace(/\/dist$/, '')}/catalog-manifest.json` : `${b}/dist/catalog-manifest.json`,
    ];
    let manifest: CatalogManifest | null = null;
    let baseUsed: string | null = null;
    for (const url of candidates) {
      if (tried.includes(url)) continue;
      tried.push(url);
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        manifest = (await res.json()) as CatalogManifest;
        baseUsed = url.replace(/\/catalog-manifest\.json$/, '');
        break;
      }
    }
    if (!manifest || !baseUsed) return false;
    const meta = (await getCatalogMeta()) || {};
    if (!opts?.force && meta.hash === manifest.hash) return false; // 変更なし（強制でなければ）

    const resData = await fetch(`${baseUsed}/${manifest.url}`, { cache: "no-store" });
    if (!resData.ok) return false;
    const data = (await resData.json()) as Catalog;
    await setCatalog(data);
    await setCatalogMeta({ hash: manifest.hash, fetchedAt: Date.now() });
    return true;
  } catch (e) {
    return false;
  }
}
