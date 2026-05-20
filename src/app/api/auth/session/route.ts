import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, permissionsForRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: { id: session.userId, name: session.username, email: session.email, role: session.role },
    username: session.username,
    role: session.role,
    permissions: permissionsForRole(session.role)
  });
}
