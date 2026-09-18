/**
 * Cloudflare binding types for the OpenNext runtime.
 * `getCloudflareContext().env` is typed against this interface.
 */
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    R2: R2Bucket;
    KV: KVNamespace;
    ASSETS: Fetcher;
    GOOGLE_CLIENT_ID?: string;
    NEXTAUTH_URL?: string;
    ADMIN_EMAILS?: string;
    PUBLIC_BASE_URL?: string;
    RECRUIT_FROM_EMAIL?: string;
    JOB_INBOX_ENABLED?: string;
    JOB_INBOX_TOKEN?: string;
    SLACK_BOT_TOKEN?: string;
    /** Prefer recruit-specific channel; falls back to SLACK_CHANNEL_ID. */
    SLACK_RECRUIT_CHANNEL_ID?: string;
    SLACK_CHANNEL_ID?: string;
    /** HS256 secret for mobile access JWTs (`wrangler secret put`). */
    MOBILE_JWT_SECRET?: string;
    /** Optional Expo Push access token for higher rate limits. */
    EXPO_ACCESS_TOKEN?: string;
    /** Forced-update floor reported by GET /api/v1/meta. */
    MOBILE_MIN_VERSION_CANDIDATE?: string;
    MOBILE_MIN_VERSION_EMPLOYER?: string;
    /** "1" puts the mobile apps into the maintenance screen. */
    MOBILE_MAINTENANCE?: string;
    MOBILE_MAINTENANCE_MESSAGE?: string;
  }
}

export {};
