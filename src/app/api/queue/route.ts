import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await prisma.articleJob.findMany({
      where: {
        status: { in: ["new", "failed", "human_review"] }
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: {
        assignedAgent: true,
        payloadSnapshots: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    return NextResponse.json(
      jobs.map((job, index) => ({
        ...job,
        attempts: job.status === "failed" ? 3 : index % 3,
        retryDelaySeconds: job.status === "failed" ? 300 : 0,
        nextAgent: job.assignedAgent?.name ?? "Orchestrator"
      }))
    );
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.queue(), { headers: { "x-techsouls-data-source": "mock" } });
    }
    return apiErrorResponse(error, "api/queue");
  }
}
