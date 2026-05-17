import { prisma } from "@/lib/prisma";
import { JOB_STATUS_META } from "@/lib/domain";
import type { JobStatus } from "@/lib/types";
import { createAuditLog } from "./audit";
import { dispatchOpenClawCommand } from "./openclaw-events";

export function jobStatusToStage(status: JobStatus) {
  return JOB_STATUS_META[status].stage;
}

export async function updateJobStatus(jobId: string, status: JobStatus, reason?: string) {
  const job = await prisma.articleJob.update({
    where: { jobId },
    data: {
      status,
      currentStage: jobStatusToStage(status),
      requiresHumanReview: status === "human_review" ? true : undefined,
      errorMessage: status === "failed" ? reason ?? "Falha registrada manualmente." : undefined
    }
  });

  await createAuditLog({
    jobId,
    agentId: job.assignedAgentId,
    eventType: "task_status_changed",
    severity: status === "failed" ? "error" : "info",
    stage: job.currentStage,
    decision: status,
    message: `Status alterado para ${status}${reason ? `: ${reason}` : "."}`,
    inputPayload: { jobId, status, reason }
  });

  await dispatchOpenClawCommand({
    type: "task_update",
    jobId,
    agentId: job.assignedAgentId,
    payload: { jobId, status, reason, source: "techsouls-command-center" }
  });

  return job;
}

export function jobRelations() {
  return {
    assignedAgent: true,
    sources: true,
    payloadSnapshots: {
      orderBy: { createdAt: "desc" as const }
    },
    humanReviews: {
      orderBy: { createdAt: "desc" as const }
    },
    logs: {
      orderBy: { createdAt: "desc" as const },
      take: 40,
      include: {
        agent: {
          select: { id: true, name: true, slug: true }
        }
      }
    }
  };
}
