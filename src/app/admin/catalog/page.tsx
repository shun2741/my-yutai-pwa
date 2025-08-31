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
          <div className="mb-2"><Button size="sm" onClick={addCompany}>企業を追加</Button></div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800"><th className="px-2 py-1 text-left">id</th><th className="px-2 py-1 text-left">name</th><th className="px-2 py-1">chains</th><th className="px-2 py-1">voucherTypes</th></tr>
              </thead>
              <tbody>
                {companies.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 ? "bg-white/40 dark:bg-gray-900/40" : ""}>
                    <td className="px-2 py-1 font-mono">{c.id}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 text-center">{c.chainIds.length}</td>
                    <td className="px-2 py-1 text-center">{c.voucherTypes.join(",")}</td>
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
          <div className="mb-2"><Button size="sm" onClick={addChain}>チェーンを追加</Button></div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800"><th className="px-2 py-1 text-left">id</th><th className="px-2 py-1 text-left">displayName</th><th className="px-2 py-1">category</th><th className="px-2 py-1">companies</th></tr>
              </thead>
              <tbody>
                {chains.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 ? "bg-white/40 dark:bg-gray-900/40" : ""}>
                    <td className="px-2 py-1 font-mono">{c.id}</td>
                    <td className="px-2 py-1">{c.displayName}</td>
                    <td className="px-2 py-1 text-center">{c.category}</td>
                    <td className="px-2 py-1 text-center">{c.companyIds.length}</td>
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
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" onClick={addStore}>店舗を追加</Button>
            <div className="text-xs text-gray-500">大量の追加はCSVインポート（OSMや公式サイトCSVから）を推奨</div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800"><th className="px-2 py-1 text-left">name</th><th className="px-2 py-1 text-left">chainId</th><th className="px-2 py-1 text-left">address</th><th className="px-2 py-1">lat</th><th className="px-2 py-1">lng</th></tr>
              </thead>
              <tbody>
                {stores.slice(0, 300).map((s, idx) => (
                  <tr key={s.id} className={idx % 2 ? "bg-white/40 dark:bg-gray-900/40" : ""}>
                    <td className="px-2 py-1">{s.name}</td>
                    <td className="px-2 py-1 font-mono">{s.chainId}</td>
                    <td className="px-2 py-1">{s.address}</td>
                    <td className="px-2 py-1 text-right">{s.lat}</td>
                    <td className="px-2 py-1 text-right">{s.lng}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stores.length > 300 && <div className="mt-1 text-xs text-gray-500">表示は先頭300件までです。CSVで全件を出力できます。</div>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

