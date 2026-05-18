import { RUNNING_STATUSES } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import type { AgentStatus } from "@/lib/types";

type AgentStateInput = {
  status: AgentStatus;
};

type ActiveJobInput = {
  jobId: string;
} | null;

type ReconcileOptions = {
  wakeOffline?: boolean;
  clearPaused?: boolean;
  clearError?: boolean;
};

const runningStatuses = RUNNING_STATUSES as never[];

export function deriveAgentWorkStatus(
  agent: AgentStateInput,
  activeJob: ActiveJobInput,
  options: ReconcileOptions = {}
): AgentStatus {
  if (agent.status === "error" && !options.clearError) return "error";
  if (agent.status === "paused" && !options.clearPaused) return "paused";
  if (agent.status === "offline" && !options.wakeOffline) return "offline";
  return activeJob ? "busy" : "idle";
}

export async function activeRunningJobForAgent(agentId: string) {
  return prisma.articleJob.findFirst({
    where: {
      assignedAgentId: agentId,
      status: { in: runningStatuses }
    },
    orderBy: { updatedAt: "desc" },
    select: {
      jobId: true,
      title: true,
      status: true,
      updatedAt: true
    }
  });
}

export async function reconcileAgentWorkState(agentId?: string | null, options: ReconcileOptions = {}) {
  if (!agentId) return null;
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;

  const activeJob = await activeRunningJobForAgent(agent.id);
  return prisma.agent.update({
    where: { id: agent.id },
    data: {
      currentTaskId: activeJob?.jobId ?? null,
      status: deriveAgentWorkStatus(agent, activeJob, options)
    }
  });
}

export async function reconcileAgentsForJobChange(...agentIds: Array<string | null | undefined>) {
  const uniqueAgentIds = [...new Set(agentIds.filter((agentId): agentId is string => Boolean(agentId)))];
  await Promise.all(uniqueAgentIds.map((agentId) => reconcileAgentWorkState(agentId)));
}
