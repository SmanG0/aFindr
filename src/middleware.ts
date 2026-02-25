import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/landing",
  "/waitlist",
  "/onboarding",
  "/api/data",
  "/api/news",
  "/api/portfolio",
  "/_next",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  // Dev bypass: skip auth redirect in development
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Auth is handled client-side by ConvexAuthProvider.
  // This middleware only redirects unauthenticated users
  // (no Convex auth token cookie) to /login.
  if (!isPublic) {
    const hasToken =
      request.cookies.has("__convexAuthJWT") ||
      request.cookies.has("__convexAuthRefreshToken");
    if (!hasToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
