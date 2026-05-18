import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { assignTaskSchema } from "@/lib/validation/schemas";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";
import { reconcileAgentsForJobChange } from "@/lib/server/agent-state";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const body = assignTaskSchema.parse(await request.json());
  try {
    const previousJob = await prisma.articleJob.findUnique({ where: { jobId }, select: { assignedAgentId: true } });
    const job = await prisma.articleJob.update({
      where: { jobId },
      data: { assignedAgentId: body.agentId },
      include: { assignedAgent: true }
    });
    await reconcileAgentsForJobChange(previousJob?.assignedAgentId, job.assignedAgentId);

    await createAuditLog({
      jobId,
      agentId: body.agentId,
      eventType: "task_assigned",
      severity: "info",
      stage: job.currentStage,
      decision: "assigned",
      message: `Job ${jobId} atribuido para ${job.assignedAgent?.name ?? body.agentId}.`
    });

    await dispatchOpenClawCommand({
      type: "task_assign",
      jobId,
      agentId: body.agentId,
      payload: {
        jobId,
        agentId: body.agentId,
        agentSlug: job.assignedAgent?.slug,
        source: "techsouls-command-center"
      }
    });

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.assignTask(jobId, body.agentId);
      return job
        ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } })
        : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
