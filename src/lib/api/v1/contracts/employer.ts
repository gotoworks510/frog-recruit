import { z } from "zod";

/** Home buckets (owner decision §3) plus the feedback segments (Fable §8.4). */
export const employerBucketSchema = z.enum([
  "action_needed",
  "in_progress",
  "new",
  "interested",
  "maybe",
  "passed",
]);
export type EmployerBucket = z.infer<typeof employerBucketSchema>;

export const employerCandidatesQuerySchema = z.object({
  bucket: employerBucketSchema.optional(),
});

export const myFeedbackSchema = z
  .object({
    interest: z.enum(["interested", "maybe", "not_interested"]),
    wantsInterview: z.boolean(),
    questionsMd: z.string().nullable(),
    declineReasons: z.array(z.string()),
    declineNote: z.string().nullable(),
    updatedAt: z.string().nullable(),
  })
  .nullable();

export const employerCandidateCardSchema = z.object({
  profileId: z.string(),
  displayName: z.string().nullable(),
  headline: z.string().nullable(),
  yearsExperience: z.number().int().nullable(),
  workAuthLabel: z.string().nullable(),
  locationPreference: z.string().nullable(),
  frogScore: z.number().nullable(),
  /** Plain-text excerpt of Frog's strengths write-up. */
  recommendationExcerpt: z.string().nullable(),
  /** Plain-text excerpt of Frog's considerations / things to confirm. */
  considerationsExcerpt: z.string().nullable(),
  /** The role Frog connected them to (grant job, else the company's open job). */
  targetRoleTitle: z.string().nullable(),
  targetRoleLocation: z.string().nullable(),
  introducedAt: z.string().nullable(),
  introductionStatus: z.string().nullable(),
  myFeedback: myFeedbackSchema,
  hasResume: z.boolean(),
  canDownloadResume: z.boolean(),
});
export type EmployerCandidateCard = z.infer<typeof employerCandidateCardSchema>;

export const employerCandidatesResponseSchema = z.object({
  bucket: employerBucketSchema.nullable(),
  counts: z.record(z.number().int()),
  candidates: z.array(employerCandidateCardSchema),
});

export const employerExperienceSchema = z.object({
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
});

export const employerCandidateDetailSchema = z.object({
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
  canDownloadResume: z.boolean(),
  experiences: z.array(employerExperienceSchema),
  links: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      url: z.string(),
      label: z.string().nullable(),
    })
  ),
  recommendation: z
    .object({
      frogScore: z.number().nullable(),
      strengthsMd: z.string().nullable(),
      considerationsMd: z.string().nullable(),
    })
    .nullable(),
  targetRoleTitle: z.string().nullable(),
  targetRoleLocation: z.string().nullable(),
  introductionStatus: z.string().nullable(),
  introducedAt: z.string().nullable(),
  myFeedback: myFeedbackSchema,
});

/**
 * Feedback upsert. `clientRequestId` is REQUIRED so offline retries are
 * side-effect free, and `baseUpdatedAt` guards against overwriting a newer
 * server state (owner decision §9).
 */
export const feedbackRequestSchema = z.object({
  interest: z.enum(["interested", "maybe", "not_interested"]),
  wantsInterview: z.boolean().optional(),
  questionsMd: z.string().max(4000).nullish(),
  declineReasons: z.array(z.string().max(40)).max(10).optional(),
  declineNote: z.string().max(2000).nullish(),
  clientRequestId: z.string().uuid(),
  baseUpdatedAt: z.string().datetime().nullish(),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export const feedbackResponseSchema = z.object({
  feedback: myFeedbackSchema,
  newlyInterested: z.boolean(),
  idempotentReplay: z.boolean(),
});

/** Read-only role listing for the employer (edits stay admin-only). */
export const employerJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  salaryCurrency: z.string(),
  status: z.enum(["open", "filled", "closed"]),
});
export type EmployerJob = z.infer<typeof employerJobSchema>;

export const employerCompanyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactName: z.string().nullable(),
  /** Company jobs Frog is working from. Read-only — changes go through Frog. */
  jobs: z.array(employerJobSchema).default([]),
  fees: z.object({
    entityName: z.string(),
    firstHireLabel: z.string(),
    subsequentHirePct: z.number(),
    contractorFeePeriodMonths: z.number(),
    tiers: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        rateLabel: z.string(),
        detail: z.string(),
      })
    ),
    calculationPoints: z.array(
      z.object({ title: z.string(), body: z.string() })
    ),
    scopePoints: z.array(z.string()),
  }),
});

/** Public — request employer app access (job URL + contact). */
export const employerAccessRequestSchema = z.object({
  jobUrl: z.string().url().max(2000),
  companyName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
});
export type EmployerAccessRequest = z.infer<typeof employerAccessRequestSchema>;
