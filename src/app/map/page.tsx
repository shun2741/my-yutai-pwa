"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCatalog } from "../../lib/db";
import { Catalog, CatalogChain, CatalogCompany } from "../../lib/types";
import Card, { CardBody } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input, Label, Select } from "../../components/ui/Input";
import Toast from "../../components/ui/Toast";
import { syncCatalog } from "../../lib/catalogSync";

declare const L: any; // Leaflet (CDN)

const TOKYO = { lng: 139.767125, lat: 35.681236, zoom: 12 };

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<Catalog | undefined>();
  const [ready, setReady] = useState(false);
  const myLocLayerRef = useRef<any | null>(null);
  const poiLayerRef = useRef<any | null>(null);
  const storeLayerRef = useRef<any | null>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // フィルタ状態
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedChainId, setSelectedChainId] = useState<string>("");
  // 駅検索・範囲絞り込み
  const [stationQuery, setStationQuery] = useState<string>("");
  const [stationResults, setStationResults] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [selectedStation, setSelectedStation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(1.5);
  const [filterByRadius, setFilterByRadius] = useState<boolean>(false);
  const [useMyLocation, setUseMyLocation] = useState<boolean>(false);

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
    if (filterByRadius) {
      const center = getFilterCenter();
      if (center && radiusKm > 0) {
        stores = stores.filter((s) => distanceKm(center, { lat: s.lat, lng: s.lng }) <= radiusKm);
      }
    }
    return stores;
  }, [catalog, selectedCategory, selectedCompanyId, selectedChainId, chainMap, filterByRadius, radiusKm, selectedStation, useMyLocation]);

  useEffect(() => {
    (async () => setCatalog(await getCatalog()))();
  }, []);

  // 起動時とフォーカス時に最新へ同期してからカタログを取り直す
  useEffect(() => {
    let aborted = false;
    const syncThenLoad = async () => {
      try {
        await syncCatalog();
      } catch (_) {}
      if (!aborted) setCatalog(await getCatalog());
    };
    syncThenLoad();
    const onFocus = () => syncThenLoad();
    window.addEventListener('focus', onFocus);
    return () => {
      aborted = true;
      window.removeEventListener('focus', onFocus);
    };
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

      // 現在地と中心点の可視化レイヤー
      myLocLayerRef.current = L.layerGroup().addTo(map);
      poiLayerRef.current = L.layerGroup().addTo(map);
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

  // 中心点/半径のオーバーレイ更新
  useEffect(() => { updateCenterOverlay(); }, [filterByRadius, radiusKm, selectedStation, useMyLocation]);

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

  function updateCenterOverlay() {
    const layer = poiLayerRef.current;
    const map = mapInstanceRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const center = getFilterCenter();
    if (!center) return;
    const marker = L.marker([center.lat, center.lng], { title: '中心点' });
    marker.addTo(layer);
    if (filterByRadius && radiusKm > 0) {
      const circle = L.circle([center.lat, center.lng], { radius: radiusKm * 1000, color: '#dc2626', fillColor: '#fca5a5', fillOpacity: 0.1 });
      circle.addTo(layer);
    }
  }

  // 2点間距離（km）
  function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
  }

  const myLocation = useRef<{ lat: number; lng: number } | null>(null);
  function getFilterCenter(): { lat: number; lng: number } | null {
    if (useMyLocation && myLocation.current) return myLocation.current;
    if (selectedStation) return { lat: selectedStation.lat, lng: selectedStation.lng };
    return null;
  }

  async function goToMyLocation() {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 }));
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      myLocation.current = p;
      if (myLocLayerRef.current) {
        myLocLayerRef.current.clearLayers();
        const m = L.circleMarker([p.lat, p.lng], { radius: 6, color: '#10b981', fillColor: '#34d399', fillOpacity: 0.9 });
        m.bindPopup('現在地');
        m.addTo(myLocLayerRef.current);
      }
      if (mapInstanceRef.current) mapInstanceRef.current.setView([p.lat, p.lng], 14);
      updateCenterOverlay();
    } catch (_) {
      setToast('現在地を取得できませんでした');
    }
  }

  async function searchStation(q: string) {
    const query = q.trim();
    if (!query) { setStationResults([]); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=jp&limit=8&accept-language=ja&q=${encodeURIComponent(query + ' 駅')}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('search failed');
      const json: any[] = await res.json();
      const results = json.map((r) => ({ name: r.display_name as string, lat: Number(r.lat), lng: Number(r.lon) }));
      setStationResults(results);
    } catch (_) {
      setStationResults([]);
      setToast('駅の検索に失敗しました');
    }
  }

  function selectStation(s: { name: string; lat: number; lng: number }) {
    setSelectedStation(s);
    setStationResults([]);
    setStationQuery(s.name);
    if (mapInstanceRef.current) mapInstanceRef.current.setView([s.lat, s.lng], 14);
    updateCenterOverlay();
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
            <div className="md:w-72">
              <Label>駅名</Label>
              <div className="flex gap-2">
                <Input value={stationQuery} onChange={(e) => setStationQuery(e.target.value)} placeholder="例: 東京駅 / 渋谷" />
                <Button onClick={() => searchStation(stationQuery)}>検索</Button>
              </div>
              {stationResults.length > 0 && (
                <div className="mt-1 max-h-52 overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  {stationResults.map((r, i) => (
                    <button key={`${r.name}-${i}`} type="button" className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => selectStation(r)}>
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="md:w-40">
              <Label>半径 (km)</Label>
              <Input type="number" min={0.1} step={0.1} value={radiusKm} onChange={(e) => setRadiusKm(Math.max(0.1, Number(e.target.value) || 0))} />
            </div>
            <div className="md:w-40">
              <Label>範囲で絞る</Label>
              <Select value={filterByRadius ? (useMyLocation ? 'myloc' : 'station') : ''} onChange={(e) => {
                const v = e.target.value;
                if (!v) { setFilterByRadius(false); return; }
                setFilterByRadius(true);
                setUseMyLocation(v === 'myloc');
                updateCenterOverlay();
              }}>
                <option value="">しない</option>
                <option value="station">駅を中心</option>
                <option value="myloc">現在地を中心</option>
              </Select>
            </div>
            <div className="grow" />
            <div className="text-sm text-gray-600 dark:text-gray-400 self-center">表示件数: {filteredStores.length} 件</div>
            <Button variant="outline" onClick={() => {
              if (!mapInstanceRef.current || filteredStores.length === 0) return;
              const b = L.latLngBounds(filteredStores.map((s) => [s.lat, s.lng]));
              mapInstanceRef.current.fitBounds(b.pad(0.1));
            }}>全件にズーム</Button>
            <Button variant="outline" onClick={goToMyLocation}>現在地へ移動</Button>
            <Button onClick={async () => {
              const updated = await syncCatalog();
              const cat = await getCatalog();
              setCatalog(cat);
              setToast(updated ? 'カタログを同期しました' : 'カタログは最新です');
            }}>最新カタログ同期</Button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">駅検索はOpenStreetMapのNominatimを利用します。</p>
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
