import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * Edge proxy (Next.js 16 renamed the "middleware" convention to "proxy"): a
 * fast, coarse auth gate for protected routes. It only checks for the presence
 * of a session cookie (cheap, no DB) so unauthenticated users are redirected to
 * /login before rendering. Authoritative validation still happens in the
 * platform layout (getSessionUser → DB lookup); this is purely a UX/perf
 * optimization, never the security boundary.
 */
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// NOTE: matcher entries must be static string literals (Next statically analyzes
// them). Keep this list in sync with PROTECTED_ROUTES in src/lib/constants.ts.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/create/:path*",
    "/projects/:path*",
    "/simulations/:path*",
    "/anything-wars/:path*",
    "/entities/:path*",
    "/worlds/:path*",
    "/tournaments/:path*",
    "/assets/:path*",
    "/studio/:path*",
    "/templates/:path*",
    "/analytics/:path*",
    "/team/:path*",
    "/settings/:path*",
  ],
};
