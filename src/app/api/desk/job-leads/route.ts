import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getD1Db } from "@/lib/db/client";
import { jobLeads } from "@/lib/db/schema";
import {
  extensionTokenMatches,
  isJobInboxEnabled,
} from "@/lib/job-inbox/config";
import { detectSourceFromUrl, scoreJobLead } from "@/lib/job-inbox/score";

export const dynamic = "force-dynamic";

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin && origin.startsWith("chrome-extension://")
      ? origin
      : origin === "http://localhost:3005"
        ? origin
        : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  body: unknown,
  init: { status?: number; origin: string | null }
) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: corsHeaders(init.origin),
  });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("Origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

type CaptureBody = {
  sourceUrl?: string;
  source?: string;
  externalId?: string | null;
  companyName?: string | null;
  title?: string | null;
  location?: string | null;
  description?: string | null;
  salary?: string | null;
  postedAt?: string | null;
  raw?: unknown;
};

/**
 * Chrome extension capture endpoint (dev / gated).
 * Auth: Authorization: Bearer <JOB_INBOX_TOKEN>
 */
export async function POST(request: Request) {
  const origin = request.headers.get("Origin");

  if (!isJobInboxEnabled()) {
    return json(
      { error: "Job Inbox is disabled. Set JOB_INBOX_ENABLED=1 for local use." },
      { status: 403, origin }
    );
  }

  const auth = request.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!extensionTokenMatches(token)) {
    return json({ error: "Unauthorized" }, { status: 401, origin });
  }

  let body: CaptureBody | null = null;
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as CaptureBody;
    }
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400, origin });
  }
  if (!body) {
    return json(
      {
        error:
          "Empty capture payload. Re-open the job detail (or reload the tab) and try Save again.",
      },
      { status: 400, origin }
    );
  }

  const sourceUrl = body.sourceUrl?.trim();
  if (!sourceUrl) {
    return json({ error: "sourceUrl is required" }, { status: 400, origin });
  }
  try {
    // Validate URL shape
    new URL(sourceUrl);
  } catch {
    return json({ error: "sourceUrl must be a valid URL" }, { status: 400, origin });
  }

  const source =
    body.source === "linkedin" ||
    body.source === "indeed" ||
    body.source === "glassdoor" ||
    body.source === "manual" ||
    body.source === "other"
      ? body.source
      : detectSourceFromUrl(sourceUrl);

  const incoming = {
    externalId: body.externalId?.trim() || null,
    companyNameRaw: body.companyName?.trim() || null,
    titleRaw: body.title?.trim() || null,
    locationRaw: body.location?.trim() || null,
    descriptionRaw: body.description?.trim() || null,
    salaryRaw: body.salary?.trim() || null,
    postedAtRaw: body.postedAt?.trim() || null,
  };

  const db = await getD1Db();
  const existing = await db
    .select()
    .from(jobLeads)
    .where(eq(jobLeads.sourceUrl, sourceUrl))
    .get();

  const now = new Date();
  const rawPayloadJson = body.raw != null ? JSON.stringify(body.raw) : null;

  /** Prefer non-empty incoming; treat our own stub text as empty so a real re-save can replace it. */
  function isStub(value: string | null | undefined): boolean {
    if (!value) return true;
    return /open on LinkedIn to refresh|Captured from LinkedIn|Re-save from the job detail/i.test(
      value
    );
  }
  function prefer(
    next: string | null,
    prev: string | null | undefined
  ): string | null {
    if (next && next.length > 0) return next;
    if (isStub(prev)) return null;
    return prev ?? null;
  }

  if (existing) {
    const titleRaw = prefer(incoming.titleRaw, existing.titleRaw);
    const companyNameRaw = prefer(incoming.companyNameRaw, existing.companyNameRaw);
    const locationRaw = prefer(incoming.locationRaw, existing.locationRaw);
    const descriptionRaw = prefer(
      incoming.descriptionRaw,
      existing.descriptionRaw
    );
    const salaryRaw = prefer(incoming.salaryRaw, existing.salaryRaw);
    const postedAtRaw = prefer(incoming.postedAtRaw, existing.postedAtRaw);
    const externalId = prefer(incoming.externalId, existing.externalId);
    const score = scoreJobLead({
      title: titleRaw,
      location: locationRaw,
      description: descriptionRaw,
      company: companyNameRaw,
    });

    await db
      .update(jobLeads)
      .set({
        source,
        externalId,
        companyNameRaw,
        titleRaw,
        locationRaw,
        descriptionRaw,
        salaryRaw,
        postedAtRaw,
        score,
        rawPayloadJson: rawPayloadJson ?? existing.rawPayloadJson,
        updatedAt: now,
        // Keep converted/rejected status; revive snoozed/new on re-capture.
        status:
          existing.status === "snoozed" || existing.status === "new"
            ? "new"
            : existing.status,
      })
      .where(eq(jobLeads.id, existing.id));

    return json(
      {
        ok: true,
        id: existing.id,
        duplicate: true,
        status: existing.status,
        score,
        inboxUrl: `http://localhost:3005/admin/job-inbox/${existing.id}`,
      },
      { origin }
    );
  }

  const titleRaw = incoming.titleRaw;
  const companyNameRaw = incoming.companyNameRaw;
  const locationRaw = incoming.locationRaw;
  const descriptionRaw = incoming.descriptionRaw;
  const salaryRaw = incoming.salaryRaw;
  const postedAtRaw = incoming.postedAtRaw;
  const score = scoreJobLead({
    title: titleRaw,
    location: locationRaw,
    description: descriptionRaw,
    company: companyNameRaw,
  });

  const id = crypto.randomUUID();
  await db.insert(jobLeads).values({
    id,
    source,
    sourceUrl,
    externalId: body.externalId?.trim() || null,
    companyNameRaw,
    titleRaw,
    locationRaw,
    descriptionRaw,
    salaryRaw,
    postedAtRaw,
    status: "new",
    score,
    rawPayloadJson,
    capturedBy: "extension",
    capturedAt: now,
    updatedAt: now,
  });

  return json(
    {
      ok: true,
      id,
      duplicate: false,
      status: "new",
      score,
      inboxUrl: `http://localhost:3005/admin/job-inbox/${id}`,
    },
    { origin }
  );
}
