/** Frog recommendation score (0–10). Employer-facing only — never show to candidates. */

export const FROG_SCORE_MAX = 10;

export function formatFrogScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} / ${FROG_SCORE_MAX}`;
}

/** Parse admin form input; returns null if empty/invalid. Clamps to 0–10. */
export function parseFrogScore(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  return Math.min(FROG_SCORE_MAX, Math.max(0, Math.round(n * 10) / 10));
}

export function frogScoreTone(
  score: number
): "high" | "mid" | "low" {
  if (score >= 8) return "high";
  if (score >= 6) return "mid";
  return "low";
}
