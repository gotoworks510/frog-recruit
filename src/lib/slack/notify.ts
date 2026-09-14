/**
 * Best-effort Slack notify for frog-recruit ops alerts.
 * Uses SLACK_BOT_TOKEN + SLACK_RECRUIT_CHANNEL_ID (fallback: SLACK_CHANNEL_ID).
 * Never throws — callers should not block the candidate UX on Slack failures.
 */

export type SlackNotifyResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; error?: string };

function escapeSlack(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function notifySlack(text: string): Promise<SlackNotifyResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel =
    process.env.SLACK_RECRUIT_CHANNEL_ID || process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) {
    console.warn("[slack] skipped: SLACK_BOT_TOKEN / channel not configured");
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel,
        text,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!data.ok) {
      console.error("[slack] post failed:", data.error || res.status);
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[slack] network error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "network error",
    };
  }
}

export { escapeSlack };
