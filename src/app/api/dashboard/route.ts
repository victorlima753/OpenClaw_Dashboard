import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_META, RUNNING_STATUSES } from "@/lib/domain";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [agents, jobs, recentLogs, criticalAlerts] = await Promise.all([
      prisma.agent.findMany(),
      prisma.articleJob.findMany({ include: { assignedAgent: true } }),
      prisma.agentLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          agent: { select: { id: true, name: true, slug: true } },
          job: { select: { jobId: true, title: true, status: true } }
        }
      }),
      prisma.agentLog.findMany({
        where: { severity: { in: ["error", "critical"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          agent: { select: { id: true, name: true, slug: true } },
          job: { select: { jobId: true, title: true, status: true } }
        }
      })
    ]);

    const completed = jobs.filter((job) => ["published", "drafted"].includes(job.status)).length;
    const failed = jobs.filter((job) => job.status === "failed").length;
    const totalTerminal = completed + failed;
    const averageProcessingTimeMs =
      agents.reduce((sum, agent) => sum + agent.averageProcessingTimeMs, 0) / Math.max(1, agents.length);

    const tasksByStatus = Object.entries(
      jobs.reduce<Record<string, number>>((acc, job) => {
        acc[job.status] = (acc[job.status] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([status, total]) => ({
      status,
      total,
      label: JOB_STATUS_META[status as keyof typeof JOB_STATUS_META].label
    }));

    const tasksByAgent = Object.entries(
      jobs.reduce<Record<string, number>>((acc, job) => {
        const name = job.assignedAgent?.name ?? "Sem agente";
        acc[name] = (acc[name] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([agent, total]) => ({ agent, total }));

    return NextResponse.json({
      totalAgents: agents.length,
      agentsOnline: agents.filter((agent) => ["online", "busy", "idle"].includes(agent.status)).length,
      agentsBusy: agents.filter((agent) => agent.status === "busy").length,
      agentsOffline: agents.filter((agent) => agent.status === "offline").length,
      agentsError: agents.filter((agent) => agent.status === "error").length,
      queuedTasks: jobs.filter((job) => job.status === "new").length,
      runningTasks: jobs.filter((job) => RUNNING_STATUSES.includes(job.status)).length,
      humanReviewTasks: jobs.filter((job) => job.status === "human_review").length,
      publishedToday: jobs.filter((job) => job.status === "published" && job.updatedAt >= startOfDay).length,
      draftedTasks: jobs.filter((job) => job.status === "drafted").length,
      failedTasks: failed,
      successRate: totalTerminal === 0 ? 100 : (completed / totalTerminal) * 100,
      averageProcessingTimeMs,
      tasksByStatus,
      tasksByAgent,
      recentLogs,
      criticalAlerts
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.dashboard(), { headers: { "x-techsouls-data-source": "mock" } });
    }
    throw error;
  }
}
