import { requireMobile } from "@/lib/api/v1/require-mobile";
import { deletionRequestSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk } from "@/lib/api/v1/errors";
import { notifySlackUnlessTest } from "@/lib/notify/skip-ops";
import { escapeSlack } from "@/lib/slack/notify";

export const dynamic = "force-dynamic";

/**
 * In-app account deletion request (App Store 5.1.1(v)). Frog handles the
 * deletion manually; the app clears its local session afterwards.
 */
export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
    rateLimit: {
      key: `rl:v1:deletion:${request.headers.get("cf-connecting-ip") ?? "u"}`,
      limit: 5,
      windowSeconds: 3600,
    },
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    deletionRequestSchema
  );
  if (bodyError) return bodyError;

  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://recruit.frogagent.com";
  const adminUrl =
    ctx.user.role === "candidate"
      ? `${base.replace(/\/$/, "")}/admin/candidates/${ctx.user.id}`
      : `${base.replace(/\/$/, "")}/admin/employers`;

  await notifySlackUnlessTest(
    ctx.db,
    [ctx.user.id],
    [
      ":wastebasket: *Account deletion requested (mobile app)*",
      `*Role:* ${ctx.user.role}`,
      `*User:* ${escapeSlack(ctx.user.name ?? "—")} (${escapeSlack(ctx.user.email)})`,
      `*Reason:* ${escapeSlack(data.reason?.slice(0, 500) ?? "—")}`,
      `*Admin:* ${adminUrl}`,
      "_Please action manually and confirm with the user._",
    ].join("\n")
  );

  return jsonOk({
    ok: true,
    message:
      "We've received your request. A Frog representative will confirm by email.",
  });
}
