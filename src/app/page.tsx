"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteHolding, listHoldings } from "../lib/db";
import { Holding } from "../lib/types";
import { syncCatalog } from "../lib/catalogSync";
import Card, { CardBody } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Toast from "../components/ui/Toast";

export default function Page() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Holding>>({});

  useEffect(() => {
    (async () => setHoldings(await listHoldings()))();
  }, []);

  useEffect(() => {
    let timer: any;
    const doSync = async () => {
      const updated = await syncCatalog();
      if (updated) {
        setToast("優待データを更新しました");
        timer = setTimeout(() => setToast(null), 2500);
      }
    };
    doSync();
    const onFocus = () => doSync();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const expiringThisMonth = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return holdings.filter((h) => h.expiry.startsWith(ym)).length;
  }, [holdings]);

  function daysUntil(dateStr: string): number {
    const today = new Date();
    const target = new Date(dateStr + "T00:00:00");
    const diff = Math.ceil((target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
    return diff;
  }

  const sorted = useMemo(() => [...holdings].sort((a, b) => a.expiry.localeCompare(b.expiry)), [holdings]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">株主優待管理アプリ YutaiGO</h1>
      <Toast message={toast} onClose={() => setToast(null)} />
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="text-base font-medium">今月期限の優待</div>
            <Badge color={expiringThisMonth === 0 ? "gray" : expiringThisMonth < 3 ? "yellow" : "red"}>{expiringThisMonth}件</Badge>
          </div>
        </CardBody>
      </Card>
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">所有中の優待券</div>
        <Link href="/holdings" className="text-sm text-blue-600 hover:underline">一覧を開く</Link>
      </div>
      <div className="grid gap-3">
        {sorted.length === 0 && (
          <Card><CardBody><div className="text-sm text-gray-600 dark:text-gray-400">まだ優待券が登録されていません。<Link href="/holdings" className="text-blue-600 hover:underline">こちら</Link>から追加できます。</div></CardBody></Card>
        )}
        {sorted.map((h) => (
          <Card key={h.id}>
            <CardBody>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold">{h.companyName} <span className="text-sm font-normal text-gray-500">（{h.voucherType}）</span></div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">期限: {h.expiry} {h.amount != null ? ` / 残額: ${h.amount}円` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={(() => { const d = Math.max(0, daysUntil(h.expiry)); return d < 30 ? "red" : d < 90 ? "yellow" : "gray"; })()}>
                    残{Math.max(0, daysUntil(h.expiry))}日
                  </Badge>
                  <button
                    className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                    onClick={() => { setEditingId(h.id); setEditForm({ ...h }); }}
                  >編集</button>
                  <button
                    className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={async () => {
                      if (!confirm("削除しますか？")) return;
                      await deleteHolding(h.id);
                      setHoldings(await listHoldings());
                    }}
                  >削除</button>
                </div>
              </div>
              {editingId === h.id && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">期限</div>
                    <input className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                           type="date" value={editForm.expiry as string}
                           onChange={(e) => setEditForm(f => ({ ...f, expiry: e.target.value }))} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">残金額</div>
                    <div className="relative">
                      <input className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm pr-10 dark:border-gray-700 dark:bg-gray-800"
                             type="number" min={0} value={editForm.amount ?? ""}
                             onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value === "" ? undefined : Number(e.target.value) }))} />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">円</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">株数</div>
                    <input className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                           type="number" min={0} value={editForm.shares ?? ""}
                           onChange={(e) => setEditForm(f => ({ ...f, shares: e.target.value === "" ? undefined : Number(e.target.value) }))} />
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">メモ</div>
                    <textarea className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                              rows={2} value={editForm.note ?? ""}
                              onChange={(e) => setEditForm(f => ({ ...f, note: e.target.value || undefined }))} />
                  </div>
                  <div className="flex gap-2 md:col-span-2">
                    <button
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                      onClick={async () => {
                        const now = Date.now();
                        const updated: Holding = { ...(editForm as Holding), id: h.id, createdAt: h.createdAt, updatedAt: now };
                        await (await import("../lib/db")).putHolding(updated);
                        setHoldings(await listHoldings());
                        setEditingId(null);
                        setToast("更新しました");
                        setTimeout(() => setToast(null), 2000);
                      }}
                    >更新</button>
                    <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                            onClick={() => { setEditingId(null); setEditForm({}); }}>キャンセル</button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
