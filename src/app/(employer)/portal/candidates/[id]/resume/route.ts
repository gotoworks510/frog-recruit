import { NextResponse } from "next/server";
import { requireEmployerApi } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { buildWatermarkedResume } from "@/lib/employer/resume-stream";
import { auditMetaFromRequest } from "@/lib/audit/log";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireEmployerApi();
  if (error) return error;

  const { id } = await params;
  const db = await getD1Db();
  const meta = auditMetaFromRequest(request);

  const result = await buildWatermarkedResume(db, {
    employerUserId: session.user.id,
    profileId: id,
    companyId: session.user.companyId,
    viewerEmail: session.user.email ?? "",
    audit: {
      actorUserId: session.user.viewAs?.adminId ?? session.user.id,
      actorRole: session.user.viewAs ? "admin_view_as" : "employer",
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  if (!result.ok) {
    return result.reason === "forbidden"
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }
  return result.response;
}
