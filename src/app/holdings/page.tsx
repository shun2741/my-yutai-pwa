"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteHolding, getCatalog, listHoldings, putHolding } from "../../lib/db";
import { Holding, VoucherType } from "../../lib/types";
import Card, { CardBody, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Input, Label, Select, Textarea } from "../../components/ui/Input";
import ComboBox from "../../components/ui/ComboBox";
import Segmented from "../../components/ui/Segmented";
import Toast from "../../components/ui/Toast";

function uuid() {
  // 簡易UUID（ランタイム依存を避ける）
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const VOUCHER_TYPES: VoucherType[] = ["食事", "買い物", "レジャー", "その他"];

type FormState = {
  id?: string;
  companyId: string; // 自動補完（編集不可）
  companyName: string; // 入力→ID自動補完
  voucherType: VoucherType;
  expiry: string;
  amount?: number;
  count?: number;
  shares?: number;
  note?: string;
};

export default function HoldingsPage() {
  const [items, setItems] = useState<Holding[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ companyId: "", companyName: "", voucherType: "食事", expiry: "" });
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [nameToCode, setNameToCode] = useState<Record<string, string>>({});
  const [nameToVoucher, setNameToVoucher] = useState<Record<string, VoucherType | undefined>>({});
  const [nameToUrl, setNameToUrl] = useState<Record<string, string>>({});
  const [codeToUrl, setCodeToUrl] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => a.expiry.localeCompare(b.expiry));
  }, [items]);

  useEffect(() => {
    (async () => {
      const list = await listHoldings();
      setItems(list);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const c = await getCatalog();
      if (c?.companies) {
        setCompanyNames(c.companies.map((x) => x.name));
        const map: Record<string, string> = {};
        const vmap: Record<string, VoucherType | undefined> = {};
        const n2u: Record<string, string> = {};
        const c2u: Record<string, string> = {};
        for (const comp of c.companies) map[comp.name] = comp.ticker || "";
        // 会社に紐づく券種（先頭を代表値として採用）
        const KNOWN: VoucherType[] = ["食事", "買い物", "レジャー", "その他"];
        for (const comp of c.companies) {
          const first = (comp.voucherTypes || []).find((t) => KNOWN.includes(t as VoucherType)) as VoucherType | undefined;
          if (first) vmap[comp.name] = first;
          if (comp.url) n2u[comp.name] = comp.url;
          if (comp.ticker && comp.url) c2u[comp.ticker] = comp.url;
        }
        setNameToCode(map);
        setNameToVoucher(vmap);
        setNameToUrl(n2u);
        setCodeToUrl(c2u);
      }
    })();
  }, []);

  function daysUntil(dateStr: string): number {
    const today = new Date();
    const target = new Date(dateStr + "T00:00:00");
    const diff = Math.ceil((target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
    return diff;
  }

  function bgColor(expiry: string) {
    const d = daysUntil(expiry);
    if (d < 30) return "#ffe5e5";
    if (d < 90) return "#fff8e1";
    return "#fff";
  }

  function iconOf(v: VoucherType) {
    switch (v) {
      case "食事":
        return "🍽️";
      case "買い物":
        return "🛍️";
      case "レジャー":
        return "🎟️";
      default:
        return "🧾";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const resolvedId = nameToCode[form.companyName];
    if (!form.companyName) newErrors.companyName = "会社名は必須です";
    // 証券コードは未設定でも可（カタログ上コードがない会社も許容）
    if (!form.expiry) newErrors.expiry = "期限は必須です";
    if (form.amount != null && form.amount < 0) newErrors.amount = "0以上を入力してください";
    if (form.shares != null && form.shares < 0) newErrors.shares = "0以上を入力してください";
    if (form.count != null && form.count < 0) newErrors.count = "0以上を入力してください";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    const now = Date.now();
    const h: Holding = {
      id: form.id || uuid(),
      companyId: resolvedId,
      companyName: form.companyName,
      voucherType: form.voucherType,
      expiry: form.expiry,
      amount: form.amount ? Number(form.amount) : undefined,
      count: form.count ? Number(form.count) : undefined,
      shares: form.shares ? Number(form.shares) : undefined,
      note: form.note || undefined,
      createdAt: form.id ? items.find(i => i.id === form.id)?.createdAt || now : now,
      updatedAt: now,
    };
    try {
      await putHolding(h);
      const list = await listHoldings();
      setItems(list);
      setEditingId(null);
      setForm({ companyId: "", companyName: "", voucherType: "食事", expiry: "" });
      setErrors({});
      setToast("保存しました");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) {
      setToast("保存に失敗しました");
    }
  }

  function startEdit(h: Holding) {
    setEditingId(h.id);
    setForm({
      id: h.id,
      companyId: h.companyId,
      companyName: h.companyName,
      voucherType: h.voucherType,
      expiry: h.expiry,
      amount: h.amount,
      shares: h.shares,
      note: h.note,
    });
  }

  async function remove(id: string) {
    if (!confirm("削除しますか？")) return;
    await deleteHolding(id);
    setItems(await listHoldings());
  }

  return (
    <div className="space-y-4">
      <Toast message={toast} onClose={() => setToast(null)} />
      <h1 className="text-2xl font-bold">優待券</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">カタログにある企業から選択して登録してください。</p>

      <Card>
        <CardHeader title={editingId ? "編集" : "新規登録"} subtitle="必要な項目を入力して保存してください" />
        <CardBody className="space-y-4">
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>会社名（検索して選択）</Label>
              <ComboBox
                options={companyNames.map((n) => ({ label: n, value: n }))}
                valueLabel={form.companyName}
                placeholder="例: デモフーズ"
                onChange={(label) => {
                  const vt = nameToVoucher[label] || form.voucherType;
                  setForm((f) => ({ ...f, companyName: label, companyId: nameToCode[label] || "", voucherType: vt }));
                  setErrors((e) => ({ ...e, companyName: "" }));
                }}
              />
              {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">カタログに存在する会社名のみ選択できます。証券コードは自動設定、券種は会社のカタログから自動設定されます（未定義なら変更可）。</p>
            </div>
            <div>
              <Label>証券コード（自動）</Label>
              <Input value={form.companyId} readOnly placeholder="会社名から自動設定（未設定でも可）" aria-readonly="true" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>券種（会社から自動設定。必要なら変更可）</Label>
              <Segmented
                options={VOUCHER_TYPES.map((v) => ({ label: iconOf(v) + " " + v, value: v }))}
                value={form.voucherType}
                onChange={(v) => setForm({ ...form, voucherType: v })}
              />
            </div>
            <div>
              <Label>期限（年月を選択 → 月末に設定）</Label>
              <div className="flex items-center gap-2">
                <Input type="month" value={form.expiry ? form.expiry.slice(0,7) : ""}
                       onChange={(e) => {
                         const ym = e.target.value; // YYYY-MM
                         if (!ym) { setForm({ ...form, expiry: "" }); return; }
                         const [y,m] = ym.split('-').map(Number);
                         const last = new Date(y, m, 0);
                         const v = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
                         setForm({ ...form, expiry: v });
                         setErrors((er) => ({ ...er, expiry: "" }));
                       }} />
                <button type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                        onClick={() => {
                          const d = new Date();
                          const last = new Date(d.getFullYear(), d.getMonth() + 6 + 1, 0); // +6ヶ月の月末
                          setForm(f => ({ ...f, expiry: `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}` }));
                        }}>＋6ヶ月末</button>
                <button type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                        onClick={() => {
                          const d = new Date();
                          const last = new Date(d.getFullYear(), d.getMonth() + 12 + 1, 0); // +12ヶ月の月末
                          setForm(f => ({ ...f, expiry: `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}` }));
                        }}>＋12ヶ月末</button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">選択した年月の月末日に自動設定されます。必要なら後から日付調整してください。</p>
              {errors.expiry && <p className="mt-1 text-xs text-red-600">{errors.expiry}</p>}
            </div>
            <div>
              <Label>残金額</Label>
              <div className="relative">
                <Input aria-invalid={!!errors.amount} type="number" min={0} value={form.amount ?? ""} onChange={(e) => { setForm({ ...form, amount: e.target.value === "" ? undefined : Number(e.target.value) }); setErrors((er) => ({ ...er, amount: "" })); }} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">円</span>
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
            </div>
            <div>
              <Label>券数</Label>
              <Input type="number" min={0} value={form.count ?? ""} onChange={(e) => setForm({ ...form, count: e.target.value === "" ? undefined : Number(e.target.value) })} />
              {errors.count && <p className="mt-1 text-xs text-red-600">{errors.count}</p>}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">金額の代わりに枚数で管理したい場合に入力（併用可）。</p>
            </div>
            <div>
              <Label>株数</Label>
              <Input aria-invalid={!!errors.shares} type="number" min={0} value={form.shares ?? ""} onChange={(e) => { setForm({ ...form, shares: e.target.value === "" ? undefined : Number(e.target.value) }); setErrors((er) => ({ ...er, shares: "" })); }} />
              {errors.shares && <p className="mt-1 text-xs text-red-600">{errors.shares}</p>}
            </div>
            <div className="md:col-span-2">
              <Label>メモ</Label>
              <Textarea value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value || undefined })} />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit">{editingId ? "更新" : "追加"}</Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ companyId: "", companyName: "", voucherType: "食事", expiry: "" }); }}>キャンセル</Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-3">
        {sorted.map((h) => (
          <Card key={h.id} className={bgColor(h.expiry) === "#ffe5e5" ? "ring-1 ring-red-200" : bgColor(h.expiry) === "#fff8e1" ? "ring-1 ring-yellow-200" : ""}>
            <CardBody>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold">{h.companyName} <span className="text-sm font-normal text-gray-500">（{h.voucherType}）</span></div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">期限: {h.expiry} {h.amount != null ? ` / 残額: ${h.amount}円` : h.count != null ? ` / 券数: ${h.count}枚` : ""}</div>
                  {(() => {
                    const url = nameToUrl[h.companyName] || (h.companyId ? codeToUrl[h.companyId] : "");
                    if (url) return <a className="text-xs text-blue-600 hover:underline" href={url} target="_blank" rel="noreferrer">公式サイト</a>;
                    return null;
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={(() => { const d = Math.max(0, daysUntil(h.expiry)); return d < 30 ? "red" : d < 90 ? "yellow" : "gray"; })()}>
                    残{Math.max(0, daysUntil(h.expiry))}日
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => startEdit(h)}>編集</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(h.id)}>削除</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
