import { Resend } from "resend";
import { getCentralSuppressed } from "./central-suppression";

let _resend: Resend | null = null;

// Resend クライアントの emails.send をラップし、中央連絡停止リスト該当を送らない。
// getResend を通す全経路（sendEmail・招待・cron 等）を一括でカバーする。
function guardResend(client: Resend): Resend {
  const origSend = client.emails.send.bind(client.emails);
  type Args = Parameters<typeof origSend>;
  const guarded = async (payload: Args[0], options?: Args[1]) => {
    const suppressed = await getCentralSuppressed();
    const p = payload as { to?: string | string[] };
    if (typeof p.to === "string") {
      if (suppressed.has(p.to.trim().toLowerCase())) {
        console.warn(`[email] 中央連絡停止リストのためスキップ: ${p.to}`);
        return { data: null, error: null };
      }
    } else if (Array.isArray(p.to)) {
      const filtered = p.to.filter((a) => !suppressed.has(String(a).trim().toLowerCase()));
      if (filtered.length === 0) {
        console.warn("[email] 中央連絡停止リストのため全宛先スキップ");
        return { data: null, error: null };
      }
      p.to = filtered;
    }
    return origSend(payload, options);
  };
  client.emails.send = guarded as typeof client.emails.send;
  return client;
}

export function getResend(): Resend {
  if (!_resend) {
    _resend = guardResend(new Resend(process.env.RESEND_API_KEY));
  }
  return _resend;
}

/** Sender. All Frog Resend mail uses agent@frogagent.com (override via RECRUIT_FROM_EMAIL). */
export const FROM_EMAIL =
  process.env.RECRUIT_FROM_EMAIL || "Frog Recruit <agent@frogagent.com>";

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
