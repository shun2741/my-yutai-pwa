import React from "react";

export default function Badge({ color = "gray", children }: { color?: "red" | "yellow" | "gray"; children: React.ReactNode }) {
  const styles = {
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  }[color];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

