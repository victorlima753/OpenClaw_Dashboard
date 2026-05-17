import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

const CONFIRMATION = "CLEAR_DEMO_DATA";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== CONFIRMATION) {
    return NextResponse.json(
      { error: `Envie confirm="${CONFIRMATION}" para limpar os dados demo.` },
      { status: 400 }
    );
  }

  try {
    const counts = await prisma.$transaction(async (tx) => {
      const payloadSnapshots = await tx.payloadSnapshot.deleteMany();
      const humanReviews = await tx.humanReview.deleteMany();
      const sources = await tx.source.deleteMany();
      const agentLogs = await tx.agentLog.deleteMany();
      const articleJobs = await tx.articleJob.deleteMany();
      const agents = await tx.agent.updateMany({
        data: {
          currentTaskId: null,
          totalTasksProcessed: 0,
          successCount: 0,
          failureCount: 0,
          averageProcessingTimeMs: 0
        }
      });

      return {
        articleJobs: articleJobs.count,
        agentLogs: agentLogs.count,
        payloadSnapshots: payloadSnapshots.count,
        sources: sources.count,
        humanReviews: humanReviews.count,
        agentsReset: agents.count
      };
    });

    await createAuditLog({
      eventType: "webhook_received",
      severity: "warning",
      stage: "Admin",
      decision: "clear_demo_data",
      message: "Dados demo removidos pelo administrador.",
      outputPayload: counts
    });

    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    return apiErrorResponse(error, "api/admin/clear-demo-data");
  }
}
