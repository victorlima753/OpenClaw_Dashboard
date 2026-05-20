import { NextRequest, NextResponse } from "next/server";
import { hasPermission, SESSION_COOKIE_NAME, verifySessionToken, type Permission } from "@/lib/auth/session";

const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/icon.svg", "/login", "/api/auth", "/api/health"];
const WEBHOOK_PREFIXES = ["/api/webhooks"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isWebhookPath(pathname: string) {
  return WEBHOOK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function requiredPermission(request: NextRequest): Permission | null {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  if (!pathname.startsWith("/api")) return null;
  if (method === "GET") return "read";
  if (pathname.startsWith("/api/admin/users")) return "manage_users";
  if (pathname.startsWith("/api/admin/clear-demo-data")) return "clear_demo_data";
  if (pathname.startsWith("/api/settings")) return "manage_settings";
  if (pathname.startsWith("/api/alerts") && method === "POST") return "ack_alerts";
  if (pathname.startsWith("/api/agents")) return "manage_agents";
  if (pathname.startsWith("/api/review")) return "review_jobs";
  if (pathname.startsWith("/api/tasks") || pathname.startsWith("/api/queue")) return "operate_jobs";
  if (pathname.startsWith("/api/openclaw")) return "operate_jobs";
  return "read";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || isWebhookPath(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    const permission = requiredPermission(request);
    if (permission && !hasPermission(session, permission)) {
      return NextResponse.json({ error: "Permissao insuficiente.", permission }, { status: 403 });
    }
    return NextResponse.next();
  }

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
