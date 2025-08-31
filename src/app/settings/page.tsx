"use client";

import { clearAll, getCatalog, getCatalogMeta, listHoldings, setCatalog, setCatalogMeta } from "../../lib/db";
import { BackupJson, SCHEMA_VERSION } from "../../lib/types";
import Card, { CardBody, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { useEffect, useMemo, useState } from "react";
import { getCatalogBase, syncCatalog } from "../../lib/catalogSync";

export default function SettingsPage() {
  const [catalogMeta, setMeta] = useState<{ hash?: string; fetchedAt?: number } | null>(null);

  useEffect(() => {
    (async () => setMeta((await getCatalogMeta()) || null))();
  }, []);

  const catalogBase = useMemo(() => getCatalogBase(), []);
  const catalogBaseKind = useMemo(() => {
    // http(s) で始まれば外部参照、それ以外は内蔵（basePath配下）
    return /^https?:\/\//.test(catalogBase) ? "外部" : "内蔵";
  }, [catalogBase]);
  const fetchedAtText = useMemo(() => {
    if (!catalogMeta?.fetchedAt) return "未取得";
    try {
      const d = new Date(catalogMeta.fetchedAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}-${m}-${day} ${hh}:${mm}`;
    } catch (_) {
      return "-";
    }
  }, [catalogMeta]);

  async function syncNow() {
    await syncCatalog({ force: true });
    setMeta((await getCatalogMeta()) || null);
  }

  async function exportJson() {
    const [holdings, catalog, catalog_meta] = await Promise.all([
      listHoldings(),
      getCatalog(),
      getCatalogMeta(),
    ]);
    const data: BackupJson = {
      schemaVersion: SCHEMA_VERSION,
      holdings,
      catalog,
      catalog_meta,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const d = new Date();
    a.download = `yutai-backup-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    const text = await file.text();
    const json = JSON.parse(text) as BackupJson;
    if (!json || typeof json !== "object") {
      alert("不正なJSONです");
      return;
    }
    if (typeof json.schemaVersion !== "number") {
      if (!confirm("schemaVersionが見つかりません。続行しますか？")) return;
    }
    // 全クリア→投入
    await clearAll();
    if (json.holdings && Array.isArray(json.holdings)) {
      for (const h of json.holdings) {
        // eslint-disable-next-line no-await-in-loop
        await (await import("../../lib/db")).putHolding(h as any);
      }
    }
    if (json.catalog) await setCatalog(json.catalog as any);
    if (json.catalog_meta) await setCatalogMeta(json.catalog_meta as any);
    alert("インポートが完了しました。再読み込みします。");
    location.reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">設定</h1>
      <Card>
        <CardHeader title="カタログ情報" />
        <CardBody>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium">参照先URL</span>: <code className="break-all">{catalogBase}</code>
              <span className="ml-2 text-gray-500 dark:text-gray-400">（{catalogBaseKind}）</span>
            </div>
            <div>
              <span className="font-medium">最終取得日時</span>: {fetchedAtText}
            </div>
            <div>
              <span className="font-medium">現在のハッシュ</span>: {catalogMeta?.hash || "-"}
            </div>
            <div className="pt-1">
              <Button size="sm" onClick={syncNow}>今すぐ同期</Button>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="バックアップ" />
        <CardBody>
          <Button onClick={exportJson}>JSONエクスポート</Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="復元" />
        <CardBody>
          <input
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200 dark:file:bg-gray-800 dark:hover:file:bg-gray-700"
            type="file"
            accept="application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); }}
          />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">復元時は既存データをクリアしてから投入します。</p>
        </CardBody>
      </Card>
    </div>
  );
}
