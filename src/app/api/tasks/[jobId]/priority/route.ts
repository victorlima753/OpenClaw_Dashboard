import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { priorityUpdateSchema } from "@/lib/validation/schemas";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const body = priorityUpdateSchema.parse(await request.json());
  try {
    const job = await prisma.articleJob.update({
      where: { jobId },
      data: { priority: body.priority },
      include: {
        assignedAgent: true,
        humanReviews: { orderBy: { createdAt: "desc" }, take: 1 },
        sources: { take: 2 }
      }
    });

    await createAuditLog({
      jobId,
      agentId: job.assignedAgentId,
      eventType: "priority_changed",
      severity: "info",
      stage: job.currentStage,
      decision: body.priority,
      message: `Prioridade de ${jobId} alterada para ${body.priority}.`
    });

    await dispatchOpenClawCommand({
      type: "task_priority",
      jobId,
      agentId: job.assignedAgentId,
      payload: { jobId, priority: body.priority, source: "techsouls-command-center" }
    });

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.setPriority(jobId, body.priority);
      return job
        ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } })
        : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    return apiErrorResponse(error, "api/tasks/priority");
  }
}
