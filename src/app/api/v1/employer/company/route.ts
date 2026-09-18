import { desc, eq } from "drizzle-orm";
import { jobs } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { resolveEmployerCompany } from "@/lib/api/v1/serialize";
import { jsonOk, notFound } from "@/lib/api/v1/errors";
import {
  CONTRACTOR_FEE_PERIOD_MONTHS,
  FEE_CALCULATION_POINTS,
  FEE_ENTITY_NAME,
  FEE_SCOPE_POINTS,
  FEE_TIERS,
  FIRST_HIRE_FEE_LABEL,
  SUBSEQUENT_HIRE_FEE_PCT,
} from "@/lib/employer/fee-schedule";

export const dynamic = "force-dynamic";

const STATUS_RANK: Record<"open" | "filled" | "closed", number> = {
  open: 0,
  filled: 1,
  closed: 2,
};

/**
 * Company header + open/filled/closed roles (read-only) + referral fee card.
 * Job edits stay on the admin companies screen — employers confirm what's listed.
 */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "employer" });
  if (error) return error;

  const company = await resolveEmployerCompany(
    ctx.db,
    ctx.user.id,
    ctx.user.companyId
  );
  if (!company) return notFound("No company is linked to this account.");

  const jobRows = await ctx.db
    .select({
      id: jobs.id,
      title: jobs.title,
      location: jobs.location,
      description: jobs.description,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryCurrency: jobs.salaryCurrency,
      status: jobs.status,
    })
    .from(jobs)
    .where(eq(jobs.companyId, company.id))
    .orderBy(desc(jobs.createdAt))
    .all();

  const sorted = [...jobRows].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
  );

  return jsonOk({
    id: company.id,
    name: company.name,
    contactName: company.contactName,
    jobs: sorted.map((j) => ({
      id: j.id,
      title: j.title,
      location: j.location,
      description: j.description,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      salaryCurrency: j.salaryCurrency,
      status: j.status,
    })),
    fees: {
      entityName: FEE_ENTITY_NAME,
      firstHireLabel: FIRST_HIRE_FEE_LABEL,
      subsequentHirePct: SUBSEQUENT_HIRE_FEE_PCT,
      contractorFeePeriodMonths: CONTRACTOR_FEE_PERIOD_MONTHS,
      tiers: FEE_TIERS,
      calculationPoints: FEE_CALCULATION_POINTS,
      scopePoints: FEE_SCOPE_POINTS,
    },
  });
}