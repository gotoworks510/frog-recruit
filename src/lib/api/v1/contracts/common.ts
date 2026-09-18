import { z } from "zod";

/**
 * Shared request/response contracts for the mobile API v1.
 * This directory is the source of truth — the mobile repo copies it via
 * `npm run sync:contracts` (Fable §6.3). Never add candidate PII fields here
 * that the employer DTO doesn't already expose.
 */

export const appVariantSchema = z.enum(["candidate", "employer"]);
export type AppVariant = z.infer<typeof appVariantSchema>;

export const errorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    gate: z.enum(["password_reset", "terms", "consent"]).optional(),
    fields: z.array(z.string()).optional(),
  })
  .passthrough();

export const gatesSchema = z.object({
  mustResetPassword: z.boolean(),
  termsAccepted: z.boolean(),
  consentActive: z.boolean(),
  disabled: z.boolean(),
});
export type Gates = z.infer<typeof gatesSchema>;

export const deviceSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().max(120).nullish(),
  appVersion: z.string().max(40).nullish(),
});
export type DeviceInput = z.infer<typeof deviceSchema>;

export const MAX_PAGE_LIMIT = 50;

export const paginationQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
});

/** Opaque `created_at|id` cursor, base64. */
export function encodeCursor(createdAt: Date, id: string): string {
  return btoa(`${createdAt.getTime()}|${id}`);
}

export function decodeCursor(
  cursor: string | undefined
): { createdAtMs: number; id: string } | null {
  if (!cursor) return null;
  try {
    const [ms, id] = atob(cursor).split("|");
    const createdAtMs = Number(ms);
    if (!Number.isFinite(createdAtMs) || !id) return null;
    return { createdAtMs, id };
  } catch {
    return null;
  }
}

export const metaResponseSchema = z.object({
  minAppVersion: z.object({
    candidate: z.string(),
    employer: z.string(),
  }),
  maintenance: z.object({
    active: z.boolean(),
    message: z.string().nullable(),
  }),
});

/** ISO-8601 or null — all timestamps cross the wire as strings. */
export const isoDate = z.string().datetime();

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
