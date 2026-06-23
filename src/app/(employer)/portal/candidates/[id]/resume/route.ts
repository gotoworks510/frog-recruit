import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireEmployerApi } from "@/lib/auth/helpers";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { getD1Db } from "@/lib/db/client";
import { candidateProfiles, companies, employerAccounts } from "@/lib/db/schema";
import { getObject } from "@/lib/storage/r2";
import { watermarkPdf, watermarkLine } from "@/lib/pdf/watermark";
import { writeAudit, auditMetaFromRequest } from "@/lib/audit/log";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireEmployerApi();
  if (error) return error;

  const { id } = await params;
  const db = await getD1Db();

  // Full effective-access check + download permission.
  const grant = await getEffectiveGrant(db, session.user.id, id);
  if (!grant || !grant.canDownloadResume) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await db
    .select({ resumeKey: candidateProfiles.resumeKey })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, id))
    .get();
  if (!profile?.resumeKey) {
    return NextResponse.json({ error: "レジュメが見つかりません" }, { status: 404 });
  }

  const object = await getObject(profile.resumeKey);
  if (!object) {
    return NextResponse.json({ error: "レジュメが見つかりません" }, { status: 404 });
  }

  // Resolve company name for the watermark.
  let companyName = "Frog Recruit";
  if (session.user.companyId) {
    const company = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .get();
    if (company?.name) companyName = company.name;
  } else {
    const acct = await db
      .select({ companyId: employerAccounts.companyId })
      .from(employerAccounts)
      .where(eq(employerAccounts.userId, session.user.id))
      .get();
    if (acct?.companyId) {
      const company = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, acct.companyId))
        .get();
      if (company?.name) companyName = company.name;
    }
  }

  const original = await object.arrayBuffer();
  const stamped = await watermarkPdf(
    original,
    watermarkLine({
      companyName,
      viewerEmail: session.user.email ?? "",
      isoTimestamp: new Date().toISOString(),
    })
  );

  const meta = auditMetaFromRequest(request);
  await writeAudit(db, {
    actorUserId: session.user.id,
    actorRole: "employer",
    companyId: session.user.companyId,
    candidateProfileId: id,
    action: "download_resume",
    accessGrantId: grant.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", 'inline; filename="resume.pdf"');
  headers.set("Cache-Control", "no-store");
  // Uint8Array → BodyInit
  return new Response(stamped as unknown as BodyInit, { headers });
}
