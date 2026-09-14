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
  }
}

export {};
