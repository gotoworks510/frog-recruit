import {
  formatFrogScore,
  frogScoreTone,
  FROG_SCORE_MAX,
} from "@/lib/employer/frog-score";

type FrogScoreBadgeProps = {
  score: number;
  /** `sm` = list chips; `lg` = detail header */
  size?: "sm" | "lg";
  className?: string;
};

/**
 * Employer-only visual for Frog's fit score. Do not render on candidate UIs.
 */
export function FrogScoreBadge({
  score,
  size = "sm",
  className = "",
}: FrogScoreBadgeProps) {
  const tone = frogScoreTone(score);
  const label = formatFrogScore(score);

  if (size === "sm") {
    const toneCls =
      tone === "high"
        ? "bg-brand text-white"
        : tone === "mid"
          ? "bg-mint-deep text-frog-dark"
          : "bg-surface-2 text-muted";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${toneCls} ${className}`}
        title={`Frog recommendation score out of ${FROG_SCORE_MAX}`}
      >
        <span className="opacity-80">Frog</span>
        <span>{label}</span>
      </span>
    );
  }

  const toneCls =
    tone === "high"
      ? "bg-brand text-white"
      : tone === "mid"
        ? "bg-mint-deep text-frog-dark"
        : "bg-surface-2 text-muted";

  return (
    <div
      className={`inline-flex shrink-0 items-baseline gap-2 rounded-xl px-4 py-3 ${toneCls} ${className}`}
      title={`Frog recommendation score out of ${FROG_SCORE_MAX}`}
    >
      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-75">
        Frog score
      </span>
      <span className="font-heading text-2xl font-semibold leading-none">
        {label}
      </span>
    </div>
  );
}
