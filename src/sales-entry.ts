/** Sales entry only: no credentials, bindings, proxying, or shared cookies. */
const salesEntry = {
  async fetch(request: Request): Promise<Response> {
    const headers = new Headers({
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    });
    if (!["GET", "HEAD"].includes(request.method)) {
      headers.set("Allow", "GET, HEAD");
      return new Response(null, { status: 405, headers });
    }
    // Discard untrusted paths and query strings. Never redirect submitted bodies.
    headers.set("Location", "https://recruit.frogagent.com/staff-login");
    return new Response(null, { status: 302, headers });
  },
};
export default salesEntry;
