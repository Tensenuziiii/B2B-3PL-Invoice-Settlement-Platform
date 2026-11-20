import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

const roleMap: Record<string, string[]> = {
  "/dispatch": ["ADMIN", "DISPATCH_MANAGER"],
  "/audit": ["ADMIN", "AUDITOR"],
  "/accounts": ["ADMIN", "ACCOUNTS"],
  "/driver": ["ADMIN", "DRIVER"],
  "/client-portal": ["ADMIN", "CLIENT_AP"],
  "/vendor-portal": ["ADMIN", "VENDOR_3PL"],
  "/admin": ["ADMIN"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const matchedPrefix = Object.keys(roleMap).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!matchedPrefix) return NextResponse.next();

  const token = req.cookies.get("vecto_access_token")?.value;
  if (!token) return redirectToLogin(req, pathname);

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;
    const allowed = roleMap[matchedPrefix];
    if (!allowed.includes(role)) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  } catch {
    return redirectToLogin(req, pathname);
  }
}

function redirectToLogin(req: NextRequest, from: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dispatch/:path*",
    "/audit/:path*",
    "/accounts/:path*",
    "/driver/:path*",
    "/client-portal/:path*",
    "/vendor-portal/:path*",
    "/admin/:path*",
  ],
};
