/** Format a Date as yyyy-mm-dd for <input type="date"> values. */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human-readable year-month range, e.g. "2024.08 – Present". */
export function formatRange(
  start: Date | null | undefined,
  end: Date | null | undefined,
  isCurrent: boolean
): string {
  const fmt = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const from = start ? fmt(start) : "";
  const to = isCurrent ? "Present" : end ? fmt(end) : "";
  if (!from && !to) return "";
  return `${from} – ${to}`;
}

/** Short date, e.g. "2026/06/22 14:03". */
export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
