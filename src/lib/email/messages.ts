import {
  primaryButton,
  baseUrl,
  escapeHtml,
  credentialCard,
  mintNote,
} from "./templates";

export type RecruitEmailContent = {
  subject: string;
  /** Shown under the brand lockup in the shared shell. */
  subtitle: string;
  /** Inner body HTML only — never a full document. */
  bodyHtml: string;
};

/** Candidate invitation email — links to the invite-accept page. */
export function buildCandidateInviteEmail(params: {
  name?: string | null;
  token: string;
}): RecruitEmailContent {
  const url = `${baseUrl()}/invite/${params.token}`;
  const greeting = params.name ? `Hi ${escapeHtml(params.name)},` : "Hello,";
  return {
    subject: "You're invited to create your Frog Recruit candidate profile",
    subtitle: "Create your candidate profile",
    bodyHtml: `
    <p style="margin:0 0 14px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      Frog would like to invite you to create your candidate profile for
      international career opportunities. Sign in with Google to add the details
      hiring teams need — with context, consent, and care.
    </p>
    <p style="text-align:center;margin:28px 0;">${primaryButton(
      url,
      "Create your profile"
    )}</p>
    ${mintNote(
      "This invitation link is unique to you. Please note its expiration date."
    )}
  `,
  };
}

/** Employer account credentials email — sent when an admin issues an account. */
export function buildEmployerCredentialsEmail(params: {
  companyName: string;
  contactName?: string | null;
  email: string;
  tempPassword: string;
}): RecruitEmailContent {
  const url = `${baseUrl()}/employer/login`;
  const greeting = params.contactName
    ? `Dear ${escapeHtml(params.contactName)},`
    : `Dear ${escapeHtml(params.companyName)} team,`;
  return {
    subject: `Your Frog Recruit candidate access account (${params.companyName})`,
    subtitle: "Your company portal access",
    bodyHtml: `
    <p style="margin:0 0 14px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      We&apos;ve created your Frog Recruit account for viewing candidates
      introduced to <strong>${escapeHtml(params.companyName)}</strong>.
      Log in with the credentials below — you&apos;ll be asked to change your
      password the first time you sign in.
    </p>
    ${credentialCard([
      { label: "Email", value: params.email },
      { label: "Temporary password", value: params.tempPassword, mono: true },
    ])}
    <p style="text-align:center;margin:28px 0;">${primaryButton(
      url,
      "Log in to your portal"
    )}</p>
    ${mintNote(
      "Candidate information is confidential. Please do not share or redistribute it."
    )}
  `,
  };
}

/** Candidate account credentials — admin-issued email + temporary password. */
export function buildCandidateCredentialsEmail(params: {
  name?: string | null;
  email: string;
  tempPassword: string;
}): RecruitEmailContent {
  const url = `${baseUrl()}/login`;
  const greeting = params.name ? `Hi ${escapeHtml(params.name)},` : "Hello,";
  return {
    subject: "Your Frog Recruit candidate account",
    subtitle: "Your candidate account",
    bodyHtml: `
    <p style="margin:0 0 14px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      Frog has created your candidate account on Frog Recruit. You can review and
      update your profile, and see which companies Frog is introducing you to.
    </p>
    <p style="margin:0 0 6px;color:#6b756f;font-size:13px;">
      Please log in with the credentials below. You&apos;ll be asked to change your
      password the first time you sign in.
    </p>
    ${credentialCard([
      { label: "Email", value: params.email },
      { label: "Temporary password", value: params.tempPassword, mono: true },
    ])}
    <p style="text-align:center;margin:28px 0;">${primaryButton(
      url,
      "Log in"
    )}</p>
    ${mintNote(
      "If you weren&apos;t expecting this email, please contact your Frog representative."
    )}
  `,
  };
}

/**
 * Notify a candidate that an employer expressed interest.
 * Prompts them to contact their Frog representative — no direct employer contact.
 */
export function buildCandidateEmployerInterestEmail(params: {
  name?: string | null;
  companyName: string;
}): RecruitEmailContent {
  const greeting = params.name ? `Hi ${escapeHtml(params.name)},` : "Hello,";
  const company = escapeHtml(params.companyName);
  const portalUrl = `${baseUrl()}/me`;
  return {
    subject: `${params.companyName} is interested in connecting — next step with Frog`,
    subtitle: "An introduction is moving forward",
    bodyHtml: `
    <p style="margin:0 0 14px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 14px;">
      Good news — <strong>${company}</strong> reviewed your profile through Frog
      Recruit and expressed interest in connecting with you.
    </p>
    <p style="margin:0 0 14px;">
      Please reach out to your Frog representative to talk through next steps
      (questions, interview timing, and anything you want us to confirm with the
      company). Don&apos;t contact the company directly unless Frog asks you to.
    </p>
    <p style="text-align:center;margin:28px 0;">${primaryButton(
      portalUrl,
      "Open your Frog Recruit home"
    )}</p>
    ${mintNote(
      "You can also reply to this email if you&apos;re unsure who your Frog contact is — we&apos;ll route it."
    )}
  `,
  };
}
