import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";
import { agentForStatus } from "@/lib/server/tasks";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  try {
    const assignedAgent = await agentForStatus("discarded");
    const job = await prisma.articleJob.update({
      where: { jobId },
      data: {
        status: "discarded",
        currentStage: "Encerrado",
        assignedAgentId: assignedAgent?.id ?? undefined
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

    await dispatchOpenClawCommand({
      type: "task_cancel",
      jobId,
      agentId: job.assignedAgentId,
      payload: {
        jobId,
        status: "discarded",
        assignedAgentId: job.assignedAgentId,
        agentSlug: assignedAgent?.slug,
        source: "techsouls-command-center"
      }
    });

    const updatedJob = await prisma.articleJob.findUnique({
      where: { jobId },
      include: { assignedAgent: true, humanReviews: { orderBy: { createdAt: "desc" }, take: 1 }, sources: { take: 2 } }
    });

    return NextResponse.json(updatedJob);
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
