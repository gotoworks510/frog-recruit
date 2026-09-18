import { eq } from "drizzle-orm";
import { candidateProfiles } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { resolveEmployerCompany } from "@/lib/api/v1/serialize";
import { unreadCount } from "@/lib/notify/deliver";
import { jsonOk } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/** Session + gate state. Readable even when a gate is unmet (§6.1). */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, {});
  if (error) return error;

  const company =
    ctx.user.role === "employer"
      ? await resolveEmployerCompany(ctx.db, ctx.user.id, ctx.user.companyId)
      : null;

  const profile = ctx.profileId
    ? await ctx.db
        .select({
          id: candidateProfiles.id,
          displayName: candidateProfiles.displayName,
          completeness: candidateProfiles.completeness,
        })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.id, ctx.profileId))
        .get()
    : null;

  return jsonOk({
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      company: company ? { id: company.id, name: company.name } : null,
    },
    gates: ctx.gates,
    unreadNotifications: await unreadCount(ctx.db, ctx.user.id),
    profile: profile ?? null,
  });
}
