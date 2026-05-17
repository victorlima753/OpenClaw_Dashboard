import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { reviewDecisionSchema } from "@/lib/validation/schemas";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const body = reviewDecisionSchema.parse(await request.json().catch(() => ({})));

  try {
    await prisma.humanReview.updateMany({
      where: { jobId, status: "pending" },
      data: { status: "rejected", decision: "rejected", reviewerComment: body.comment ?? null }
    });

    const job = await prisma.articleJob.update({
      where: { jobId },
      data: { status: "discarded", currentStage: "Encerrado", requiresHumanReview: false }
    });

    await createAuditLog({
      jobId,
      eventType: "review_rejected",
      severity: "warning",
      stage: "Human Review",
      decision: "rejected",
      message: `Revisao humana rejeitou ${jobId}.`,
      inputPayload: body
    });

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.reviewDecision(jobId, "reject", body.comment);
      return job ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } }) : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
