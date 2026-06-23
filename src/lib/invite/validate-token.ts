import { eq } from "drizzle-orm";
import { candidateInvites } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

type InviteRow = {
  id: string;
  email: string;
  name: string | null;
  token: string;
  status: string;
  maxUses: number;
  useCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
  acceptedUserId: string | null;
};

type ValidationSuccess = { valid: true; invite: InviteRow };
type ValidationFailure = {
  valid: false;
  reason: "not_found" | "expired" | "revoked" | "max_uses_reached";
};

export type ValidateInviteTokenResult = ValidationSuccess | ValidationFailure;

export async function validateInviteToken(
  db: Database,
  token: string
): Promise<ValidateInviteTokenResult> {
  const row = await db
    .select({
      id: candidateInvites.id,
      email: candidateInvites.email,
      name: candidateInvites.name,
      token: candidateInvites.token,
      status: candidateInvites.status,
      maxUses: candidateInvites.maxUses,
      useCount: candidateInvites.useCount,
      expiresAt: candidateInvites.expiresAt,
      revokedAt: candidateInvites.revokedAt,
      acceptedUserId: candidateInvites.acceptedUserId,
    })
    .from(candidateInvites)
    .where(eq(candidateInvites.token, token))
    .get();

  if (!row) return { valid: false, reason: "not_found" };
  if (row.revokedAt || row.status === "revoked") {
    return { valid: false, reason: "revoked" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  if (row.useCount >= row.maxUses) {
    return { valid: false, reason: "max_uses_reached" };
  }
  return { valid: true, invite: row };
}
