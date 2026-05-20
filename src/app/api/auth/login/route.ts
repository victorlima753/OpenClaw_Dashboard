import { NextRequest, NextResponse } from "next/server";
import { normalizeCredential } from "@/lib/auth/credentials";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";
import { authenticateUser } from "@/lib/auth/users";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
    const username = normalizeCredential(body?.username ?? "");
    const password = normalizeCredential(body?.password ?? "");

    const user = await authenticateUser(username, password);
    if (!user) return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });

    const response = NextResponse.json({ ok: true, user, username: user.name, role: user.role });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      await createSessionToken({ userId: user.id, username: user.name, email: user.email, role: user.role }),
      sessionCookieOptions()
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error, "api/auth/login");
  }
}
