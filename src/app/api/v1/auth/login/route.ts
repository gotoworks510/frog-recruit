import { getD1Db } from "@/lib/db/client";
import { login } from "@/lib/api/v1/auth-service";
import { isMobileJwtConfigured } from "@/lib/api/v1/jwt";
import { loginRequestSchema } from "@/lib/api/v1/contracts/auth";
import { readJson } from "@/lib/api/v1/parse";
import {
  jsonOk,
  rateLimited,
  serverError,
  unauthorized,
  wrongApp,
} from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMobileJwtConfigured()) {
    console.error("[v1] MOBILE_JWT_SECRET is not set");
    return serverError("Sign-in is temporarily unavailable.");
  }

  const { data, error } = await readJson(request, loginRequestSchema);
  if (error) return error;

  const db = await getD1Db();
  const result = await login(db, {
    email: data.email,
    password: data.password,
    appVariant: data.appVariant,
    device: data.device,
    ip:
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for"),
  });

  if (!result.ok) {
    if (result.reason === "rate_limited") return rateLimited();
    if (result.reason === "wrong_app" && result.role) {
      return wrongApp(result.role);
    }
    // Uniform body: never reveal whether the email exists.
    return unauthorized();
  }

  return jsonOk({
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    expiresIn: result.tokens.expiresIn,
    user: result.user,
    gates: result.gates,
  });
}
