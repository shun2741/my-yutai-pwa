"use client";
import React, { useEffect } from "react";

export default function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="fixed right-4 top-4 z-50 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-black/80">
      {message}
    </div>
  );
}

