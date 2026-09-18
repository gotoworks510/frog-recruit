import { eq } from "drizzle-orm";
import { companies, employerAccounts } from "@/lib/db/schema";
import { ENGLISH_LABELS, WORK_AUTH_LABELS } from "@/lib/candidate/profile";
import type { Database } from "@/lib/db/client";

/** Employer's company, resolved from the user row or employer_accounts. */
export async function resolveEmployerCompany(
  db: Database,
  employerUserId: string,
  companyIdOnUser: string | null
): Promise<{ id: string; name: string; contactName: string | null } | null> {
  let companyId = companyIdOnUser;
  let contactName: string | null = null;

  const acct = await db
    .select({
      companyId: employerAccounts.companyId,
      contactName: employerAccounts.contactName,
    })
    .from(employerAccounts)
    .where(eq(employerAccounts.userId, employerUserId))
    .get();
  if (acct) {
    companyId = companyId ?? acct.companyId;
    contactName = acct.contactName;
  }
  if (!companyId) return null;

  const company = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  if (!company) return null;
  return { id: company.id, name: company.name, contactName };
}

/** Markdown → single-line plain text excerpt (card / list summaries). */
export function excerpt(
  md: string | null | undefined,
  max = 140
): string | null {
  if (!md) return null;
  const plain = md
    .replace(/[#>*_`[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.length > max ? `${plain.slice(0, max).trim()}…` : plain;
}

export function workAuthLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return WORK_AUTH_LABELS[status] ?? status;
}

export function englishLabel(level: string | null | undefined): string | null {
  if (!level) return null;
  return ENGLISH_LABELS[level] ?? level;
}

/** Company blurb with URLs stripped (same treatment as the Web /me page). */
export function cleanCompanyBlurb(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;
  return (
    raw
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

export function companySiteUrl(
  domain: string | null | undefined
): string | null {
  if (!domain?.trim()) return null;
  const d = domain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return d ? `https://${d}` : null;
}
