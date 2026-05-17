import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mockQueueAdapter } from "@/lib/adapters/mock";
import { createAuditLog } from "@/lib/server/audit";
import type { ArticleJobDto } from "@/lib/types";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  try {
    const job = await prisma.articleJob.update({
      where: { jobId },
      data: {
        status: "new",
        currentStage: "Entrada",
        errorMessage: null,
        requiresHumanReview: false
      },
      include: { assignedAgent: true }
    });

    const queueResult = await mockQueueAdapter.retry(job as unknown as ArticleJobDto);

    await createAuditLog({
      jobId,
      agentId: job.assignedAgentId,
      eventType: "task_retried",
      severity: "warning",
      stage: "Entrada",
      decision: "retry",
      message: `Retry manual enviado para ${jobId}.`,
      outputPayload: queueResult
    });

    return NextResponse.json({ job, queueResult });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const result = mockStore.retryTask(jobId);
      return result
        ? NextResponse.json(result, { headers: { "x-techsouls-data-source": "mock" } })
        : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
