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
import { candidateFeedback, companies } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { emitEmployerViewed } from "@/lib/notify/visibility";

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

  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, grant.companyId))
    .get();

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
    actorUserId: session.user.viewAs?.adminId ?? session.user.id,
    actorRole: session.user.viewAs ? "admin_view_as" : "employer",
    companyId: session.user.companyId,
    candidateProfileId: id,
    action: "view_detail",
    accessGrantId: grant.id,
    ip: hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for"),
    userAgent: hdrs.get("user-agent"),
  });

  // Tell the candidate their profile was opened — once per company per day.
  // Admin view-as is excluded: it isn't a real employer looking.
  if (!session.user.viewAs) {
    await emitEmployerViewed(db, { profileId: id, companyId: grant.companyId });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="inline-flex text-sm font-medium text-muted transition hover:text-ink"
      >
        ← All introductions
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <CandidateView
          view={view}
          companyName={company?.name}
          resumeHref={
            grant.canDownloadResume
              ? `/portal/candidates/${id}/resume`
              : undefined
          }
        />
        <aside className="lg:sticky lg:top-6">
          <CandidateFeedbackForm
            candidateProfileId={id}
            candidateName={view.displayName ?? "this candidate"}
            initial={initialFeedback}
            action={saveCandidateFeedback}
            saved={fb === "saved" || fb === "interested"}
          />
        </aside>
      </div>
    </div>
  );
}
