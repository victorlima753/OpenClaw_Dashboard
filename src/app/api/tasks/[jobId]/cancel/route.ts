import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  try {
    const job = await prisma.articleJob.update({
      where: { jobId },
      data: {
        status: "discarded",
        currentStage: "Encerrado"
      }
    });

    await createAuditLog({
      jobId,
      agentId: job.assignedAgentId,
      eventType: "task_cancelled",
      severity: "warning",
      stage: "Encerrado",
      decision: "discarded",
      message: `Job ${jobId} cancelado manualmente.`
    });

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.cancelTask(jobId);
      return job
        ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } })
        : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
