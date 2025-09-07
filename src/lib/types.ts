export type VoucherType = "食事" | "買い物" | "レジャー" | "その他";

export type Holding = {
  id: string;
  companyId: string;
  companyName: string;
  voucherType: VoucherType;
  expiry: string; // YYYY-MM-DD
  amount?: number; // 円換算の残額
  count?: number; // 優待券の枚数など
  shares?: number;
  note?: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

export type CatalogCompany = {
  id: string;
  name: string;
  ticker?: string;
  url?: string;
  chainIds: string[];
  voucherTypes: string[];
  notes?: string;
};

export type CatalogChain = {
  id: string;
  companyIds: string[];
  displayName: string;
  category: string;
  tags: string[];
  voucherTypes: string[];
  url?: string;
};

export type CatalogStore = {
  id: string;
  chainId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tags: string[];
  updatedAt: string;
};

export type Catalog = {
  version: string;
  companies: CatalogCompany[];
  chains: CatalogChain[];
  stores: CatalogStore[];
};

export type CatalogMeta = {
  hash?: string;
  fetchedAt?: number;
};

export type BackupJson = {
  schemaVersion: number;
  holdings?: Holding[];
  catalog?: Catalog;
  catalog_meta?: CatalogMeta;
};

export const SCHEMA_VERSION = 1;
