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

  let body: CaptureBody;
  try {
    body = (await request.json()) as CaptureBody;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400, origin });
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

  const titleRaw = body.title?.trim() || null;
  const companyNameRaw = body.companyName?.trim() || null;
  const locationRaw = body.location?.trim() || null;
  const descriptionRaw = body.description?.trim() || null;
  const salaryRaw = body.salary?.trim() || null;
  const postedAtRaw = body.postedAt?.trim() || null;
  const score = scoreJobLead({
    title: titleRaw,
    location: locationRaw,
    description: descriptionRaw,
    company: companyNameRaw,
  });

  const db = await getD1Db();
  const existing = await db
    .select({
      id: jobLeads.id,
      status: jobLeads.status,
      titleRaw: jobLeads.titleRaw,
    })
    .from(jobLeads)
    .where(eq(jobLeads.sourceUrl, sourceUrl))
    .get();

  const now = new Date();
  const rawPayloadJson = body.raw != null ? JSON.stringify(body.raw) : null;

  if (existing) {
    await db
      .update(jobLeads)
      .set({
        source,
        externalId: body.externalId?.trim() || null,
        companyNameRaw,
        titleRaw,
        locationRaw,
        descriptionRaw,
        salaryRaw,
        postedAtRaw,
        score,
        rawPayloadJson,
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
