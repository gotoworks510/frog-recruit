/** Candidate-facing copy when Frog turns on a closed-role notice. English only. */

export type RoleNotice = {
  tone: "closed" | "hired";
  title: string;
  location: string | null;
  message: string;
};

export function closedRoleMessage(companyName: string, roleTitle: string): string {
  return `Thank you for your interest in ${roleTitle} at ${companyName}. This role has closed. If another opportunity comes up, we hope to be in touch again.`;
}

export function hiredRoleMessage(companyName: string, roleTitle: string): string {
  return `Congratulations. You were selected for ${roleTitle} at ${companyName}. Thank you for going through this with Frog.`;
}

/**
 * One notice per role that has the candidate close-notice switched on.
 * Hired introductions get congratulations. Everyone else gets the closing note.
 */
export function roleNoticesForIntro(params: {
  introStatus: string;
  companyName: string;
  jobs: {
    title: string;
    location: string | null;
    closeNotice: boolean;
  }[];
}): RoleNotice[] {
  const hired = params.introStatus === "hired";
  return params.jobs
    .filter((job) => job.closeNotice)
    .map((job) => ({
      tone: hired ? "hired" : "closed",
      title: job.title,
      location: job.location,
      message: hired
        ? hiredRoleMessage(params.companyName, job.title)
        : closedRoleMessage(params.companyName, job.title),
    }));
}

/**
 * Existing candidate apps render `statusNote` and ignore unknown fields.
 * Prepend this copy so those apps show it without a client update.
 */
export function statusNoteWithRoleNotices(
  stored: string | null,
  notices: RoleNotice[]
): string | null {
  if (notices.length === 0) return stored;
  const body = notices.map((notice) => notice.message).join("\n\n");
  const extra = stored?.trim();
  if (!extra || extra === body) return body;
  return `${body}\n\n${extra}`;
}
