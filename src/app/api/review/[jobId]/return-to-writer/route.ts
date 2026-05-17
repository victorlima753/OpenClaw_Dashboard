import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { reviewDecisionSchema } from "@/lib/validation/schemas";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const body = reviewDecisionSchema.parse(await request.json().catch(() => ({})));

  try {
    await prisma.humanReview.updateMany({
      where: { jobId, status: "pending" },
      data: {
        status: "returned_to_writer",
        decision: "returned_to_writer",
        reviewerComment: body.comment ?? null
      }
    });

    const job = await prisma.articleJob.update({
      where: { jobId },
      data: { status: "writing", currentStage: "Writer", requiresHumanReview: false }
    });

    await createAuditLog({
      jobId,
      eventType: "returned_to_writer",
      severity: "warning",
      stage: "Human Review",
      decision: "returned_to_writer",
      message: `Job ${jobId} devolvido para Writer.`,
      inputPayload: body
    });

    await dispatchOpenClawCommand({
      type: "human_review_return_to_writer",
      jobId,
      payload: { jobId, comment: body.comment, nextStatus: "writing", source: "techsouls-command-center" }
    });

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.reviewDecision(jobId, "return-to-writer", body.comment);
      return job ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } }) : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
