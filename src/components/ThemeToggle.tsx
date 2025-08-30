"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setMounted(true);
    const d = document.documentElement.classList.contains("dark");
    setDark(d);
  }, []);
  if (!mounted) return null;
  return (
    <button
      aria-label="テーマ切替"
      className="h-9 w-9 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      onClick={() => {
        const el = document.documentElement;
        const next = !el.classList.contains("dark");
        el.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
        setDark(next);
      }}
      title="テーマ切替"
    >
      {dark ? "🌙" : "☀️"}
    </button>
  );
}

