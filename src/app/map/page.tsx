"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCatalog } from "../../lib/db";
import { Catalog, CatalogChain, CatalogCompany, CatalogStore } from "../../lib/types";
import Card, { CardBody } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input, Label, Select } from "../../components/ui/Input";
import { generateDummyStores } from "../../lib/dummy";
import Toast from "../../components/ui/Toast";
import { syncCatalog } from "../../lib/catalogSync";

declare const L: any; // Leaflet (CDN)

const TOKYO = { lng: 139.767125, lat: 35.681236, zoom: 12 };

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<Catalog | undefined>();
  const [ready, setReady] = useState(false);
  const [dummyCount, setDummyCount] = useState(100);
  const dummyLayerRef = useRef<any | null>(null);
  const storeLayerRef = useRef<any | null>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // フィルタ状態
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedChainId, setSelectedChainId] = useState<string>("");
  const [genInBounds, setGenInBounds] = useState<boolean>(false);
  const [shape, setShape] = useState<"random" | "grid">("random");

  const companies: CatalogCompany[] = useMemo(() => catalog?.companies || [], [catalog]);
  const chains: CatalogChain[] = useMemo(() => catalog?.chains || [], [catalog]);
  const categories = useMemo(() => Array.from(new Set((catalog?.chains || []).map((c) => c.category))), [catalog]);

  const chainMap = useMemo(() => {
    const m: Record<string, CatalogChain> = {};
    (catalog?.chains || []).forEach((c) => (m[c.id] = c));
    return m;
  }, [catalog]);
  const companyMap = useMemo(() => {
    const m: Record<string, CatalogCompany> = {};
    (catalog?.companies || []).forEach((c) => (m[c.id] = c));
    return m;
  }, [catalog]);

  const filteredStores = useMemo(() => {
    let stores = catalog?.stores || [];
    if (selectedCategory) {
      stores = stores.filter((s) => chainMap[s.chainId]?.category === selectedCategory);
    }
    if (selectedCompanyId) {
      stores = stores.filter((s) => chainMap[s.chainId]?.companyIds.includes(selectedCompanyId));
    }
    if (selectedChainId) {
      stores = stores.filter((s) => s.chainId === selectedChainId);
    }
    return stores;
  }, [catalog, selectedCategory, selectedCompanyId, selectedChainId, chainMap]);

  useEffect(() => {
    (async () => setCatalog(await getCatalog()))();
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const init = async () => {
      let center = TOKYO;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 3000 }));
        center = { lng: pos.coords.longitude, lat: pos.coords.latitude, zoom: 13 };
      } catch (_) {
        // fallback to TOKYO
      }
      const map = L.map(mapRef.current).setView([center.lat, center.lng], center.zoom);
      mapInstanceRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // 実店舗レイヤー（クラスタリング）
      const cluster = (L as any).markerClusterGroup ? (L as any).markerClusterGroup() : L.layerGroup();
      storeLayerRef.current = cluster.addTo(map);
      rebuildStoreLayer();

      // ダミー表示レイヤー（CircleMarkerをまとめるグループ）
      dummyLayerRef.current = L.layerGroup().addTo(map);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // フィルタ変更やカタログ取得後にレイヤーを再構築
  useEffect(() => {
    rebuildStoreLayer();
    // ストアがあれば自動で全件にフィット（初回/絞り込み変更時）
    if (filteredStores.length > 0 && mapInstanceRef.current) {
      const b = L.latLngBounds(filteredStores.map((s) => [s.lat, s.lng]));
      mapInstanceRef.current.fitBounds(b.pad(0.1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStores]);

  function rebuildStoreLayer() {
    const map = mapInstanceRef.current;
    const layer = storeLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const s of filteredStores) {
      const marker = L.marker([s.lat, s.lng]);
      const chain = chainMap[s.chainId];
      const companyName = chain?.companyIds?.length ? companyMap[chain.companyIds[0]]?.name : undefined;
      const html = `<div style="min-width:180px">
        <div style="font-weight:600">${s.name}</div>
        <div style="font-size:12px;color:#666">${companyName ? companyName + ' / ' : ''}${chain?.displayName || ''}</div>
        <div style="font-size:12px;margin-top:4px">${s.address || ''}</div>
      </div>`;
      marker.bindPopup(html);
      layer.addLayer(marker);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">マップ</h1>
      <Toast message={toast} onClose={() => setToast(null)} />
      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="md:w-48">
              <Label>カテゴリ</Label>
              <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="">すべて</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="md:w-56">
              <Label>会社</Label>
              <Select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}>
                <option value="">すべて</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="md:w-56">
              <Label>チェーン</Label>
              <Select value={selectedChainId} onChange={(e) => setSelectedChainId(e.target.value)}>
                <option value="">すべて</option>
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </Select>
            </div>
            <div className="md:w-56">
              <Label>ダミー店舗数</Label>
              <Input type="number" min={1} max={2000} value={dummyCount}
                     onChange={(e) => setDummyCount(Math.max(1, Math.min(2000, Number(e.target.value) || 0)))} />
            </div>
            <div className="md:w-40">
              <Label>生成範囲</Label>
              <Select value={genInBounds ? "bounds" : "radius"} onChange={(e) => setGenInBounds(e.target.value === "bounds")}>
                <option value="radius">中心から半径</option>
                <option value="bounds">画面範囲内</option>
              </Select>
            </div>
            <div className="md:w-40">
              <Label>形状</Label>
              <Select value={shape} onChange={(e) => setShape(e.target.value as any)}>
                <option value="random">ランダム散布</option>
                <option value="grid">格子状</option>
              </Select>
            </div>
            <Button onClick={() => {
              if (!dummyLayerRef.current) return;
              const mapEl = (dummyLayerRef.current as any)._map;
              if (!mapEl) return;
              let points: CatalogStore[] = [];
              if (genInBounds) {
                const b = mapEl.getBounds();
                if (shape === 'grid') {
                  const n = Math.ceil(Math.sqrt(dummyCount));
                  const latStep = (b.getNorth() - b.getSouth()) / (n + 1);
                  const lngStep = (b.getEast() - b.getWest()) / (n + 1);
                  let placed = 0;
                  for (let i = 1; i <= n && placed < dummyCount; i++) {
                    for (let j = 1; j <= n && placed < dummyCount; j++) {
                      points.push({
                        id: `dummy_grid_${Date.now()}_${i}_${j}`,
                        chainId: 'dummy_chain',
                        name: `ダミー店舗 ${++placed}`,
                        address: '(ダミー)',
                        lat: b.getSouth() + latStep * i,
                        lng: b.getWest() + lngStep * j,
                        tags: [],
                        updatedAt: new Date().toISOString(),
                      });
                    }
                  }
                } else {
                  for (let i = 0; i < dummyCount; i++) {
                    const lat = b.getSouth() + Math.random() * (b.getNorth() - b.getSouth());
                    const lng = b.getWest() + Math.random() * (b.getEast() - b.getWest());
                    points.push({ id: `dummy_bounds_${Date.now()}_${i}`, chainId: 'dummy_chain', name: `ダミー店舗 ${i+1}`, address: '(ダミー)', lat, lng, tags: [], updatedAt: new Date().toISOString() });
                  }
                }
              } else {
                const center = mapEl.getCenter();
                points = generateDummyStores({ lat: center.lat, lng: center.lng }, dummyCount);
              }
              points.forEach((s) => {
                const c = L.circleMarker([s.lat, s.lng], { radius: 5, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.8 });
                c.bindPopup(s.name + '（ダミー）');
                c.addTo(dummyLayerRef.current);
              });
            }}>ダミー追加</Button>
            <Button variant="outline" onClick={() => {
              if (!dummyLayerRef.current) return;
              dummyLayerRef.current.clearLayers();
            }}>ダミークリア</Button>
            <div className="grow" />
            <div className="text-sm text-gray-600 dark:text-gray-400 self-center">表示件数: {filteredStores.length} 件</div>
            <Button variant="outline" onClick={() => {
              if (!mapInstanceRef.current || filteredStores.length === 0) return;
              const b = L.latLngBounds(filteredStores.map((s) => [s.lat, s.lng]));
              mapInstanceRef.current.fitBounds(b.pad(0.1));
            }}>全件にズーム</Button>
            <Button onClick={async () => {
              const updated = await syncCatalog();
              const cat = await getCatalog();
              setCatalog(cat);
              setToast(updated ? 'カタログを同期しました' : 'カタログは最新です');
            }}>最新カタログ同期</Button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">ダミー店舗は一時表示のみで保存されません。</p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div ref={mapRef} className="h-[70vh] w-full rounded-lg border border-gray-200 dark:border-gray-800" />
        </CardBody>
      </Card>
      {/* Leaflet CDN */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      {/* MarkerCluster CDN */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
      />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
      />
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        onLoad={() => setReady(true)}
        strategy="afterInteractive"
      />
      <Script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js" strategy="afterInteractive" />
    </div>
  );
}
