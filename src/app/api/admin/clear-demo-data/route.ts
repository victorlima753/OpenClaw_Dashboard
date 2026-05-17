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
      const demoJobs = await tx.articleJob.findMany({
        where: { dataSource: "seed" },
        select: { jobId: true }
      });
      const demoJobIds = demoJobs.map((job) => job.jobId);
      const jobFilter = { in: demoJobIds };
      const payloadSnapshots = await tx.payloadSnapshot.deleteMany({ where: { jobId: jobFilter } });
      const humanReviews = await tx.humanReview.deleteMany({ where: { jobId: jobFilter } });
      const sources = await tx.source.deleteMany({ where: { jobId: jobFilter } });
      const agentLogs = await tx.agentLog.deleteMany({ where: { jobId: jobFilter } });
      const articleJobs = await tx.articleJob.deleteMany({ where: { dataSource: "seed" } });
      const agents = await tx.agent.updateMany({
        where: { currentTaskId: jobFilter },
        data: {
          currentTaskId: null
        }
      });

      return {
        articleJobs: articleJobs.count,
        agentLogs: agentLogs.count,
        payloadSnapshots: payloadSnapshots.count,
        sources: sources.count,
        humanReviews: humanReviews.count,
        agentsReset: agents.count,
        scope: "seed"
      };
    });

    await createAuditLog({
      eventType: "webhook_received",
      severity: "warning",
      stage: "Admin",
      decision: "clear_demo_data",
      message: "Dados demo/seed removidos pelo administrador; jobs reais OpenClaw e manuais foram preservados.",
      outputPayload: counts
    });

    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    return apiErrorResponse(error, "api/admin/clear-demo-data");
  }
}
