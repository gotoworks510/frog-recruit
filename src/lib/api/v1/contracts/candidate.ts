import { z } from "zod";

const WORK_AUTH_VALUES = [
  "us_citizen",
  "green_card",
  "h1b",
  "tn",
  "opt",
  "ca_pr",
  "ca_citizen",
  "iec",
  "needs_sponsorship",
  "other",
] as const;

const ENGLISH_VALUES = ["native", "business", "conversational", "basic"] as const;

const EMPLOYMENT_TYPES = [
  "full_time",
  "contract",
  "freelance",
  "internship",
] as const;

const LINK_KINDS = [
  "linkedin",
  "github",
  "portfolio",
  "website",
  "other",
] as const;

/** Same field set and validation as the Web `updateProfile` action. */
export const candidateProfileSchema = z.object({
  displayName: z.string().max(120).nullish(),
  headline: z.string().max(200).nullish(),
  summary: z.string().max(8000).nullish(),
  locationCurrent: z.string().max(160).nullish(),
  locationPreference: z.string().max(160).nullish(),
  yearsExperience: z.number().int().min(0).max(80).nullish(),
  workAuthStatus: z.enum(WORK_AUTH_VALUES).nullish(),
  visaNotes: z.string().max(2000).nullish(),
  availability: z.string().max(200).nullish(),
  englishLevel: z.enum(ENGLISH_VALUES).nullish(),
  desiredSalaryMin: z.number().int().min(0).max(100_000_000).nullish(),
  desiredSalaryMax: z.number().int().min(0).max(100_000_000).nullish(),
  salaryCurrency: z.string().min(3).max(3).default("USD"),
});
export type CandidateProfileInput = z.infer<typeof candidateProfileSchema>;

export const candidateProfileResponseSchema = candidateProfileSchema.extend({
  id: z.string(),
  completeness: z.number().int(),
  hasResume: z.boolean(),
  resumeFileName: z.string().nullable(),
  resumeUploadedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const experienceInputSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullish(),
  startDate: z.string().datetime().nullish(),
  endDate: z.string().datetime().nullish(),
  isCurrent: z.boolean().default(false),
  location: z.string().max(160).nullish(),
  description: z.string().max(8000).nullish(),
  techStack: z.string().max(2000).nullish(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const experiencePatchSchema = experienceInputSchema.partial();

export const experienceResponseSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  employmentType: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  techStack: z.string().nullable(),
  sortOrder: z.number().int(),
});

export const linkInputSchema = z.object({
  kind: z.enum(LINK_KINDS).default("other"),
  url: z.string().url().max(500),
  label: z.string().max(120).nullish(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const linkResponseSchema = z.object({
  id: z.string(),
  kind: z.string(),
  url: z.string(),
  label: z.string().nullable(),
  sortOrder: z.number().int(),
});

export const candidateHomeSchema = z.object({
  profile: z.object({
    displayName: z.string().nullable(),
    headline: z.string().nullable(),
    completeness: z.number().int(),
    hasResume: z.boolean(),
  }),
  /** False → the app must show the "hidden from all employers" banner. */
  consentActive: z.boolean(),
  introductions: z.array(
    z.object({
      id: z.string(),
      company: z.object({
        id: z.string(),
        name: z.string(),
        blurb: z.string().nullable(),
        websiteUrl: z.string().nullable(),
      }),
      status: z.string(),
      statusLabel: z.string(),
      /** Candidate-safe note. `noteInternal` is NEVER returned. */
      statusNote: z.string().nullable(),
      jobs: z.array(
        z.object({ title: z.string(), location: z.string().nullable() })
      ),
      candidateResponse: z.enum(["interested", "consult", "pass"]).nullable(),
      candidateRespondedAt: z.string().nullable(),
      updatedAt: z.string().nullable(),
    })
  ),
});

export const consentRequestSchema = z.object({
  action: z.enum(["enable", "revoke"]),
  consentTextVersion: z.string().max(40).optional(),
});

/**
 * Candidate reaction to an introduction card. Owner decision §2 —
 * `interested | consult | pass` (NOT `talk_to_frog`).
 */
export const introductionResponseSchema = z.object({
  response: z.enum(["interested", "consult", "pass"]),
  clientRequestId: z.string().uuid(),
  baseUpdatedAt: z.string().datetime().nullish(),
});

export const linkedInRefreshSchema = z.object({
  url: z.string().min(4).max(500),
});

export const deletionRequestSchema = z.object({
  reason: z.string().max(1000).nullish(),
});

/** Candidate's own preview — the employer view minus the recommendation. */
export const candidatePreviewSchema = z.object({
  profileId: z.string(),
  displayName: z.string().nullable(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  locationCurrent: z.string().nullable(),
  locationPreference: z.string().nullable(),
  yearsExperience: z.number().int().nullable(),
  workAuthStatus: z.string().nullable(),
  workAuthLabel: z.string().nullable(),
  visaNotes: z.string().nullable(),
  availability: z.string().nullable(),
  englishLevel: z.string().nullable(),
  englishLabel: z.string().nullable(),
  desiredSalaryMin: z.number().int().nullable(),
  desiredSalaryMax: z.number().int().nullable(),
  salaryCurrency: z.string(),
  hasResume: z.boolean(),
  experiences: z.array(experienceResponseSchema.omit({ sortOrder: true })),
  links: z.array(linkResponseSchema.omit({ sortOrder: true })),
});

/** Normalize full URL or bare LinkedIn slug → canonical /in/ URL. */
function normalizeLinkedInUrl(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  const looksLikeUrl =
    /^https?:\/\//i.test(input) || /linkedin\.com/i.test(input);
  if (looksLikeUrl) {
    try {
      const withProto = /^https?:\/\//i.test(input)
        ? input
        : `https://${input.replace(/^\/+/, "")}`;
      const u = new URL(withProto);
      if (/(^|\.)linkedin\.com$/i.test(u.hostname)) {
        const m = u.pathname.match(/\/in\/([^/?#]+)/i);
        if (m?.[1]) {
          return `https://www.linkedin.com/in/${decodeURIComponent(m[1])}/`;
        }
      }
    } catch {
      /* fall through */
    }
  }
  const slug = input
    .replace(/^\/+/, "")
    .replace(/^in\//i, "")
    .replace(/\/+$/, "")
    .split(/[?#]/)[0]
    .trim();
  if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,98}[a-zA-Z0-9])?$/.test(slug)) {
    return `https://www.linkedin.com/in/${slug}/`;
  }
  return null;
}

/** Public — request a Frog-issued candidate account (contact; LinkedIn optional). */
export const candidateAccessRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  /**
   * Optional. Full URL or profile slug (`alex-rivera`);
   * empty/omitted → null; invalid non-empty → error.
   */
  linkedinUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v, ctx) => {
      const s = (v ?? "").trim();
      if (!s) return null;
      const normalized = normalizeLinkedInUrl(s);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use your LinkedIn profile URL or username.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});
export type CandidateAccessRequest = z.infer<typeof candidateAccessRequestSchema>;
