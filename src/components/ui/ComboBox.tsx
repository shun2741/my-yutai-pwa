"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Option = { label: string; value: string };
type Props = {
  options: Option[];
  valueLabel: string;
  placeholder?: string;
  onChange: (label: string) => void;
};

export default function ComboBox({ options, valueLabel, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(valueLabel || "");
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(valueLabel || ""), [valueLabel]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options.slice(0, 8);
    const lower = q.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower)).slice(0, 8);
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <input
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) setOpen(true);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (filtered[hi]) {
              onChange(filtered[hi].label);
              setQuery(filtered[hi].label);
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">候補がありません</div>
          )}
          {filtered.map((o, idx) => (
            <button
              type="button"
              key={o.value}
              className={`block w-full cursor-pointer px-3 py-2 text-left text-sm ${idx === hi ? "bg-gray-100 dark:bg-gray-800" : ""}`}
              onMouseEnter={() => setHi(idx)}
              onClick={() => {
                onChange(o.label);
                setQuery(o.label);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

