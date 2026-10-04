import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = [
  "/dispatch",
  "/audit",
  "/accounts",
  "/driver",
  "/client-portal",
  "/admin",
];

const appAliases: Record<string, string> = {
  "/app": "/dispatch",
  "/app/dispatch": "/dispatch",
  "/app/audit": "/audit",
  "/app/accounts": "/accounts",
  "/app/billing": "/accounts",
  "/app/driver": "/driver",
  "/app/client-portal": "/client-portal",
  "/app/admin": "/admin",
};

export function middleware(request: NextRequest) {
  const token = request.cookies.get("vecto_access_token")?.value;
  const { pathname } = request.nextUrl;
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";

  const aliasTarget = appAliases[normalizedPath];

  if (aliasTarget) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.redirect(new URL(aliasTarget, request.url));
  }

  if (normalizedPath === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isProtected = protectedRoutes.some(
    (route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`)
  );

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dispatch/:path*",
    "/audit/:path*",
    "/accounts/:path*",
    "/driver/:path*",
    "/client-portal/:path*",
    "/admin/:path*",
    "/app",
    "/app/:path*",
  ],
};
