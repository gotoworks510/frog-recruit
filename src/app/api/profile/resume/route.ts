import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { getD1Db } from "@/lib/db/client";
import { candidateProfiles } from "@/lib/db/schema";
import { getObject } from "@/lib/storage/r2";

/** Candidate self-view of their own (un-watermarked) resume. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "candidate") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getD1Db();
  const profile = await db
    .select({ resumeKey: candidateProfiles.resumeKey })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .get();

  if (!profile?.resumeKey) {
    return NextResponse.json({ error: "レジュメが見つかりません" }, { status: 404 });
  }

  const object = await getObject(profile.resumeKey);
  if (!object) {
    return NextResponse.json({ error: "レジュメが見つかりません" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", 'inline; filename="resume.pdf"');
  return new Response(object.body as ReadableStream, { headers });
}
