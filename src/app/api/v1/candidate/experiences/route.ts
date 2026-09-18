import { asc, eq } from "drizzle-orm";
import { candidateExperiences } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { addExperienceCore } from "@/lib/candidate/profile-core";
import { experienceInputSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { badRequest, jsonOk, notFound } from "@/lib/api/v1/errors";
import { serializeExperience } from "@/lib/api/v1/candidate-serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "candidate" });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const rows = await ctx.db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateProfileId, ctx.profileId))
    .orderBy(asc(candidateExperiences.sortOrder))
    .all();

  return jsonOk({ experiences: rows.map(serializeExperience) });
}

export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    experienceInputSchema
  );
  if (bodyError) return bodyError;

  const result = await addExperienceCore(ctx.db, ctx.user.id, {
    company: data.company,
    title: data.title,
    employmentType: data.employmentType ?? null,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    isCurrent: data.isCurrent,
    location: data.location ?? null,
    description: data.description ?? null,
    techStack: data.techStack ?? null,
    sortOrder: data.sortOrder,
  });
  if (!result.ok || !result.id) {
    return badRequest("That experience entry could not be saved.");
  }

  const row = await ctx.db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.id, result.id))
    .get();
  return jsonOk({ experience: row ? serializeExperience(row) : null }, 201);
}
