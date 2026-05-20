import { NextResponse } from "next/server";
import { userSelect } from "@/lib/auth/users";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.user.update({
      where: { id },
      data: { status: "disabled" },
      select: userSelect
    });

    await createAuditLog({
      eventType: "webhook_received",
      severity: "warning",
      stage: "RBAC",
      decision: "user_disabled",
      message: `Usuario ${user.email} desativado.`,
      outputPayload: { userId: user.id, email: user.email }
    });

    return NextResponse.json(user);
  } catch (error) {
    return apiErrorResponse(error, "api/admin/users:disable");
  }
}
