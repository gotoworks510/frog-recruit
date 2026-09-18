import { sendEmail } from "@/lib/email/resend";
import { buildEmployerAccessRequestAckEmail } from "@/lib/email/messages";
import { escapeSlack, notifySlack } from "@/lib/slack/notify";

export type EmployerAccessRequestInput = {
  jobUrl: string;
  companyName: string;
  contactName: string;
  email: string;
};

/**
 * Public employer access request from the mobile app (unauthenticated).
 * Frog reviews offline; accounts are issued only when we have a confident intro.
 * Ops surface: Slack. Requester gets a confirmation email.
 */
export async function submitEmployerAccessRequest(
  input: EmployerAccessRequestInput
): Promise<{ ok: true }> {
  const jobUrl = input.jobUrl.trim();
  const companyName = input.companyName.trim();
  const contactName = input.contactName.trim();
  const email = input.email.trim().toLowerCase();

  const slack = await notifySlack(
    [
      ":clipboard: *Employer access request — Frog Recruit app*",
      `*Company:* ${escapeSlack(companyName)}`,
      `*Contact:* ${escapeSlack(contactName)}`,
      `*Email:* ${escapeSlack(email)}`,
      `*Job URL:* ${escapeSlack(jobUrl)}`,
      "_Review the role. Only issue an employer account if you have a confident candidate intro._",
    ].join("\n")
  );
  if (!slack.ok && !("skipped" in slack && slack.skipped)) {
    console.error("[access-request] slack failed:", slack);
  }

  const { subject, subtitle, bodyHtml } = buildEmployerAccessRequestAckEmail({
    companyName,
    contactName,
  });
  const mail = await sendEmail({
    to: email,
    subject,
    subtitle,
    bodyHtml,
  });
  if (!mail.ok) {
    console.error("[access-request] ack email failed:", mail.error);
  }

  return { ok: true };
}
