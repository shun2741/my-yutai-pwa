"use client";

import { useEffect, useMemo, useState } from "react";
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

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">株主優待管理（PWA）</h1>
      <Toast message={toast} onClose={() => setToast(null)} />
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="text-base font-medium">今月期限の優待</div>
            <Badge color={expiringThisMonth === 0 ? "gray" : expiringThisMonth < 3 ? "yellow" : "red"}>{expiringThisMonth}件</Badge>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
