import { eq, asc } from "drizzle-orm";
import {
  candidateProfiles,
  candidateExperiences,
  candidateLinks,
} from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

export type CandidateProfile = typeof candidateProfiles.$inferSelect;
export type CandidateExperience = typeof candidateExperiences.$inferSelect;
export type CandidateLink = typeof candidateLinks.$inferSelect;

export interface FullCandidate {
  profile: CandidateProfile;
  experiences: CandidateExperience[];
  links: CandidateLink[];
}

/** Load a candidate profile (by user id) with experiences + links. */
export async function getCandidateByUserId(
  db: Database,
  userId: string
): Promise<FullCandidate | null> {
  const profile = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
    .get();
  if (!profile) return null;
  return loadChildren(db, profile);
}

/** Load a candidate profile (by profile id) with experiences + links. */
export async function getCandidateByProfileId(
  db: Database,
  profileId: string
): Promise<FullCandidate | null> {
  const profile = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId))
    .get();
  if (!profile) return null;
  return loadChildren(db, profile);
}

async function loadChildren(
  db: Database,
  profile: CandidateProfile
): Promise<FullCandidate> {
  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateProfileId, profile.id))
    .orderBy(asc(candidateExperiences.sortOrder))
    .all();
  const links = await db
    .select()
    .from(candidateLinks)
    .where(eq(candidateLinks.candidateProfileId, profile.id))
    .orderBy(asc(candidateLinks.sortOrder))
    .all();
  return { profile, experiences, links };
}

/** Completeness score (0-100) used to nudge candidates. */
export function computeCompleteness(c: FullCandidate): number {
  const checks: boolean[] = [
    !!c.profile.headline,
    !!c.profile.summary && c.profile.summary.length > 40,
    !!c.profile.locationCurrent,
    !!c.profile.yearsExperience,
    !!c.profile.workAuthStatus,
    !!c.profile.resumeKey,
    c.experiences.length > 0,
    c.links.length > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export const WORK_AUTH_LABELS: Record<string, string> = {
  us_citizen: "U.S. Citizen",
  green_card: "Green Card",
  h1b: "H-1B",
  tn: "TN",
  opt: "OPT",
  ca_pr: "Canada PR",
  ca_citizen: "Canadian Citizen",
  needs_sponsorship: "Needs Sponsorship",
  other: "Other",
};

export const ENGLISH_LABELS: Record<string, string> = {
  native: "Native",
  business: "Business",
  conversational: "Conversational",
  basic: "Basic",
};
