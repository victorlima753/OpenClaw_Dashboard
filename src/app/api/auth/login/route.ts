import { NextRequest, NextResponse } from "next/server";
import { getRequiredCredential, normalizeCredential } from "@/lib/auth/credentials";
import { constantEqual, createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = normalizeCredential(body?.username ?? "");
  const password = normalizeCredential(body?.password ?? "");
  const expectedUsername = getRequiredCredential("ADMIN_USERNAME", "admin");
  const expectedPassword = getRequiredCredential("ADMIN_PASSWORD", "admin");

  if (!constantEqual(username, expectedUsername) || !constantEqual(password, expectedPassword)) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, username, role: "admin" });
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(username), sessionCookieOptions());
  return response;
}
