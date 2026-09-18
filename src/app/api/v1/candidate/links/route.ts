import { asc, eq } from "drizzle-orm";
import { candidateLinks } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { addLinkCore } from "@/lib/candidate/profile-core";
import { linkInputSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { badRequest, jsonOk, notFound } from "@/lib/api/v1/errors";
import { serializeLink } from "@/lib/api/v1/candidate-serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "candidate" });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const rows = await ctx.db
    .select()
    .from(candidateLinks)
    .where(eq(candidateLinks.candidateProfileId, ctx.profileId))
    .orderBy(asc(candidateLinks.sortOrder))
    .all();

  return jsonOk({ links: rows.map(serializeLink) });
}

export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(request, linkInputSchema);
  if (bodyError) return bodyError;

  const result = await addLinkCore(ctx.db, ctx.user.id, {
    kind: data.kind,
    url: data.url,
    label: data.label ?? null,
    sortOrder: data.sortOrder,
  });
  if (!result.ok || !result.id) return badRequest("That link could not be saved.");

  const row = await ctx.db
    .select()
    .from(candidateLinks)
    .where(eq(candidateLinks.id, result.id))
    .get();
  return jsonOk({ link: row ? serializeLink(row) : null }, 201);
}
