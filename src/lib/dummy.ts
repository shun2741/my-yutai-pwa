import { CatalogStore } from "./types";

function randomOffset(meters: number) {
  // 緯度経度のざっくりオフセット（東京付近での近似）
  const r = meters / 111_000; // 1度 ≒ 111km
  const angle = Math.random() * Math.PI * 2;
  const radius = r * Math.random();
  const dy = Math.sin(angle) * radius; // lat方向
  const dx = Math.cos(angle) * radius; // lng方向（緯度により縮むが近似）
  return { dx, dy };
}

export function generateDummyStores(center: { lat: number; lng: number }, count: number): CatalogStore[] {
  const stores: CatalogStore[] = [];
  for (let i = 0; i < count; i++) {
    const { dx, dy } = randomOffset(2000); // 最大2km程度の散布
    stores.push({
      id: `dummy_${Date.now()}_${i}`,
      chainId: "dummy_chain",
      name: `ダミー店舗 ${i + 1}`,
      address: "(ダミー)",
      lat: center.lat + dy,
      lng: center.lng + dx,
      tags: [],
      updatedAt: new Date().toISOString(),
    });
  }
  return stores;
}

