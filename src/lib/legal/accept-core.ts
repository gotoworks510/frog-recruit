import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { TERMS_VERSION } from "@/lib/legal/terms";
import type { Database } from "@/lib/db/client";

/**
 * Record one-time acceptance of the Terms of Use + Privacy Policy.
 * Shared by the Web `/legal` action and `POST /api/v1/account/terms/accept`.
 */
export async function acceptTerms(
  db: Database,
  userId: string,
  version?: string | null
): Promise<{ version: string; acceptedAt: Date }> {
  const acceptedAt = new Date();
  const termsVersion = version?.trim() || TERMS_VERSION;
  await db
    .update(users)
    .set({ termsAcceptedAt: acceptedAt, termsVersion })
    .where(eq(users.id, userId));
  return { version: termsVersion, acceptedAt };
}
