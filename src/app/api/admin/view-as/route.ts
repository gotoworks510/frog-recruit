import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { getD1Db } from "@/lib/db/client";
import { users, employerAccounts } from "@/lib/db/schema";
import {
  VIEW_AS_COOKIE,
  buildViewAsPayload,
  encodeViewAsCookie,
  type ViewAsRole,
} from "@/lib/auth/view-as";

export const dynamic = "force-dynamic";

/**
 * Admin-only: start view-as preview via Set-Cookie + 303 redirect.
 * Prefer this over Server Actions — cookie+redirect is more reliable on the Response.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const form = await request.formData();
  const asRaw = String(form.get("as") || "").trim();
  const userId = String(form.get("userId") || "").trim();
  const as: ViewAsRole | null =
    asRaw === "candidate" || asRaw === "employer" ? asRaw : null;

  if (!as || !userId) {
    const fallback =
      as === "employer" ? "/admin/employers?error=missing" : "/admin/candidates?error=missing";
    return NextResponse.redirect(new URL(fallback, request.url), 303);
  }

  const db = await getD1Db();
  const target = await db
    .select({
      id: users.id,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!target || target.role !== as) {
    const fallback =
      as === "employer"
        ? "/admin/employers?error=notfound"
        : "/admin/candidates?error=notfound";
    return NextResponse.redirect(new URL(fallback, request.url), 303);
  }

  if (as === "employer") {
    const acct = await db
      .select({ disabledAt: employerAccounts.disabledAt })
      .from(employerAccounts)
      .where(eq(employerAccounts.userId, target.id))
      .get();
    if (acct?.disabledAt) {
      return NextResponse.redirect(
        new URL("/admin/employers?error=disabled", request.url),
        303
      );
    }
  }

  if (as === "candidate" && target.status !== "approved") {
    return NextResponse.redirect(
      new URL("/admin/candidates?error=notapproved", request.url),
      303
    );
  }

  let cookieValue: string;
  try {
    cookieValue = await encodeViewAsCookie(
      buildViewAsPayload(session.user.id, as, target.id)
    );
  } catch (e) {
    console.error("[view-as] encode failed", e);
    const fallback =
      as === "employer"
        ? "/admin/employers?error=config"
        : "/admin/candidates?error=config";
    return NextResponse.redirect(new URL(fallback, request.url), 303);
  }

  const dest = as === "employer" ? "/portal" : "/me";
  const res = NextResponse.redirect(new URL(dest, request.url), 303);
  res.cookies.set(VIEW_AS_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return res;
}
