import { submitCandidateAccessRequest } from "@/lib/candidate/access-request";
import { candidateAccessRequestSchema } from "@/lib/api/v1/contracts/candidate";
import { badRequest, jsonOk, rateLimited } from "@/lib/api/v1/errors";
import { rateLimit } from "@/lib/ratelimit/kv";
import { MAX_RESUME_BYTES } from "@/lib/candidate/profile-core";

export const dynamic = "force-dynamic";

/**
 * Public candidate access request (multipart preferred).
 * Fields: name, email, optional linkedinUrl, optional file (PDF).
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const allowed = await rateLimit(`rl:v1:candidate-access:${ip}`, 5, 3600);
  if (!allowed) return rateLimited();

  const contentType = request.headers.get("content-type") || "";
  let name = "";
  let email = "";
  let linkedinUrl = "";
  let resume: { buffer: ArrayBuffer; fileName: string; size: number } | null =
    null;

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest("Expected a multipart form.");
    }
    name = String(form.get("name") ?? "");
    email = String(form.get("email") ?? "");
    linkedinUrl = String(form.get("linkedinUrl") ?? "");
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      resume = {
        buffer: await file.arrayBuffer(),
        fileName: file.name || "resume.pdf",
        size: file.size,
      };
    }
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body.");
    }
    const parsed = candidateAccessRequestSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Please check name, email, and LinkedIn (if provided).", {
        issues: parsed.error.issues.map((i) => i.message),
      });
    }
    name = parsed.data.name;
    email = parsed.data.email;
    linkedinUrl = parsed.data.linkedinUrl ?? "";
  }

  const fields = candidateAccessRequestSchema.safeParse({
    name,
    email,
    linkedinUrl,
  });
  if (!fields.success) {
    return badRequest("Please check name, email, and LinkedIn (if provided).", {
      issues: fields.error.issues.map((i) => i.message),
    });
  }

  try {
    const result = await submitCandidateAccessRequest({
      ...fields.data,
      resume,
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
      return badRequest("Choose a PDF file to upload.");
    }
  } catch (e) {
    console.error("[v1] candidate access request failed:", e);
  }

  return jsonOk({
    ok: true,
    message:
      "Thanks — we received your request. If Frog can move forward, we'll email you account details.",
  });
}
