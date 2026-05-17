import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

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

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    const sessionUrl = request.nextUrl.clone();
    sessionUrl.pathname = "/api/auth/session";
    sessionUrl.search = "";
    const sessionResponse = await fetch(sessionUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store"
    }).catch(() => null);
    if (sessionResponse?.ok) return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Sessao expirada ou ausente." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"]
};
