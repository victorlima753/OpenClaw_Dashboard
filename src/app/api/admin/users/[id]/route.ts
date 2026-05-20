import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { normalizeEmail, userSelect } from "@/lib/auth/users";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  status: z.enum(["active", "disabled"]).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = updateUserSchema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.email ? { email: normalizeEmail(body.email) } : {}),
        ...(body.password ? { passwordHash: hashPassword(body.password) } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.status ? { status: body.status } : {})
      },
      select: userSelect
    });

    await createAuditLog({
      eventType: "webhook_received",
      severity: "info",
      stage: "RBAC",
      decision: "user_updated",
      message: `Usuario ${user.email} atualizado.`,
      outputPayload: { userId: user.id, email: user.email, role: user.role, status: user.status }
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Payload invalido.", issues: error.issues }, { status: 400 });
    return apiErrorResponse(error, "api/admin/users:update");
  }
}
