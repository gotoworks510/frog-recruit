import { requireAdmin } from "@/lib/auth/helpers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { eq } from "drizzle-orm";
import { getD1Db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function requireSalesAdmin(): Promise<Session> {
  const session = await requireAdmin();
  if (!(await isCurrentAdmin(session))) redirect("/login");
  return session;
}

/** Re-read authorization; a stale JWT or a failed DB read must never grant access. */
async function isCurrentAdmin(session: Session): Promise<boolean> {
  try {
    const db = await getD1Db();
    const current = await db.select({ role:users.role, status:users.status, terms:users.termsAcceptedAt })
      .from(users).where(eq(users.id,session.user.id)).get();
    return current?.role === "admin" && current.status === "approved" && !!current.terms;
  } catch { return false; }
}

/** Additional same-origin check for staff sales mutations, including native form posts. */
export async function requireAdminMutation(): Promise<Session> {
  const session = await requireSalesAdmin();
  const h = await headers();
  try {
    const origin = new URL(h.get("origin") ?? "");
    if (!["https:", "http:"].includes(origin.protocol) || origin.host !== h.get("host")) throw new Error();
  } catch { throw new Error("Request not allowed"); }
  return session;
}
