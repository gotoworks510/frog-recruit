import { and, desc, eq, inArray } from "drizzle-orm";
import {
  candidateIntroductions,
  candidateProfiles,
  companies,
  jobs,
} from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { cleanCompanyBlurb, companySiteUrl } from "@/lib/api/v1/serialize";
import { INTRO_STATUS_LABELS } from "@/lib/introductions/labels";
import type { IntroStatus } from "@/lib/db/schema/introductions";
import { jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Candidate home. Works WITHOUT consent (owner decision §6) — the app shows a
 * "hidden from all employers" banner when `consentActive` is false.
 * `noteInternal` is never included.
 */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "candidate" });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const profile = await ctx.db
    .select({
      displayName: candidateProfiles.displayName,
      headline: candidateProfiles.headline,
      completeness: candidateProfiles.completeness,
      resumeKey: candidateProfiles.resumeKey,
    })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, ctx.profileId))
    .get();

  const intros = await ctx.db
    .select({
      id: candidateIntroductions.id,
      status: candidateIntroductions.status,
      statusNote: candidateIntroductions.statusNote,
      candidateResponse: candidateIntroductions.candidateResponse,
      candidateRespondedAt: candidateIntroductions.candidateRespondedAt,
      updatedAt: candidateIntroductions.updatedAt,
      companyId: companies.id,
      companyName: companies.name,
      companyDomain: companies.domain,
      companyDescription: companies.description,
    })
    .from(candidateIntroductions)
    .innerJoin(companies, eq(candidateIntroductions.companyId, companies.id))
    .where(eq(candidateIntroductions.candidateProfileId, ctx.profileId))
    .orderBy(desc(candidateIntroductions.updatedAt))
    .all();

  const companyIds = [...new Set(intros.map((i) => i.companyId))];
  const openJobs =
    companyIds.length === 0
      ? []
      : await ctx.db
          .select({
            companyId: jobs.companyId,
            title: jobs.title,
            location: jobs.location,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "open"), inArray(jobs.companyId, companyIds)))
          .all();

  return jsonOk({
    profile: {
      displayName: profile?.displayName ?? null,
      headline: profile?.headline ?? null,
      completeness: profile?.completeness ?? 0,
      hasResume: !!profile?.resumeKey,
    },
    consentActive: ctx.gates.consentActive,
    introductions: intros.map((i) => ({
      id: i.id,
      company: {
        id: i.companyId,
        name: i.companyName,
        blurb: cleanCompanyBlurb(i.companyDescription),
        websiteUrl: companySiteUrl(i.companyDomain),
      },
      status: i.status,
      statusLabel:
        INTRO_STATUS_LABELS[i.status as IntroStatus] ?? i.status,
      statusNote: i.statusNote,
      jobs: openJobs
        .filter((j) => j.companyId === i.companyId)
        .map((j) => ({ title: j.title, location: j.location })),
      candidateResponse: i.candidateResponse,
      candidateRespondedAt: i.candidateRespondedAt
        ? i.candidateRespondedAt.toISOString()
        : null,
      updatedAt: i.updatedAt ? i.updatedAt.toISOString() : null,
    })),
  });
}
