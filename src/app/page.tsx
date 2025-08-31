"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listHoldings } from "../lib/db";
import { Holding } from "../lib/types";
import { syncCatalog } from "../lib/catalogSync";
import Card, { CardBody } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Toast from "../components/ui/Toast";

export default function Page() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [toast, setToast] = useState<string | null>(null);

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
                <Badge color={(() => { const d = Math.max(0, daysUntil(h.expiry)); return d < 30 ? "red" : d < 90 ? "yellow" : "gray"; })()}>
                  残{Math.max(0, daysUntil(h.expiry))}日
                </Badge>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
