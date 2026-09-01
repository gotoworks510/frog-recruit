/**
 * Shared constants/types for employer feedback on a candidate. No "use server"
 * here so both the client form and the server action can import it.
 */
export type InterestLevel = "interested" | "maybe" | "not_interested";

export interface InterestOption {
  value: InterestLevel;
  label: string;
  hint: string;
}

// Employer-facing (English).
export const INTEREST_OPTIONS: InterestOption[] = [
  { value: "interested", label: "Interested", hint: "Close to what we're looking for" },
  { value: "maybe", label: "Maybe", hint: "On the fence / need more info" },
  { value: "not_interested", label: "Not interested", hint: "Not a fit for us" },
];

export interface DeclineReason {
  value: string;
  label: string;
}

export const DECLINE_REASONS: DeclineReason[] = [
  { value: "experience", label: "Not enough experience" },
  { value: "skills", label: "Skill / tech mismatch" },
  { value: "domain", label: "Domain fit (e.g. identity / compliance)" },
  { value: "location_auth", label: "Location / work authorization" },
  { value: "compensation", label: "Compensation expectations" },
  { value: "seniority", label: "Seniority / level mismatch" },
  { value: "communication", label: "Communication / language" },
  { value: "other", label: "Other" },
];

// Admin-facing (Japanese).
export const INTEREST_LABELS_JA: Record<InterestLevel, string> = {
  interested: "興味あり",
  maybe: "検討中",
  not_interested: "興味なし",
};

export const DECLINE_REASON_LABELS_JA: Record<string, string> = {
  experience: "経験不足",
  skills: "スキル/技術の不一致",
  domain: "ドメイン適合（本人確認/コンプラ等）",
  location_auth: "勤務地/就労資格",
  compensation: "報酬期待値",
  seniority: "シニアリティ/レベル不一致",
  communication: "コミュニケーション/言語",
  other: "その他",
};

export interface CandidateFeedbackData {
  interest: InterestLevel;
  wantsInterview: boolean;
  questionsMd: string | null;
  declineReasons: string[];
  declineNote: string | null;
  updatedAt: Date | null;
}

/** Parse the JSON-encoded decline_reasons column into a string[] (safe). */
export function parseDeclineReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* ignore malformed JSON */
  }
  return [];
}
