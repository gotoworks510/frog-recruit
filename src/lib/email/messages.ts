import { wrapEmailHtml, primaryButton, baseUrl, escapeHtml } from "./templates";

/** Candidate invitation email — links to the invite-accept page. */
export function buildCandidateInviteEmail(params: {
  name?: string | null;
  token: string;
}): { subject: string; html: string } {
  const url = `${baseUrl()}/invite/${params.token}`;
  const greeting = params.name ? `Hi ${escapeHtml(params.name)},` : "Hello,";
  const bodyHtml = `
    <p>${greeting}</p>
    <p>Frog would like to invite you to create your candidate profile for international career opportunities.
    Click the button below to sign in with your Google account and add the details employers need.</p>
    <p style="text-align:center;margin:28px 0;">${primaryButton(url, "Create your profile")}</p>
    <p style="color:#718096;font-size:13px;">This invitation link is unique to you, so please note its expiration date.
    If you weren't expecting this email, you can safely ignore it.</p>
  `;
  return {
    subject: "You're invited to create your Frog Recruit candidate profile",
    html: wrapEmailHtml({ subtitle: "Create your candidate profile", bodyHtml }),
  };
}

/** Employer account credentials email — sent when an admin issues an account. */
export function buildEmployerCredentialsEmail(params: {
  companyName: string;
  contactName?: string | null;
  email: string;
  tempPassword: string;
}): { subject: string; html: string } {
  const url = `${baseUrl()}/employer/login`;
  const greeting = params.contactName
    ? `Dear ${escapeHtml(params.contactName)},`
    : `Dear ${escapeHtml(params.companyName)} team,`;
  const bodyHtml = `
    <p>${greeting}</p>
    <p>We've created your Frog Recruit account for viewing candidates. Please log in with the credentials below.
    You'll be asked to change your password the first time you sign in.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e4e7e4;border-radius:8px;">
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;">Email</td>
          <td style="padding:10px 16px;font-weight:600;">${escapeHtml(params.email)}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;border-top:1px solid #eef0ee;">Temporary password</td>
          <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eef0ee;font-family:monospace;">${escapeHtml(
            params.tempPassword
          )}</td></tr>
    </table>
    <p style="text-align:center;margin:28px 0;">${primaryButton(url, "Log in")}</p>
    <p style="color:#718096;font-size:13px;">The candidate information shown here is confidential. Please do not share or redistribute it to third parties.</p>
  `;
  return {
    subject: `Your Frog Recruit candidate access account (${params.companyName})`,
    html: wrapEmailHtml({ subtitle: "Your candidate access account", bodyHtml }),
  };
}
