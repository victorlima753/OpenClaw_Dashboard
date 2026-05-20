import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { listUsers, normalizeEmail, userSelect } from "@/lib/auth/users";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer")
});

export async function GET() {
  try {
    return NextResponse.json(await listUsers());
  } catch (error) {
    return apiErrorResponse(error, "api/admin/users:list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createUserSchema.parse(await request.json());
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: normalizeEmail(body.email),
        passwordHash: hashPassword(body.password),
        role: body.role,
        status: "active"
      },
      select: userSelect
    });

    await createAuditLog({
      eventType: "webhook_received",
      severity: "info",
      stage: "RBAC",
      decision: "user_created",
      message: `Usuario ${user.email} criado com papel ${user.role}.`,
      outputPayload: { userId: user.id, email: user.email, role: user.role }
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Payload invalido.", issues: error.issues }, { status: 400 });
    return apiErrorResponse(error, "api/admin/users:create");
  }
}
