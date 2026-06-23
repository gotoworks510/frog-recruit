import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireEmployerReady } from "@/lib/employer/guard";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { buildEmployerCandidateView } from "@/lib/employer/candidate-dto";
import { CandidateView } from "@/components/candidate/CandidateView";
import { writeAudit } from "@/lib/audit/log";

export default async function EmployerCandidateDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, db } = await requireEmployerReady();
  const { id } = await params;

  // Row-level authorization: full effective-access check.
  const grant = await getEffectiveGrant(db, session.user.id, id);
  if (!grant) notFound();

  // Show the recommendation targeted at the employer's own company (with the
  // grant's company as the authoritative source).
  const view = await buildEmployerCandidateView(db, id, {
    companyId: grant.companyId,
  });
  if (!view) notFound();

  const hdrs = await headers();
  await writeAudit(db, {
    actorUserId: session.user.id,
    actorRole: "employer",
    companyId: session.user.companyId,
    candidateProfileId: id,
    action: "view_detail",
    accessGrantId: grant.id,
    ip: hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for"),
    userAgent: hdrs.get("user-agent"),
  });

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-primary hover:underline">
        ← Back to candidates
      </Link>
      <CandidateView
        view={view}
        resumeHref={
          grant.canDownloadResume ? `/portal/candidates/${id}/resume` : undefined
        }
      />
    </div>
  );
}
