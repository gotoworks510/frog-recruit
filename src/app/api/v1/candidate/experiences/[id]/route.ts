import { eq } from "drizzle-orm";
import { candidateExperiences } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import {
  deleteExperienceCore,
  updateExperienceCore,
} from "@/lib/candidate/profile-core";
import { experiencePatchSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk, notFound } from "@/lib/api/v1/errors";
import { serializeExperience } from "@/lib/api/v1/candidate-serialize";

export const dynamic = "force-dynamic";

/** Ownership is enforced inside the core (row must belong to this profile). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  const { id } = await params;
  const { data, error: bodyError } = await readJson(
    request,
    experiencePatchSchema
  );
  if (bodyError) return bodyError;

  const result = await updateExperienceCore(ctx.db, ctx.user.id, id, {
    ...(data.company !== undefined ? { company: data.company } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.employmentType !== undefined
      ? { employmentType: data.employmentType ?? null }
      : {}),
    ...(data.startDate !== undefined
      ? { startDate: data.startDate ? new Date(data.startDate) : null }
      : {}),
    ...(data.endDate !== undefined
      ? { endDate: data.endDate ? new Date(data.endDate) : null }
      : {}),
    ...(data.isCurrent !== undefined ? { isCurrent: data.isCurrent } : {}),
    ...(data.location !== undefined ? { location: data.location ?? null } : {}),
    ...(data.description !== undefined
      ? { description: data.description ?? null }
      : {}),
    ...(data.techStack !== undefined
      ? { techStack: data.techStack ?? null }
      : {}),
    ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
  });
  if (!result.ok) return notFound("That experience entry was not found.");

  const row = await ctx.db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.id, id))
    .get();
  return jsonOk({ experience: row ? serializeExperience(row) : null });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  const { id } = await params;
  const result = await deleteExperienceCore(ctx.db, ctx.user.id, id);
  if (!result.ok) return notFound("That experience entry was not found.");
  return jsonOk({ ok: true });
}
