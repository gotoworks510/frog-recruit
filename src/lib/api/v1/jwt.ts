import type { AppVariant } from "@/lib/db/schema/mobile";
import { base64UrlToBytes, bytesToBase64Url, timingSafeEqual } from "./crypto";

/** Access tokens are short-lived; authorization is re-checked in the DB. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface MobileJwtPayload {
  /** users.id */
  sub: string;
  role: "candidate" | "employer";
  /** users.employer_company_id (employers only). */
  companyId: string | null;
  /** mobile_sessions.id */
  sid: string;
  appVariant: AppVariant;
  iat: number;
  exp: number;
}

/**
 * The HS256 secret is a Worker secret, so it only exists in `process.env` at
 * REQUEST time on OpenNext/Cloudflare — read it per call, never at module load
 * (same trap as the NextAuth lazy config, see AGENTS.md).
 */
function getSecret(): string {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) {
    throw new Error("MOBILE_JWT_SECRET is not configured");
  }
  return secret;
}

export function isMobileJwtConfigured(): boolean {
  return !!process.env.MOBILE_JWT_SECRET;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function encodeSegment(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function sign(data: string): Promise<string> {
  const key = await importKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function signAccessToken(claims: {
  sub: string;
  role: "candidate" | "employer";
  companyId: string | null;
  sid: string;
  appVariant: AppVariant;
}): Promise<{ token: string; expiresIn: number }> {
  const iat = Math.floor(Date.now() / 1000);
  const payload: MobileJwtPayload = {
    ...claims,
    iat,
    exp: iat + ACCESS_TOKEN_TTL_SECONDS,
  };
  const head = encodeSegment({ alg: "HS256", typ: "JWT" });
  const body = encodeSegment(payload);
  const signature = await sign(`${head}.${body}`);
  return {
    token: `${head}.${body}.${signature}`,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

/** Verify signature + expiry. Returns null on any problem (uniform 401). */
export async function verifyAccessToken(
  token: string
): Promise<MobileJwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, signature] = parts;

  let expected: string;
  try {
    expected = await sign(`${head}.${body}`);
  } catch {
    return null;
  }
  if (!timingSafeEqual(signature, expected)) return null;

  let payload: MobileJwtPayload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(body))
    ) as MobileJwtPayload;
  } catch {
    return null;
  }

  if (
    !payload.sub ||
    !payload.sid ||
    !payload.exp ||
    (payload.role !== "candidate" && payload.role !== "employer") ||
    (payload.appVariant !== "candidate" && payload.appVariant !== "employer")
  ) {
    return null;
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}
