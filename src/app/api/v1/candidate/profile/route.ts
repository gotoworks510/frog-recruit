import { eq } from "drizzle-orm";
import { candidateProfiles } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { updateProfileFields } from "@/lib/candidate/profile-core";
import { candidateProfileSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/** Read is allowed without consent — it's the candidate's own data (owner §6). */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "candidate" });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const p = await ctx.db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, ctx.profileId))
    .get();
  if (!p) return notFound("Your profile is still being set up.");

  return jsonOk(serialize(p));
}

/**
 * Full replace of the editable fields (matching the Web form).
 * Requires active consent — a revoked candidate gets 409 gate_required.
 */
export async function PATCH(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const { data, error: bodyError } = await readJson(
    request,
    candidateProfileSchema
  );
  if (bodyError) return bodyError;

  const result = await updateProfileFields(ctx.db, ctx.user.id, {
    displayName: data.displayName ?? null,
    headline: data.headline ?? null,
    summary: data.summary ?? null,
    locationCurrent: data.locationCurrent ?? null,
    locationPreference: data.locationPreference ?? null,
    yearsExperience: data.yearsExperience ?? null,
    workAuthStatus: data.workAuthStatus ?? null,
    visaNotes: data.visaNotes ?? null,
    availability: data.availability ?? null,
    englishLevel: data.englishLevel ?? null,
    desiredSalaryMin: data.desiredSalaryMin ?? null,
    desiredSalaryMax: data.desiredSalaryMax ?? null,
    salaryCurrency: data.salaryCurrency,
  });
  if (!result.ok) return notFound("Your profile is still being set up.");

  const p = await ctx.db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, ctx.profileId))
    .get();
  return jsonOk(p ? serialize(p) : {});
}

function serialize(p: typeof candidateProfiles.$inferSelect) {
  return {
    id: p.id,
    displayName: p.displayName,
    headline: p.headline,
    summary: p.summary,
    locationCurrent: p.locationCurrent,
    locationPreference: p.locationPreference,
    yearsExperience: p.yearsExperience,
    workAuthStatus: p.workAuthStatus,
    visaNotes: p.visaNotes,
    availability: p.availability,
    englishLevel: p.englishLevel,
    desiredSalaryMin: p.desiredSalaryMin,
    desiredSalaryMax: p.desiredSalaryMax,
    salaryCurrency: p.salaryCurrency,
    completeness: p.completeness,
    hasResume: !!p.resumeKey,
    resumeFileName: p.resumeFileName,
    resumeUploadedAt: p.resumeUploadedAt
      ? p.resumeUploadedAt.toISOString()
      : null,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
  };
}
