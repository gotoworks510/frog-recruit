import { sendEmail } from "@/lib/email/resend";
import { buildCandidateAccessRequestAckEmail } from "@/lib/email/messages";
import { escapeSlack, notifySlack } from "@/lib/slack/notify";
import { putObject } from "@/lib/storage/r2";
import { validateMagicBytes } from "@/lib/storage/magic-bytes";
import { MAX_RESUME_BYTES } from "@/lib/candidate/profile-core";

export type CandidateAccessRequestInput = {
  name: string;
  email: string;
  /** Optional LinkedIn profile URL (already normalized) or null. */
  linkedinUrl?: string | null;
  /** Optional PDF resume bytes. */
  resume?: { buffer: ArrayBuffer; fileName: string; size: number } | null;
};

/**
 * Public candidate access request from the mobile app (unauthenticated).
 * Frog issues accounts manually after review. Ops: Slack (+ optional R2 resume).
 */
export async function submitCandidateAccessRequest(
  input: CandidateAccessRequestInput
): Promise<{ ok: true } | { ok: false; reason: "size" | "type" | "empty" }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const linkedinUrl = input.linkedinUrl?.trim() || null;

  let resumeKey: string | null = null;
  if (input.resume) {
    const { buffer, fileName, size } = input.resume;
    if (size <= 0) return { ok: false, reason: "empty" };
    if (size > MAX_RESUME_BYTES) return { ok: false, reason: "size" };
    const magic = validateMagicBytes(buffer, "application/pdf");
    if (magic) return { ok: false, reason: "type" };
    const id = crypto.randomUUID();
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "resume.pdf";
    resumeKey = `access-requests/candidate/${id}/${sanitized}`;
    await putObject(resumeKey, buffer, "application/pdf");
  }

  const slack = await notifySlack(
    [
      ":wave: *Candidate access request — Frog Recruit app*",
      `*Name:* ${escapeSlack(name)}`,
      `*Email:* ${escapeSlack(email)}`,
      linkedinUrl
        ? `*LinkedIn:* ${escapeSlack(linkedinUrl)}`
        : "*LinkedIn:* (not provided — ask via LINE if needed)",
      resumeKey
        ? `*Resume (R2):* \`${escapeSlack(resumeKey)}\``
        : "*Resume:* (not attached — ask via LINE if needed)",
      "_Review, then issue a candidate account if appropriate._",
    ].join("\n")
  );
  if (!slack.ok && !("skipped" in slack && slack.skipped)) {
    console.error("[candidate-access] slack failed:", slack);
  }

  const { subject, subtitle, bodyHtml } = buildCandidateAccessRequestAckEmail({
    name,
  });
  const mail = await sendEmail({
    to: email,
    subject,
    subtitle,
    bodyHtml,
  });
  if (!mail.ok) {
    console.error("[candidate-access] ack email failed:", mail.error);
  }

  return { ok: true };
}
