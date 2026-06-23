import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Sender. frogagent.com is NOT yet Resend-verified, so we send from the
 * verified japan.frogagent.com (same as frog-school-portal). Override via the
 * RECRUIT_FROM_EMAIL env var once frogagent.com is verified.
 */
export const FROM_EMAIL =
  process.env.RECRUIT_FROM_EMAIL || "Frog Recruit <recruit@frogagent.com>";

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
    if (error) {
      console.error("[email] send error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error("[email] send threw:", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
