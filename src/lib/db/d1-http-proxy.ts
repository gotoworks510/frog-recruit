/**
 * D1 HTTP Proxy — implements the D1Database interface using the Cloudflare REST
 * API. Used in local dev to talk to a remote (dev/staging) D1 instead of local
 * miniflare, so dev and the Workers runtime share one database surface.
 *
 * Requires CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and DEV_D1_DATABASE_ID
 * in .env.local.
 *
 * SAFETY: dev must point at a DEV/STAGING D1 — never production. Set
 * DEV_D1_DATABASE_ID explicitly. To deliberately target a production D1 from
 * dev (mutates live data + bills prod D1), also set PROD_D1_DATABASE_ID to that
 * id AND D1_ALLOW_PROD_IN_DEV=1.
 */

type D1HttpConfig = {
  apiToken: string;
  accountId: string;
  databaseId: string;
};

type ApiQueryResult = {
  results: Record<string, unknown>[];
  success: boolean;
  meta: Record<string, unknown>;
};

function getConfig(): D1HttpConfig {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.DEV_D1_DATABASE_ID;
  if (!apiToken || !accountId) {
    throw new Error(
      "D1 HTTP Proxy requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env.local"
    );
  }
  if (!databaseId) {
    throw new Error(
      "DEV_D1_DATABASE_ID is required in .env.local. Point local dev at a DEV/STAGING D1 id — " +
        "NOT production. To deliberately target production D1 in dev, set DEV_D1_DATABASE_ID to the " +
        "prod id, PROD_D1_DATABASE_ID to the same id, AND D1_ALLOW_PROD_IN_DEV=1."
    );
  }
  const prodId = process.env.PROD_D1_DATABASE_ID;
  if (prodId && databaseId === prodId && process.env.D1_ALLOW_PROD_IN_DEV !== "1") {
    throw new Error(
      "Refusing to use the PRODUCTION D1 database from local dev (it mutates live data and bills " +
        "prod D1 on every query). Use a staging/dev D1, or set D1_ALLOW_PROD_IN_DEV=1 to override."
    );
  }
  return { apiToken, accountId, databaseId };
}

async function executeQuery(
  config: D1HttpConfig,
  sql: string,
  params: unknown[] = []
): Promise<ApiQueryResult> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 HTTP API error (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    success: boolean;
    errors: { message: string }[];
    result: ApiQueryResult[];
  };

  if (!body.success || !body.result?.[0]) {
    const msg = body.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
    throw new Error(`D1 query failed: ${msg}`);
  }

  return body.result[0];
}

function buildMeta(raw: Record<string, unknown>): D1Meta & Record<string, unknown> {
  return {
    duration: (raw.duration as number) ?? 0,
    size_after: (raw.size_after as number) ?? 0,
    rows_read: (raw.rows_read as number) ?? 0,
    rows_written: (raw.rows_written as number) ?? 0,
    last_row_id: (raw.last_row_id as number) ?? 0,
    changed_db: (raw.changed_db as boolean) ?? false,
    changes: (raw.changes as number) ?? 0,
  };
}

class D1HttpPreparedStatement {
  private sql: string;
  private params: unknown[];
  private config: D1HttpConfig;

  constructor(config: D1HttpConfig, sql: string) {
    this.config = config;
    this.sql = sql;
    this.params = [];
  }

  bind(...values: unknown[]): D1HttpPreparedStatement {
    const stmt = new D1HttpPreparedStatement(this.config, this.sql);
    stmt.params = values;
    return stmt;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const result = await executeQuery(this.config, this.sql, this.params);
    const row = result.results[0];
    if (!row) return null;
    if (colName) return (row[colName] as T) ?? null;
    return row as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = await executeQuery(this.config, this.sql, this.params);
    return {
      results: result.results as T[],
      success: true as const,
      meta: buildMeta(result.meta),
    };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = await executeQuery(this.config, this.sql, this.params);
    return {
      results: result.results as T[],
      success: true as const,
      meta: buildMeta(result.meta),
    };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const result = await executeQuery(this.config, this.sql, this.params);
    return result.results.map((row) => Object.values(row)) as T[];
  }
}

class D1HttpDatabase {
  private config: D1HttpConfig;

  constructor(config: D1HttpConfig) {
    this.config = config;
  }

  prepare(query: string): D1PreparedStatement {
    return new D1HttpPreparedStatement(
      this.config,
      query
    ) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const stmt of statements) {
      const result = await (stmt as unknown as D1HttpPreparedStatement).run<T>();
      results.push(result);
    }
    return results;
  }

  async exec(query: string): Promise<D1ExecResult> {
    const result = await executeQuery(this.config, query);
    return {
      count: (result.meta.changes as number) ?? 0,
      duration: (result.meta.duration as number) ?? 0,
    };
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error("dump() is not supported via HTTP proxy");
  }

  withSession(): D1DatabaseSession {
    throw new Error("withSession() is not supported via HTTP proxy");
  }
}

/** Create a D1Database instance that proxies to remote D1 via HTTP API. */
export function createD1HttpProxy(): D1Database {
  const config = getConfig();
  return new D1HttpDatabase(config) as unknown as D1Database;
}
