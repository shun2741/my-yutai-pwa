import { getCatalogMeta, setCatalog, setCatalogMeta } from "./db";
import { Catalog } from "./types";

type CatalogManifest = { version: string; hash: string; url: string };

function baseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_CATALOG_BASE;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  // デフォルトで公開配下の <basePath>/catalog を見る
  return `${basePath}/catalog`;
}

export async function syncCatalog(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/catalog-manifest.json`, { cache: "no-store" });
    if (!res.ok) return false;
    const manifest = (await res.json()) as CatalogManifest;
    const meta = (await getCatalogMeta()) || {};
    if (meta.hash === manifest.hash) return false; // 変更なし

    const resData = await fetch(`${baseUrl()}/${manifest.url}`, { cache: "no-store" });
    if (!resData.ok) return false;
    const data = (await resData.json()) as Catalog;
    await setCatalog(data);
    await setCatalogMeta({ hash: manifest.hash, fetchedAt: Date.now() });
    return true;
  } catch (e) {
    return false;
  }
}
