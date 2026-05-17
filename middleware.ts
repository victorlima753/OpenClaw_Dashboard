import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/icon.svg", "/login", "/api/auth", "/api/health"];
const WEBHOOK_PREFIXES = ["/api/webhooks"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isWebhookPath(pathname: string) {
  return WEBHOOK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || isWebhookPath(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Sessao expirada ou ausente." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = pathname === "/" ? "/dashboard" : `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"]
};
