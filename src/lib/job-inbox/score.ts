import type { JobLeadSource } from "@/lib/db/schema/job-leads";

const NA_LOC =
  /\b(canada|canadian|vancouver|toronto|montreal|calgary|ottawa|remote\s*(canada|us|usa|united states)?|united states|usa|u\.s\.a?|san francisco|seattle|new york|austin|denver|pacific|pt\b|pst\b|pdt\b)\b/i;

const STACK =
  /\b(typescript|node\.?js|postgresql|postgres|dynamodb|aws\s*lambda|react|next\.?js)\b/i;

const CONTRACT_OR_FT =
  /\b(contract|contractor|full[- ]?time|permanent|eor)\b/i;

const EXCLUDE =
  /\b(citizenship required|us citizen only|no sponsorship|staffing agency only)\b/i;

export function detectSourceFromUrl(url: string): JobLeadSource {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("indeed.")) return "indeed";
    if (host.includes("glassdoor.")) return "glassdoor";
    return "other";
  } catch {
    return "other";
  }
}

/** Lightweight ranking for inbox sort — not a hiring decision. */
export function scoreJobLead(input: {
  title?: string | null;
  location?: string | null;
  description?: string | null;
  company?: string | null;
}): number {
  const blob = [input.title, input.location, input.description, input.company]
    .filter(Boolean)
    .join("\n");
  let score = 0;
  if (NA_LOC.test(blob)) score += 30;
  if (STACK.test(blob)) score += 25;
  if (CONTRACT_OR_FT.test(blob)) score += 10;
  if (EXCLUDE.test(blob)) score -= 40;
  if ((input.title ?? "").length > 8) score += 5;
  if ((input.description ?? "").length > 200) score += 5;
  return score;
}

export function slugifyCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "company";
}
