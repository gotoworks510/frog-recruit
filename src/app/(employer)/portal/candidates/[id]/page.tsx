import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { requireEmployerReady } from "@/lib/employer/guard";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { buildEmployerCandidateView } from "@/lib/employer/candidate-dto";
import { CandidateView } from "@/components/candidate/CandidateView";
import { CandidateFeedbackForm } from "@/components/employer/CandidateFeedbackForm";
import { saveCandidateFeedback } from "@/lib/employer/feedback-actions";
import { parseDeclineReasons, type CandidateFeedbackData } from "@/lib/employer/feedback";
import { candidateFeedback } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";

export default async function EmployerCandidateDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fb?: string }>;
}) {
  const { session, db } = await requireEmployerReady();
  const { id } = await params;
  const { fb } = await searchParams;

  // Row-level authorization: full effective-access check.
  const grant = await getEffectiveGrant(db, session.user.id, id);
  if (!grant) notFound();

  // Show the recommendation targeted at the employer's own company (with the
  // grant's company as the authoritative source).
  const view = await buildEmployerCandidateView(db, id, {
    companyId: grant.companyId,
  });
  if (!view) notFound();

  // This employer's existing feedback (if any) for the widget.
  const fbRow = await db
    .select()
    .from(candidateFeedback)
    .where(
      and(
        eq(candidateFeedback.employerUserId, session.user.id),
        eq(candidateFeedback.candidateProfileId, id)
      )
    )
    .get();
  const initialFeedback: CandidateFeedbackData | null = fbRow
    ? {
        interest: fbRow.interest,
        wantsInterview: fbRow.wantsInterview,
        questionsMd: fbRow.questionsMd,
        declineReasons: parseDeclineReasons(fbRow.declineReasons),
        declineNote: fbRow.declineNote,
        updatedAt: fbRow.updatedAt,
      }
    : null;

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
      <CandidateFeedbackForm
        candidateProfileId={id}
        candidateName={view.displayName ?? "this candidate"}
        initial={initialFeedback}
        action={saveCandidateFeedback}
        saved={fb === "saved"}
      />
      <CandidateView
        view={view}
        resumeHref={
          grant.canDownloadResume ? `/portal/candidates/${id}/resume` : undefined
        }
      />
    </div>
  );
}
