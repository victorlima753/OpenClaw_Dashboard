import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { reviewDecisionSchema } from "@/lib/validation/schemas";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";
import { updateJobStatus } from "@/lib/server/tasks";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const body = reviewDecisionSchema.parse(await request.json().catch(() => ({})));

  try {
    await prisma.humanReview.updateMany({
      where: { jobId, status: "pending" },
      data: {
        status: "returned_to_validator",
        decision: "returned_to_validator",
        reviewerComment: body.comment ?? null
      }
    });

    const job = await updateJobStatus(jobId, "validating", body.comment ?? "Devolvido ao Validator em revisao humana.");

    await createAuditLog({
      jobId,
      eventType: "returned_to_validator",
      severity: "warning",
      stage: "Human Review",
      decision: "returned_to_validator",
      message: `Job ${jobId} devolvido para Validator.`,
      inputPayload: body
    });

    await dispatchOpenClawCommand({
      type: "human_review_return_to_validator",
      jobId,
      payload: { jobId, comment: body.comment, nextStatus: "validating", source: "techsouls-command-center" }
    });

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.reviewDecision(jobId, "return-to-validator", body.comment);
      return job ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } }) : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
