import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(request);
    const { id } = await params;
    const alert = await prisma.systemAlert.update({
      where: { id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: session?.email ?? session?.username ?? null
      }
    });

    await createAuditLog({
      eventType: "webhook_received",
      severity: "info",
      stage: "Alerts",
      decision: "acknowledged",
      message: `Alerta reconhecido: ${alert.title}`,
      outputPayload: { alertId: alert.id, acknowledgedBy: alert.acknowledgedBy }
    });

    return NextResponse.json(alert);
  } catch (error) {
    return apiErrorResponse(error, "api/alerts:ack");
  }
}
