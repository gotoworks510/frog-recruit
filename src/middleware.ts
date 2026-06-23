import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // These are private recruiting pages — never index them.
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "Content-Security-Policy": [
    "default-src 'self'",
    // 'unsafe-inline'/'unsafe-eval' required by Next.js hydration for now.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://lh3.googleusercontent.com data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.r2.cloudflarestorage.com",
    // PDFs are served same-origin and embedded via <embed>/<iframe>.
    "object-src 'self'",
    "frame-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
} as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
