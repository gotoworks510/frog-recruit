import { eq } from "drizzle-orm";
import { candidateProfiles } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import {
  MAX_RESUME_BYTES,
  removeResumeCore,
  saveResumeCore,
} from "@/lib/candidate/profile-core";
import { getObject } from "@/lib/storage/r2";
import { badRequest, jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/** The candidate's own resume — no watermark (this is their file). */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "candidate" });
  if (error) return error;
  if (!ctx.profileId) return notFound("No resume is on file.");

  const profile = await ctx.db
    .select({ resumeKey: candidateProfiles.resumeKey })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, ctx.profileId))
    .get();
  if (!profile?.resumeKey) return notFound("No resume is on file.");

  const object = await getObject(profile.resumeKey);
  if (!object) return notFound("No resume is on file.");

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", 'inline; filename="resume.pdf"');
  headers.set("Cache-Control", "no-store");
  return new Response(object.body as ReadableStream, { headers });
}

/** multipart `file` — PDF only, magic-byte enforced, 10MB cap. */
export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Expected a multipart form with a `file` field.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return badRequest("Choose a PDF file to upload.");
  }

  const result = await saveResumeCore(ctx.db, ctx.user.id, {
    buffer: await file.arrayBuffer(),
    fileName: file.name || "resume.pdf",
    size: file.size,
  });

  if (!result.ok) {
    if (result.reason === "size") {
      return badRequest(
        `That file is too large. The limit is ${MAX_RESUME_BYTES / (1024 * 1024)}MB.`
      );
    }
    if (result.reason === "type") {
      return badRequest("Resumes must be PDF files.");
    }
    if (result.reason === "empty") {
      return badRequest("Choose a PDF file to upload.");
    }
    return notFound("Your profile is still being set up.");
  }

  return jsonOk({
    fileName: result.fileName,
    uploadedAt: result.uploadedAt.toISOString(),
  });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  const result = await removeResumeCore(ctx.db, ctx.user.id);
  if (!result.ok) return notFound("Your profile is still being set up.");
  return jsonOk({ ok: true });
}
