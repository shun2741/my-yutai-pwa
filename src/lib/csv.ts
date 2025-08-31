export function toCsv<T extends Record<string, any>>(headers: string[], rows: T[]): string {
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    if (s.includes("\"")) return '"' + s.replace(/\"/g, '""') + '"';
    if (s.includes(",") || s.includes("\n")) return '"' + s + '"';
    return s;
  };
  const headerLine = headers.join(",");
  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return headerLine + "\n" + lines.join("\n") + (lines.length ? "\n" : "");
}

