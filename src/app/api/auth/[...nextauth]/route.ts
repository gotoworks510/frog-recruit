import { handlers, salesAuth } from "@/lib/auth/auth";
import type { NextRequest } from "next/server";

function salesRequest(request: NextRequest): Request | null {
  if (request.headers.get("host")?.toLowerCase() !== "sales.frog-school.com") return null;
  const incoming = new URL(request.url);
  // Next's internal URL can differ behind an adapter. Only this exact public host
  // selects the sales config; never trust a client-provided forwarded host.
  return new Request(`https://sales.frog-school.com${incoming.pathname}${incoming.search}`, request);
}
export async function GET(request: NextRequest) {
  const sales = salesRequest(request);
  return sales ? salesAuth(sales) : handlers.GET(request);
}
export async function POST(request: NextRequest) {
  const sales = salesRequest(request);
  return sales ? salesAuth(sales) : handlers.POST(request);
}
