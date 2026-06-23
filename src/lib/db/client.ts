import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof getDb>;

/**
 * Get the D1 database.
 * - Production (Workers runtime): native D1 binding via getCloudflareContext
 * - Local dev: D1 HTTP proxy → a dev/staging D1 via REST API
 */
export async function getD1Db() {
  if (process.env.NODE_ENV === "development") {
    const { createD1HttpProxy } = await import("./d1-http-proxy");
    return getDb(createD1HttpProxy());
  }

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  return getDb(env.DB);
}
