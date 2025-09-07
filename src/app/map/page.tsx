"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCatalog, listHoldings } from "../../lib/db";
import { Catalog, CatalogChain, CatalogCompany, VoucherType } from "../../lib/types";
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

  // フィルタ状態（チェーン複数 + 所有優待 + 券種）
  const [selectedChainIds, setSelectedChainIds] = useState<string[]>([]);
  const [selectedVoucherTypes, setSelectedVoucherTypes] = useState<VoucherType[]>([]);
  const [showOwnedOnly, setShowOwnedOnly] = useState<boolean>(false);
  const [ownedCompanyCodes, setOwnedCompanyCodes] = useState<string[]>([]);
  // 駅検索（中心移動のみ）
  const [stationQuery, setStationQuery] = useState<string>("");
  const [stationResults, setStationResults] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [selectedStation, setSelectedStation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [useMyLocation] = useState<boolean>(false);

  const companies: CatalogCompany[] = useMemo(() => catalog?.companies || [], [catalog]);
  const chains: CatalogChain[] = useMemo(() => catalog?.chains || [], [catalog]);

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
    if (selectedChainIds.length > 0) {
      const set = new Set(selectedChainIds);
      stores = stores.filter((s) => set.has(s.chainId));
    }
    if (selectedVoucherTypes.length > 0) {
      const sv = new Set(selectedVoucherTypes);
      stores = stores.filter((s) => {
        const ch = chainMap[s.chainId];
        if (!ch) return false;
        const vs = ch.voucherTypes || [];
        return vs.some((t) => sv.has(t as VoucherType));
      });
    }
    if (showOwnedOnly && ownedCompanyCodes.length > 0) {
      stores = stores.filter((s) => {
        const ch = chainMap[s.chainId];
        if (!ch) return false;
        // chain.companyIds は内部ID。companies から ticker に変換して照合
        const ids = ch.companyIds || [];
        const idToTicker: Record<string, string> = {};
        (catalog?.companies || []).forEach(c => { idToTicker[c.id] = c.ticker || ""; });
        return ids.map(id => idToTicker[id]).some(tk => tk && ownedCompanyCodes.includes(tk));
      });
    }
    return stores;
  }, [catalog, selectedChainIds, selectedVoucherTypes, showOwnedOnly, ownedCompanyCodes, chainMap]);

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
    // 既に Leaflet が読み込まれているナビゲーション遷移時にも初期化できるようにする
    if (typeof window !== 'undefined' && (window as any).L) {
      setReady(true);
    }
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

      // ナビゲーション遷移後にコンテナサイズが確定していない場合の描画崩れ対策
      try { setTimeout(() => map.invalidateSize(), 0); } catch (_) {}
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 画面サイズ変更やフォーカス時にサイズ再計算
  useEffect(() => {
    const fn = () => { try { mapInstanceRef.current?.invalidateSize(); } catch (_) {} };
    window.addEventListener('resize', fn);
    window.addEventListener('focus', fn);
    return () => {
      window.removeEventListener('resize', fn);
      window.removeEventListener('focus', fn);
    };
  }, []);

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

  // 中心点のオーバーレイ更新
  useEffect(() => { updateCenterOverlay(); }, [selectedStation]);

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

  // 所有優待の証券コードをロード
  useEffect(() => {
    (async () => {
      try {
        const hs = await listHoldings();
        const codes = Array.from(new Set(hs.map((h) => h.companyId).filter(Boolean)));
        setOwnedCompanyCodes(codes);
      } catch (_) {
        setOwnedCompanyCodes([]);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">マップ</h1>
      <Toast message={toast} onClose={() => setToast(null)} />
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="w-full">
              <Label>チェーン（複数選択可）</Label>
              <Select multiple size={5} value={selectedChainIds}
                      onChange={(e) => {
                        const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                        setSelectedChainIds(opts);
                      }}>
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </Select>
            </div>
            <div className="w-full">
              <Label>券種（複数選択可）</Label>
              <Select multiple size={4} value={selectedVoucherTypes as string[]}
                      onChange={(e) => {
                        const opts = Array.from(e.target.selectedOptions).map(o => o.value as VoucherType);
                        setSelectedVoucherTypes(opts);
                      }}>
                {(["食事","買い物","レジャー","その他"] as VoucherType[]).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </div>
            <div className="w-full pt-6">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={showOwnedOnly} onChange={(e) => setShowOwnedOnly(e.target.checked)} />
                所有している優待のみ表示
              </label>
            </div>
            <div className="w-full lg:col-span-2">
              <Label>駅名（中心に移動）</Label>
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
            <div className="text-sm text-gray-600 dark:text-gray-400 self-center">表示件数: {filteredStores.length} 件</div>
            <Button className="w-full" variant="outline" onClick={goToMyLocation}>現在地へ移動</Button>
            <Button className="w-full" variant="outline" onClick={() => {
              // 条件リセット
              setSelectedChainIds([]);
              setSelectedVoucherTypes([]);
              setShowOwnedOnly(false);
              setSelectedStation(null);
              setStationQuery("");
              updateCenterOverlay();
              if (mapInstanceRef.current && (catalog?.stores || []).length > 0) {
                const b = L.latLngBounds((catalog?.stores || []).map((s) => [s.lat, s.lng]));
                mapInstanceRef.current.fitBounds(b.pad(0.1));
              }
            }}>条件リセット</Button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">駅検索はOpenStreetMapのNominatimを利用します。</p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div ref={mapRef} className="h-[70vh] lg:h-[78vh] w-full rounded-lg border border-gray-200 dark:border-gray-800" />
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
