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
  }
}

export {};
