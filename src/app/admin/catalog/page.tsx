"use client";

import { useEffect, useMemo, useState } from "react";
import Card, { CardBody, CardHeader } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { Input, Label, Select, Textarea } from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import { getCatalog, setCatalog } from "../../../lib/db";
import { Catalog, CatalogChain, CatalogCompany, CatalogStore } from "../../../lib/types";
import { toCsv } from "../../../lib/csv";
import { syncCatalog } from "../../../lib/catalogSync";

type Draft = Catalog;

export default function AdminCatalogPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const c = await getCatalog();
      if (c) setDraft(structuredClone(c));
    })();
  }, []);

  const companies = draft?.companies || [];
  const chains = draft?.chains || [];
  const stores = draft?.stores || [];

  // フィルタ/編集状態
  const [filterCompanyId, setFilterCompanyId] = useState<string>("");
  const [filterChainId, setFilterChainId] = useState<string>("");
  const [filterQ, setFilterQ] = useState<string>("");
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [companyDraft, setCompanyDraft] = useState<Partial<CatalogCompany>>({});
  const [editingChainId, setEditingChainId] = useState<string | null>(null);
  const [chainDraft, setChainDraft] = useState<Partial<CatalogChain>>({});
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [storeDraft, setStoreDraft] = useState<Partial<CatalogStore>>({});

  const companyMap = useMemo(() => Object.fromEntries(companies.map(c => [c.id, c])), [companies]);
  const chainMap = useMemo(() => Object.fromEntries(chains.map(c => [c.id, c])), [chains]);

  const issues = useMemo(() => {
    const list: string[] = [];
    // 参照整合チェック
    for (const ch of chains) {
      for (const cid of ch.companyIds) {
        if (!companyMap[cid]) list.push(`チェーン ${ch.displayName} の companyIds に未知のID: ${cid}`);
      }
    }
    for (const s of stores) {
      if (!chainMap[s.chainId]) list.push(`店舗 ${s.name} の chainId が未知: ${s.chainId}`);
      if (Number.isNaN(Number(s.lat)) || Number.isNaN(Number(s.lng))) list.push(`店舗 ${s.name} の座標が不正`);
    }
    return list;
  }, [chains, stores, companyMap, chainMap]);

  const chainsOfCompany = useMemo(() => {
    if (!filterCompanyId) return chains;
    return chains.filter(c => c.companyIds.includes(filterCompanyId));
  }, [chains, filterCompanyId]);

  const filteredStores = useMemo(() => {
    let arr = stores;
    if (filterCompanyId) {
      const chainIds = new Set(chains.filter(c => c.companyIds.includes(filterCompanyId)).map(c => c.id));
      arr = arr.filter(s => chainIds.has(s.chainId));
    }
    if (filterChainId) arr = arr.filter(s => s.chainId === filterChainId);
    if (filterQ) {
      const q = filterQ.toLowerCase();
      arr = arr.filter(s => (s.name || "").toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q));
    }
    return arr;
  }, [stores, chains, filterCompanyId, filterChainId, filterQ]);

  function download(filename: string, text: string, type = "text/plain") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsvs() {
    if (!draft) return;
    const companiesCsv = toCsv<CatalogCompany>(["id","name","ticker","chainIds","voucherTypes","notes"], companies.map(c => ({...c, chainIds: c.chainIds.join(","), voucherTypes: c.voucherTypes.join(",")} as any)));
    const chainsCsv = toCsv<CatalogChain>(["id","displayName","category","companyIds","voucherTypes","tags","url"], chains.map(c => ({...c, companyIds: c.companyIds.join(","), voucherTypes: c.voucherTypes.join(","), tags: c.tags.join(",")} as any)));
    const storesCsv = toCsv<CatalogStore>(["id","chainId","name","address","lat","lng","tags","updatedAt"], stores.map(s => ({...s, tags: s.tags.join(",")} as any)));
    download("companies.csv", companiesCsv, "text/csv;charset=utf-8");
    download("chains.csv", chainsCsv, "text/csv;charset=utf-8");
    download("stores.csv", storesCsv, "text/csv;charset=utf-8");
  }

  function exportJson() {
    if (!draft) return;
    download(`catalog-${draft.version || "draft"}.json`, JSON.stringify(draft, null, 2), "application/json");
  }

  async function importJson(file: File) {
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      if (!json || typeof json !== "object") throw new Error("JSONではありません");
      setDraft(json as Catalog);
      setToast("JSONを読み込みました");
    } catch (e: any) {
      setToast(`読み込み失敗: ${e.message || e}`);
    }
  }

  async function saveToDB() {
    if (!draft) return;
    await setCatalog(draft);
    setToast("IndexedDBに保存しました（アプリで即時反映）");
  }

  async function syncFromPublished() {
    const updated = await syncCatalog();
    const c = await getCatalog();
    if (c) setDraft(structuredClone(c));
    setToast(updated ? "公開カタログを同期しました" : "公開カタログは最新です");
  }

  function addCompany() {
    if (!draft) return;
    const id = prompt("会社ID (例: comp-skylark)")?.trim();
    const name = prompt("会社名")?.trim();
    if (!id || !name) return;
    if (draft.companies.find(c => c.id === id)) { setToast("同じIDが存在します"); return; }
    draft.companies.push({ id, name, chainIds: [], voucherTypes: [], notes: undefined });
    setDraft({ ...draft });
  }
  function addChain() {
    if (!draft) return;
    const id = prompt("チェーンID (例: chain-syabuyo)")?.trim();
    const displayName = prompt("表示名")?.trim();
    const category = prompt("カテゴリ（飲食/小売/宿泊/サービス/交通/その他）")?.trim() || "飲食";
    if (!id || !displayName) return;
    if (draft.chains.find(c => c.id === id)) { setToast("同じIDが存在します"); return; }
    draft.chains.push({ id, displayName, category, companyIds: [], voucherTypes: [], tags: [], url: undefined });
    setDraft({ ...draft });
  }
  function addStore() {
    if (!draft) return;
    const chainId = prompt("chainId (既存チェーンのID)")?.trim();
    const name = prompt("店舗名")?.trim();
    const address = prompt("住所（任意）")?.trim() || "";
    const lat = Number(prompt("緯度（例: 35.68）") || "");
    const lng = Number(prompt("経度（例: 139.76）") || "");
    if (!chainId || !name || Number.isNaN(lat) || Number.isNaN(lng)) return;
    const id = `store-${chainId.replace(/^chain-/, "")}-${Date.now()}`;
    draft.stores.push({ id, chainId, name, address, lat, lng, tags: [], updatedAt: new Date().toISOString() });
    setDraft({ ...draft });
  }

  function startEditCompany(c: CatalogCompany) {
    setEditingCompanyId(c.id);
    setCompanyDraft({ ...c, chainIds: [...c.chainIds], voucherTypes: [...c.voucherTypes] });
  }
  function saveEditCompany() {
    if (!draft || !editingCompanyId) return;
    const idx = draft.companies.findIndex(c => c.id === editingCompanyId);
    if (idx >= 0) {
      const updated: CatalogCompany = {
        id: editingCompanyId,
        name: String(companyDraft.name || ""),
        ticker: companyDraft.ticker || undefined,
        chainIds: (typeof companyDraft.chainIds === 'string' ? String(companyDraft.chainIds).split(',').map(s=>s.trim()).filter(Boolean) : (companyDraft.chainIds as string[]) ) || [],
        voucherTypes: (typeof companyDraft.voucherTypes === 'string' ? String(companyDraft.voucherTypes).split(',').map(s=>s.trim()).filter(Boolean) : (companyDraft.voucherTypes as string[]) ) || [],
        notes: companyDraft.notes || undefined,
      };
      draft.companies[idx] = updated;
      setDraft({ ...draft });
      setEditingCompanyId(null);
    }
  }
  function deleteCompany(id: string) {
    if (!draft) return;
    const affected = draft.chains.filter(c => c.companyIds.includes(id)).length;
    if (!confirm(`企業を削除しますか？関連チェーン (${affected}) の紐付けは外れます。`)) return;
    draft.companies = draft.companies.filter(c => c.id !== id);
    draft.chains = draft.chains.map(ch => ({ ...ch, companyIds: ch.companyIds.filter(x => x !== id) }));
    setDraft({ ...draft });
  }

  function startEditChain(c: CatalogChain) {
    setEditingChainId(c.id);
    setChainDraft({ ...c, companyIds: [...c.companyIds], voucherTypes: [...c.voucherTypes], tags: [...c.tags] });
  }
  function saveEditChain() {
    if (!draft || !editingChainId) return;
    const idx = draft.chains.findIndex(c => c.id === editingChainId);
    if (idx >= 0) {
      const updated: CatalogChain = {
        id: editingChainId,
        displayName: String(chainDraft.displayName || ""),
        category: String(chainDraft.category || "その他"),
        companyIds: (typeof chainDraft.companyIds === 'string' ? String(chainDraft.companyIds).split(',').map(s=>s.trim()).filter(Boolean) : (chainDraft.companyIds as string[]) ) || [],
        voucherTypes: (typeof chainDraft.voucherTypes === 'string' ? String(chainDraft.voucherTypes).split(',').map(s=>s.trim()).filter(Boolean) : (chainDraft.voucherTypes as string[]) ) || [],
        tags: (typeof chainDraft.tags === 'string' ? String(chainDraft.tags).split(',').map(s=>s.trim()).filter(Boolean) : (chainDraft.tags as string[]) ) || [],
        url: chainDraft.url || undefined,
      };
      draft.chains[idx] = updated;
      setDraft({ ...draft });
      setEditingChainId(null);
    }
  }
  function deleteChain(id: string) {
    if (!draft) return;
    const affected = draft.stores.filter(s => s.chainId === id).length;
    if (!confirm(`チェーンを削除しますか？関連店舗 ${affected} 件も削除されます。`)) return;
    draft.chains = draft.chains.filter(c => c.id !== id);
    draft.stores = draft.stores.filter(s => s.chainId !== id);
    setDraft({ ...draft });
  }

  function startEditStore(s: CatalogStore) {
    setEditingStoreId(s.id);
    setStoreDraft({ ...s, tags: [...s.tags] });
  }
  function saveEditStore() {
    if (!draft || !editingStoreId) return;
    const idx = draft.stores.findIndex(s => s.id === editingStoreId);
    if (idx >= 0) {
      const updated: CatalogStore = {
        id: editingStoreId,
        chainId: String(storeDraft.chainId || draft.stores[idx].chainId),
        name: String(storeDraft.name || ""),
        address: String(storeDraft.address || ""),
        lat: Number(storeDraft.lat),
        lng: Number(storeDraft.lng),
        tags: (typeof storeDraft.tags === 'string' ? String(storeDraft.tags).split(',').map(s=>s.trim()).filter(Boolean) : (storeDraft.tags as string[]) ) || [],
        updatedAt: new Date().toISOString(),
      };
      if (Number.isNaN(updated.lat) || Number.isNaN(updated.lng)) { setToast("緯度経度が不正です"); return; }
      draft.stores[idx] = updated;
      setDraft({ ...draft });
      setEditingStoreId(null);
    }
  }
  function deleteStore(id: string) {
    if (!draft) return;
    if (!confirm("店舗を削除しますか？")) return;
    draft.stores = draft.stores.filter(s => s.id !== id);
    setDraft({ ...draft });
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">カタログ管理</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">カタログを読み込み中…</p>
        <div className="mt-2">
          <Button onClick={syncFromPublished}>公開カタログを読み込む</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toast message={toast} onClose={() => setToast(null)} />
      <h1 className="text-2xl font-bold">カタログ管理</h1>

      <Card>
        <CardHeader title="操作" subtitle="JSON/CSVで入出力できます。DB保存はこの端末のみです。" />
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={exportJson}>JSONエクスポート</Button>
            <Button variant="outline" onClick={exportCsvs}>CSVエクスポート</Button>
            <label className="ml-2 inline-flex items-center gap-2 text-sm">
              <span>JSONインポート</span>
              <input className="hidden" id="import-json" type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); }} />
              <Button variant="outline" onClick={() => document.getElementById("import-json")?.click()}>ファイル選択</Button>
            </label>
            <Button variant="outline" onClick={saveToDB}>DBに保存</Button>
            <Button variant="outline" onClick={syncFromPublished}>公開カタログ同期</Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">version: {draft.version}</span>
          </div>
          {issues.length > 0 && (
            <div className="mt-3 text-sm text-red-600">
              <div className="font-semibold">警告（{issues.length}）</div>
              <ul className="list-disc pl-5">
                {issues.slice(0, 10).map((x, i) => (<li key={i}>{x}</li>))}
              </ul>
              {issues.length > 10 && <div>…他 {issues.length - 10} 件</div>}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`企業 (${companies.length})`} />
        <CardBody>
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" onClick={addCompany}>企業を追加</Button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800"><th className="px-2 py-1 text-left">id</th><th className="px-2 py-1 text-left">name</th><th className="px-2 py-1">voucherTypes</th><th className="px-2 py-1 text-center">操作</th></tr>
              </thead>
              <tbody>
                {companies.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 ? "bg-white/40 dark:bg-gray-900/40" : ""}>
                    <td className="px-2 py-1 font-mono">{c.id}</td>
                    <td className="px-2 py-1">
                      {editingCompanyId === c.id ? (
                        <Input value={String(companyDraft.name || "")} onChange={(e)=>setCompanyDraft(d=>({...d, name:e.target.value}))} />
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {editingCompanyId === c.id ? (
                        <Input value={(Array.isArray(companyDraft.voucherTypes)?companyDraft.voucherTypes.join(','):String(companyDraft.voucherTypes||''))}
                               onChange={(e)=>setCompanyDraft(d=>({...d, voucherTypes:e.target.value}))} />
                      ) : (
                        c.voucherTypes.join(",")
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {editingCompanyId === c.id ? (
                        <div className="flex justify-center gap-2"><Button size="sm" onClick={saveEditCompany}>保存</Button><Button size="sm" variant="outline" onClick={()=>setEditingCompanyId(null)}>取消</Button></div>
                      ) : (
                        <div className="flex justify-center gap-2"><Button size="sm" variant="outline" onClick={()=>startEditCompany(c)}>編集</Button><Button size="sm" variant="ghost" onClick={()=>deleteCompany(c.id)}>削除</Button></div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`チェーン (${chains.length})`} />
        <CardBody>
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" onClick={addChain}>チェーンを追加</Button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800"><th className="px-2 py-1 text-left">id</th><th className="px-2 py-1 text-left">displayName</th><th className="px-2 py-1">category</th><th className="px-2 py-1 text-left">companyIds</th><th className="px-2 py-1 text-center">操作</th></tr>
              </thead>
              <tbody>
                {chains.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 ? "bg-white/40 dark:bg-gray-900/40" : ""}>
                    <td className="px-2 py-1 font-mono">{c.id}</td>
                    <td className="px-2 py-1">
                      {editingChainId === c.id ? (
                        <Input value={String(chainDraft.displayName || "")} onChange={(e)=>setChainDraft(d=>({...d, displayName:e.target.value}))} />
                      ) : c.displayName}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {editingChainId === c.id ? (
                        <Select value={String(chainDraft.category || c.category)} onChange={(e)=>setChainDraft(d=>({...d, category:e.target.value}))}>
                          {['飲食','小売','サービス','交通','宿泊','その他'].map(x => (<option key={x} value={x}>{x}</option>))}
                        </Select>
                      ) : c.category}
                    </td>
                    <td className="px-2 py-1 font-mono">
                      {editingChainId === c.id ? (
                        <Input value={(Array.isArray(chainDraft.companyIds)?chainDraft.companyIds.join(','):String(chainDraft.companyIds||''))}
                               onChange={(e)=>setChainDraft(d=>({...d, companyIds:e.target.value}))} />
                      ) : c.companyIds.join(',')}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {editingChainId === c.id ? (
                        <div className="flex justify-center gap-2"><Button size="sm" onClick={saveEditChain}>保存</Button><Button size="sm" variant="outline" onClick={()=>setEditingChainId(null)}>取消</Button></div>
                      ) : (
                        <div className="flex justify-center gap-2"><Button size="sm" variant="outline" onClick={()=>startEditChain(c)}>編集</Button><Button size="sm" variant="ghost" onClick={()=>deleteChain(c.id)}>削除</Button></div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`店舗 (${stores.length})`} />
        <CardBody>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <div>
              <Label>会社で絞り込み</Label>
              <Select value={filterCompanyId} onChange={(e)=>{ setFilterCompanyId(e.target.value); setFilterChainId(""); }}>
                <option value="">すべて</option>
                {companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
            </div>
            <div>
              <Label>チェーンで絞り込み</Label>
              <Select value={filterChainId} onChange={(e)=>setFilterChainId(e.target.value)}>
                <option value="">すべて</option>
                {chainsOfCompany.map(c => (<option key={c.id} value={c.id}>{c.displayName}</option>))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>キーワード（店名/住所）</Label>
              <Input placeholder="例: 新宿 / 東京" value={filterQ} onChange={(e)=>setFilterQ(e.target.value)} />
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" onClick={addStore}>店舗を追加</Button>
            <div className="text-xs text-gray-500">大量の追加はCSVインポート（OSMや公式サイトCSVから）を推奨</div>
            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">表示件数: {filteredStores.length} 件</div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800"><th className="px-2 py-1 text-left">name</th><th className="px-2 py-1 text-left">chainId</th><th className="px-2 py-1 text-left">address</th><th className="px-2 py-1">lat</th><th className="px-2 py-1">lng</th><th className="px-2 py-1 text-center">操作</th></tr>
              </thead>
              <tbody>
                {filteredStores.slice(0, 500).map((s, idx) => (
                  <tr key={s.id} className={idx % 2 ? "bg-white/40 dark:bg-gray-900/40" : ""}>
                    <td className="px-2 py-1">
                      {editingStoreId === s.id ? (
                        <Input value={String(storeDraft.name || "")} onChange={(e)=>setStoreDraft(d=>({...d, name:e.target.value}))} />
                      ) : s.name}
                    </td>
                    <td className="px-2 py-1">
                      {editingStoreId === s.id ? (
                        <Select value={String(storeDraft.chainId || s.chainId)} onChange={(e)=>setStoreDraft(d=>({...d, chainId:e.target.value}))}>
                          {chains.map(c => (<option key={c.id} value={c.id}>{c.displayName}</option>))}
                        </Select>
                      ) : <span className="font-mono">{s.chainId}</span>}
                    </td>
                    <td className="px-2 py-1">
                      {editingStoreId === s.id ? (
                        <Input value={String(storeDraft.address || "")} onChange={(e)=>setStoreDraft(d=>({...d, address:e.target.value}))} />
                      ) : s.address}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {editingStoreId === s.id ? (
                        <Input value={String(storeDraft.lat ?? s.lat)} onChange={(e)=>setStoreDraft(d=>({...d, lat:e.target.value}))} />
                      ) : s.lat}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {editingStoreId === s.id ? (
                        <Input value={String(storeDraft.lng ?? s.lng)} onChange={(e)=>setStoreDraft(d=>({...d, lng:e.target.value}))} />
                      ) : s.lng}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {editingStoreId === s.id ? (
                        <div className="flex justify-center gap-2"><Button size="sm" onClick={saveEditStore}>保存</Button><Button size="sm" variant="outline" onClick={()=>setEditingStoreId(null)}>取消</Button></div>
                      ) : (
                        <div className="flex justify-center gap-2"><Button size="sm" variant="outline" onClick={()=>startEditStore(s)}>編集</Button><Button size="sm" variant="ghost" onClick={()=>deleteStore(s.id)}>削除</Button></div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStores.length > 500 && <div className="mt-1 text-xs text-gray-500">表示は先頭500件までです。CSVで全件を出力できます。</div>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
