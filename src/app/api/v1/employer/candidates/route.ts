import { requireMobile } from "@/lib/api/v1/require-mobile";
import {
  bucketCounts,
  listEmployerCandidates,
  matchesBucket,
  sortByFrogScore,
} from "@/lib/employer/candidate-list";
import { employerCandidatesQuerySchema } from "@/lib/api/v1/contracts/employer";
import { readQuery } from "@/lib/api/v1/parse";
import { jsonOk } from "@/lib/api/v1/errors";
import { writeAudit } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

/**
 * Employer home / candidate list. Buckets (owner decision §3):
 *   action_needed = unrated by this user   in_progress = rated or in the pipeline
 *   new / interested / maybe / passed      = the Web list's segments
 */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "employer" });
  if (error) return error;

  const { data, error: queryError } = readQuery(
    request,
    employerCandidatesQuerySchema
  );
  if (queryError) return queryError;

  const all = await listEmployerCandidates(ctx.db, {
    employerUserId: ctx.user.id,
    companyId: ctx.user.companyId,
  });

  await writeAudit(ctx.db, {
    actorUserId: ctx.user.id,
    actorRole: "employer",
    companyId: ctx.user.companyId,
    action: "view_list",
    ip: ctx.meta.ip,
    userAgent: ctx.meta.userAgent,
  });

  const filtered = data.bucket
    ? all.filter((c) => matchesBucket(c, data.bucket!))
    : all;

  return jsonOk({
    bucket: data.bucket ?? null,
    counts: bucketCounts(all),
    candidates: sortByFrogScore(filtered),
  });
}
