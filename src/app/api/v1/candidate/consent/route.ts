import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import {
  enableConsentCore,
  isConsentActive,
  revokeConsentCore,
} from "@/lib/candidate/profile-core";
import { consentRequestSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Turn employer sharing on or off. Exempt from the consent gate — this is how
 * a revoked candidate gets sharing back (owner decision §6). Enabling runs
 * `syncCandidateVisibility`, so employers whose grants just became effective
 * get their "new candidate" notification.
 */
export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
    skipGates: ["consent"],
  });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const { data, error: bodyError } = await readJson(
    request,
    consentRequestSchema
  );
  if (bodyError) return bodyError;

  if (data.action === "revoke") {
    const result = await revokeConsentCore(ctx.db, ctx.user.id);
    if (!result.ok) return notFound("Your profile is still being set up.");
  } else {
    const result = await enableConsentCore(ctx.db, ctx.user.id, {
      consentTextVersion: data.consentTextVersion,
      ip: ctx.meta.ip,
    });
    if (!result.ok) return notFound("Your profile is still being set up.");
    // Mirror the Web /consent screen so the NextAuth gate also clears.
    await ctx.db
      .update(users)
      .set({ privacyConsentedAt: new Date() })
      .where(eq(users.id, ctx.user.id));
  }

  return jsonOk({
    consentActive: await isConsentActive(ctx.db, ctx.profileId),
  });
}
