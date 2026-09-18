/**
 * Mobile API response helpers. Bodies are `{ error, message }` and English
 * only (AGENTS.md language policy). Every response carries `Cache-Control:
 * no-store` — candidate data must never sit in an intermediate cache.
 */

export type GateName = "password_reset" | "terms" | "consent";

function baseHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return headers;
}

/** Add no-store to a non-JSON response (e.g. the watermarked PDF stream). */
export function withNoStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(),
  });
}

export function jsonError(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
): Response {
  return new Response(JSON.stringify({ error, message, ...extra }), {
    status,
    headers: baseHeaders(),
  });
}

/** Uniform 401 body — never reveals whether the account or token exists. */
export function unauthorized(): Response {
  return jsonError(401, "unauthorized", "Authentication required.");
}

export function forbidden(message = "You don't have access to this."): Response {
  return jsonError(403, "forbidden", message);
}

export function notFound(message = "Not found."): Response {
  return jsonError(404, "not_found", message);
}

export function badRequest(
  message = "The request is invalid.",
  extra?: Record<string, unknown>
): Response {
  return jsonError(400, "bad_request", message, extra);
}

const GATE_MESSAGES: Record<GateName, string> = {
  password_reset: "Set a new password before continuing.",
  terms: "Accept the Terms of Use and Privacy Policy before continuing.",
  consent:
    "Turn sharing back on before changing your profile. Your profile is currently hidden from all employers.",
};

/** Gate not satisfied for a mutation (§6.1). */
export function gateRequired(gate: GateName): Response {
  return jsonError(409, "gate_required", GATE_MESSAGES[gate], { gate });
}

/** Wrong app for this account's role (§6.2). `role` is the account's role. */
export function wrongApp(role: "candidate" | "employer"): Response {
  return jsonError(
    403,
    "wrong_app",
    role === "candidate"
      ? "This account is for the Frog Recruit candidate app."
      : "This account is for the Frog Recruit for Employers app."
  );
}

export function conflict(
  message: string,
  extra?: Record<string, unknown>
): Response {
  return jsonError(409, "conflict", message, extra);
}

export function rateLimited(
  message = "Too many requests. Please try again later."
): Response {
  return jsonError(429, "rate_limited", message);
}

export function serverError(
  message = "Something went wrong. Please try again."
): Response {
  return jsonError(500, "server_error", message);
}

/** Zod (or any) validation failure → 400 with field paths, no values echoed. */
export function validationError(issues: { path: (string | number)[] }[]): Response {
  const fields = Array.from(
    new Set(issues.map((i) => i.path.join(".")).filter(Boolean))
  );
  return jsonError(400, "validation_failed", "Some fields are invalid.", {
    fields,
  });
}
