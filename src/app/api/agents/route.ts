import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { name: "asc" },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3
        }
      }
    });

    const currentTaskIds = agents.map((agent) => agent.currentTaskId).filter(Boolean) as string[];
    const tasks = await prisma.articleJob.findMany({
      where: { jobId: { in: currentTaskIds } }
    });
    const tasksByJobId = new Map(tasks.map((task) => [task.jobId, task]));

    return NextResponse.json(
      agents.map((agent) => ({
        ...agent,
        currentTask: agent.currentTaskId ? tasksByJobId.get(agent.currentTaskId) ?? null : null
      }))
    );
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.listAgents(), { headers: { "x-techsouls-data-source": "mock" } });
    }
    return apiErrorResponse(error, "api/agents");
  }
}
