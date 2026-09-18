import { requireMobile } from "@/lib/api/v1/require-mobile";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

const DOCUMENTS = { terms: "/terms", privacy: "/privacy" } as const;

/**
 * `GET /api/v1/legal/terms` and `/privacy`.
 *
 * The documents are rendered React pages, so we hand the app the canonical URL
 * to open in a WebView instead of duplicating the text. `html` stays null
 * until (if ever) we need an offline copy.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ document: string }> }
) {
  const { error } = await requireMobile(request, {});
  if (error) return error;

  const { document } = await params;
  const path = DOCUMENTS[document as keyof typeof DOCUMENTS];
  if (!path) return notFound("Unknown legal document.");

  const base = (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://recruit.frogagent.com"
  ).replace(/\/$/, "");

  return jsonOk({
    version: TERMS_VERSION,
    url: `${base}${path}`,
    html: null,
  });
}
