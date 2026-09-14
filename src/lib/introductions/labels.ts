import type { IntroStatus } from "@/lib/db/schema/introductions";

/** Candidate-facing English labels. */
export const INTRO_STATUS_LABELS: Record<IntroStatus, string> = {
  planned: "In preparation",
  shared: "Shared with company",
  interviewing: "Interviewing",
  offer: "Offer",
  hired: "Hired",
  declined: "Not moving forward",
  withdrawn: "Withdrawn",
};

/** Admin UI Japanese labels. */
export const INTRO_STATUS_LABELS_JA: Record<IntroStatus, string> = {
  planned: "準備中",
  shared: "企業に共有済",
  interviewing: "面接調整・選考中",
  offer: "オファー",
  hired: "採用",
  declined: "見送り",
  withdrawn: "取り下げ",
};
