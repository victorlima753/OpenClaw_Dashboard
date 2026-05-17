import { NextRequest, NextResponse } from "next/server";
import { constantEqual, createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function getCredential(name: "ADMIN_USERNAME" | "ADMIN_PASSWORD", fallback: string) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} deve estar configurado em producao.`);
  return fallback;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  const expectedUsername = getCredential("ADMIN_USERNAME", "admin");
  const expectedPassword = getCredential("ADMIN_PASSWORD", "admin");

  if (!constantEqual(username, expectedUsername) || !constantEqual(password, expectedPassword)) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, username, role: "admin" });
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(username), sessionCookieOptions());
  return response;
}
