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

const LEGACY_HOST = "recruit.frog-school.com";
const PRIMARY_ORIGIN = "https://recruit.frogagent.com";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host === "sales.frog-school.com") {
    if (request.nextUrl.protocol !== "https:") {
      const secure = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://sales.frog-school.com");
      const response = ["GET", "HEAD"].includes(request.method)
        ? NextResponse.redirect(secure, 308)
        : new NextResponse(null, { status: 400 });
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(key,value);
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
    const pathname = request.nextUrl.pathname;
    let response: NextResponse;
    if (["/", "/admin", "/login"].includes(pathname)) {
      if (!["GET", "HEAD"].includes(request.method)) response = new NextResponse(null, {status:405});
      else response = NextResponse.redirect(new URL(pathname === "/login" ? "/staff-login" : "/admin/sales", "https://sales.frog-school.com"), 302);
    } else if (/^\/(admin\/(sales|job-inbox)|staff-login|api\/auth|legal|brand)(\/|$)/.test(pathname) || pathname === "/icon.svg") {
      response = NextResponse.next();
    } else if (/^\/(admin|portal|me)(\/|$)/.test(pathname) && ["GET", "HEAD"].includes(request.method)) {
      response = NextResponse.redirect(new URL(pathname, PRIMARY_ORIGIN), 302);
    } else response = new NextResponse(null, {status:404});
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(key,value);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  if (host === LEGACY_HOST) {
    const dest = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      PRIMARY_ORIGIN,
    );
    return NextResponse.redirect(dest, 308);
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (/^\/(admin|staff-login|api\/admin|api\/desk)(\/|$)/.test(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
