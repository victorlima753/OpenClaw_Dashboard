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
      data: { status: "approved", decision: "drafted", reviewerComment: body.comment ?? null }
    });

    const job = await prisma.articleJob.update({
      where: { jobId },
      data: { status: "drafted", currentStage: "WordPress", requiresHumanReview: false }
    });

    await createAuditLog({
      jobId,
      eventType: "drafted",
      severity: "info",
      stage: "Human Review",
      decision: "drafted",
      message: `Revisao humana salvou ${jobId} como rascunho.`,
      inputPayload: body
    });

    await dispatchOpenClawCommand({
      type: "human_review_drafted",
      jobId,
      payload: { jobId, comment: body.comment, nextStatus: "drafted", source: "techsouls-command-center" }
    });

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.reviewDecision(jobId, "draft", body.comment);
      return job ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } }) : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
