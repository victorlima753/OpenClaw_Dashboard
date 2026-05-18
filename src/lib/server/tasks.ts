import { prisma } from "@/lib/prisma";
import { JOB_STATUS_META } from "@/lib/domain";
import type { JobStatus } from "@/lib/types";
import { createAuditLog } from "./audit";
import { dispatchOpenClawCommand } from "./openclaw-events";
import { reconcileAgentsForJobChange } from "./agent-state";

const statusAgentSlug: Partial<Record<JobStatus, string>> = {
  new: "techsouls-trend-editorial",
  researching: "techsouls-researcher",
  relevance_scoring: "techsouls-relevance-score",
  clustering: "techsouls-news-clustering",
  validating: "techsouls-fact-check",
  writing: "techsouls-blog-writer",
  seo_optimizing: "techsouls-seo",
  affiliate_routing: "techsouls-affiliate-router",
  copywriting: "techsouls-copywriter",
  editing: "techsouls-final-editor",
  compliance_checking: "techsouls-compliance",
  publishing: "techsouls-wordpress-publisher",
  drafted: "techsouls-wordpress-publisher",
  published: "techsouls-wordpress-publisher",
  human_review: "techsouls-orchestrator",
  failed: "techsouls-audit-log",
  discarded: "techsouls-audit-log"
};

export function jobStatusToStage(status: JobStatus) {
  return JOB_STATUS_META[status].stage;
}

export async function agentForStatus(status: JobStatus) {
  const slug = statusAgentSlug[status];
  if (!slug) return null;
  const agent = await prisma.agent.findFirst({ where: { slug } });
  if (agent) return agent;
  if (status === "new") return prisma.agent.findFirst({ where: { slug: "techsouls-orchestrator" } });
  return null;
}

export async function updateJobStatus(jobId: string, status: JobStatus, reason?: string) {
  const previousJob = await prisma.articleJob.findUnique({
    where: { jobId },
    select: { assignedAgentId: true }
  });
  const assignedAgent = await agentForStatus(status);
  const job = await prisma.articleJob.update({
    where: { jobId },
    data: {
      status,
      currentStage: jobStatusToStage(status),
      assignedAgentId: assignedAgent?.id ?? undefined,
      requiresHumanReview: status === "human_review",
      errorMessage: status === "failed" ? reason ?? "Falha registrada manualmente." : undefined
    }
  });

  const pendingReview = await prisma.humanReview.findFirst({ where: { jobId, status: "pending" } });
  if (status === "human_review") {
    const reviewReason = reason ?? "Revisao humana solicitada manualmente no Kanban.";
    if (pendingReview) {
      await prisma.humanReview.update({
        where: { id: pendingReview.id },
        data: {
          reason: reviewReason,
          decision: null,
          reviewerComment: null
        }
      });
    } else {
      await prisma.humanReview.create({
        data: {
          jobId,
          status: "pending",
          reason: reviewReason
        }
      });
    }
  } else if (pendingReview && ["publishing", "published"].includes(status)) {
    await prisma.humanReview.update({
      where: { id: pendingReview.id },
      data: {
        status: "approved",
        decision: "approved",
        reviewerComment: reason ?? "Aprovado manualmente no Kanban."
      }
    });
  } else if (pendingReview && status === "drafted") {
    await prisma.humanReview.update({
      where: { id: pendingReview.id },
      data: {
        status: "approved",
        decision: "drafted",
        reviewerComment: reason ?? "Salvo como rascunho pelo Kanban."
      }
    });
  } else if (pendingReview && ["discarded", "failed"].includes(status)) {
    await prisma.humanReview.update({
      where: { id: pendingReview.id },
      data: {
        status: "rejected",
        decision: status,
        reviewerComment: reason ?? "Encerrado manualmente no Kanban."
      }
    });
  }

  await reconcileAgentsForJobChange(previousJob?.assignedAgentId, job.assignedAgentId);

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
    payload: {
      jobId,
      status,
      reason,
      assignedAgentId: assignedAgent?.id,
      agentSlug: assignedAgent?.slug,
      source: "techsouls-command-center"
    }
  });

  return prisma.articleJob.findUnique({
    where: { jobId },
    include: {
      assignedAgent: true,
      humanReviews: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
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
