import { jsonOk } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Startup probe (§6.2). Unauthenticated on purpose — the app calls this before
 * it has a session to decide whether to force an update.
 */
export async function GET() {
  return jsonOk({
    minAppVersion: {
      candidate: process.env.MOBILE_MIN_VERSION_CANDIDATE || "1.0.0",
      employer: process.env.MOBILE_MIN_VERSION_EMPLOYER || "1.0.0",
    },
    maintenance: {
      active: process.env.MOBILE_MAINTENANCE === "1",
      message: process.env.MOBILE_MAINTENANCE_MESSAGE || null,
    },
  });
}
