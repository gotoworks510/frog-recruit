import type { JobLeadSource } from "@/lib/db/schema/job-leads";

/**
 * Canonicalize job URLs so search-results and trailing-slash variants merge.
 */
export function normalizeJobSourceUrl(url: string, source?: JobLeadSource | string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return url.trim();
  }

  const host = u.hostname.toLowerCase();
  if (host.includes("linkedin.com")) {
    const fromPath = u.pathname.match(/\/jobs\/view\/(\d+)/);
    const fromQuery = u.searchParams.get("currentJobId");
    const jobId = fromPath?.[1] || fromQuery;
    if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}`;
  }

  u.hash = "";
  // Drop tracking noise for indeed-ish URLs later if needed.
  return u.toString().replace(/\/$/, "") || u.toString();
}

/** Parse "Role | Company | LinkedIn" (and similar) browser titles. */
export function parseLinkedInDocumentTitle(docTitle: string | null | undefined): {
  title: string | null;
  companyName: string | null;
} {
  if (!docTitle?.trim()) return { title: null, companyName: null };
  const cleaned = docTitle.replace(/\s+/g, " ").trim();
  if (/^linkedin$/i.test(cleaned)) return { title: null, companyName: null };

  const parts = cleaned.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && /^linkedin$/i.test(parts[parts.length - 1] || "")) {
    const title = parts[0] || null;
    const companyName =
      parts[1] && !/^linkedin$/i.test(parts[1]) ? parts[1] : null;
    return { title, companyName };
  }
  // Not the LinkedIn pattern — still usable as a title fallback.
  return { title: cleaned, companyName: null };
}

/**
 * Fill missing capture fields from extension raw.titleDocument / page hints.
 */
export function enrichCaptureFromRaw(
  incoming: {
    titleRaw: string | null;
    companyNameRaw: string | null;
    locationRaw: string | null;
    descriptionRaw: string | null;
  },
  raw: unknown
): typeof incoming {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const docTitle =
    typeof r?.titleDocument === "string" ? r.titleDocument : null;
  const parsed = parseLinkedInDocumentTitle(docTitle);

  return {
    titleRaw: incoming.titleRaw || parsed.title,
    companyNameRaw: incoming.companyNameRaw || parsed.companyName,
    locationRaw: incoming.locationRaw,
    descriptionRaw: incoming.descriptionRaw,
  };
}
