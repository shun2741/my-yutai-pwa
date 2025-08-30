// IndexedDB ラッパ（外部ライブラリ不使用）
import { Catalog, CatalogMeta, Holding } from "./types";

const DB_NAME = "yutai-db";
const DB_VERSION = 1;
const STORE_HOLDINGS = "holdings";
const STORE_KV = "kv"; // { key: string, value: any }

type IDBDB = IDBDatabase;

function openDB(): Promise<IDBDB> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HOLDINGS)) {
        db.createObjectStore(STORE_HOLDINGS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T = unknown>(db: IDBDB, store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = op(s);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

// Holdings CRUD
export async function listHoldings(): Promise<Holding[]> {
  const db = await openDB();
  const items = await tx<any[]>(db, STORE_HOLDINGS, "readonly", (s) => s.getAll());
  return (items || []) as Holding[];
}

export async function putHolding(h: Holding): Promise<void> {
  const db = await openDB();
  await tx(db, STORE_HOLDINGS, "readwrite", (s) => s.put(h));
}

export async function deleteHolding(id: string): Promise<void> {
  const db = await openDB();
  await tx(db, STORE_HOLDINGS, "readwrite", (s) => s.delete(id));
}

// KV helpers
async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  const row = await tx<{ key: string; value: T } | undefined>(db, STORE_KV, "readonly", (s) => s.get(key));
  return row?.value as T | undefined;
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  await tx(db, STORE_KV, "readwrite", (s) => s.put({ key, value }));
}

async function kvDelete(key: string): Promise<void> {
  const db = await openDB();
  await tx(db, STORE_KV, "readwrite", (s) => s.delete(key));
}

// Catalog
const KEY_CATALOG = "catalog";
const KEY_CATALOG_META = "catalog_meta";

export async function getCatalog(): Promise<Catalog | undefined> {
  return kvGet<Catalog>(KEY_CATALOG);
}

export async function setCatalog(catalog: Catalog): Promise<void> {
  await kvSet<Catalog>(KEY_CATALOG, catalog);
}

export async function getCatalogMeta(): Promise<CatalogMeta | undefined> {
  return kvGet<CatalogMeta>(KEY_CATALOG_META);
}

export async function setCatalogMeta(meta: CatalogMeta): Promise<void> {
  await kvSet<CatalogMeta>(KEY_CATALOG_META, meta);
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE_HOLDINGS, STORE_KV], "readwrite");
    t.objectStore(STORE_HOLDINGS).clear();
    t.objectStore(STORE_KV).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

