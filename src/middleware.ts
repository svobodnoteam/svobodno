import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function hasAdminAccess(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return false;
  }

  const header = request.headers.get("x-admin-secret");
  const cookie = request.cookies.get("admin-secret")?.value;

  return header === secret || cookie === secret;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin") || isLoginPath(pathname)) {
    return NextResponse.next();
  }

  if (hasAdminAccess(request)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
