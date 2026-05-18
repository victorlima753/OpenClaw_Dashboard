import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { apiErrorResponse } from "@/lib/server/api-error";
import { deriveAgentWorkStatus } from "@/lib/server/agent-state";
import { RUNNING_STATUSES } from "@/lib/domain";

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

    const runningJobs = await prisma.articleJob.findMany({
      where: {
        assignedAgentId: { in: agents.map((agent) => agent.id) },
        status: { in: RUNNING_STATUSES as never[] }
      },
      orderBy: { updatedAt: "desc" }
    });
    const activeJobByAgentId = new Map<string, (typeof runningJobs)[number]>();
    for (const job of runningJobs) {
      if (job.assignedAgentId && !activeJobByAgentId.has(job.assignedAgentId)) {
        activeJobByAgentId.set(job.assignedAgentId, job);
      }
    }

    return NextResponse.json(
      agents.map((agent) => {
        const activeJob = activeJobByAgentId.get(agent.id) ?? null;
        return {
          ...agent,
          status: deriveAgentWorkStatus(agent, activeJob),
          currentTaskId: activeJob?.jobId ?? null,
          currentTask: activeJob
        };
      })
    );
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.listAgents(), { headers: { "x-techsouls-data-source": "mock" } });
    }
    return apiErrorResponse(error, "api/agents");
  }
}
