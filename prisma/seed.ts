import { Prisma } from "@prisma/client";
import {
  seedAgents,
  seedJobs,
  seedLogs,
  seedPayloads,
  seedReviews,
  seedSettings,
  seedSources
} from "../src/lib/mock/seed-data";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.agentLog.deleteMany();
  await prisma.payloadSnapshot.deleteMany();
  await prisma.humanReview.deleteMany();
  await prisma.source.deleteMany();
  await prisma.articleJob.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.systemSetting.deleteMany();

  const agentsBySlug = new Map<string, string>();

  for (const agent of seedAgents) {
    const created = await prisma.agent.create({
      data: {
        name: agent.name,
        slug: agent.slug,
        description: agent.description,
        skillName: agent.skillName,
        status: agent.status,
        currentTaskId: agent.currentTaskId ?? null,
        totalTasksProcessed: agent.totalTasksProcessed,
        successCount: agent.successCount,
        failureCount: agent.failureCount,
        averageProcessingTimeMs: agent.averageProcessingTimeMs,
        lastHeartbeatAt: new Date(Date.now() - Math.floor(Math.random() * 900_000)),
        lastActivityAt: new Date(Date.now() - Math.floor(Math.random() * 1_800_000))
      }
    });
    agentsBySlug.set(agent.slug, created.id);
  }

  for (const job of seedJobs) {
    await prisma.articleJob.create({
      data: {
        jobId: job.jobId,
        title: job.title,
        topic: job.topic,
        category: job.category,
        sourceName: job.sourceName,
        sourceUrl: job.sourceUrl,
        clusterId: job.clusterId ?? null,
        currentStage: job.currentStage,
        status: job.status,
        priority: job.priority,
        assignedAgentId: job.assignedAgentSlug ? agentsBySlug.get(job.assignedAgentSlug) : null,
        relevanceScore: job.relevanceScore ?? null,
        validationScore: job.validationScore ?? null,
        editorialScore: job.editorialScore ?? null,
        seoScore: job.seoScore ?? null,
        complianceScore: job.complianceScore ?? null,
        monetizationScore: job.monetizationScore ?? null,
        hasAffiliate: job.hasAffiliate,
        requiresHumanReview: job.requiresHumanReview,
        wordpressPostId: job.wordpressPostId ?? null,
        wordpressPreviewUrl: job.wordpressPreviewUrl ?? null,
        errorMessage: job.errorMessage ?? null,
        articleMarkdown: job.articleMarkdown ?? null,
        createdAt: job.createdAt
      }
    });
  }

  for (const source of seedSources) {
    await prisma.source.create({ data: source });
  }

  for (const payload of seedPayloads) {
    await prisma.payloadSnapshot.create({
      data: {
        jobId: payload.jobId,
        stage: payload.stage,
        agentId: payload.agentSlug ? agentsBySlug.get(payload.agentSlug) : null,
        inputPayload: payload.inputPayload as Prisma.InputJsonValue,
        outputPayload: payload.outputPayload as Prisma.InputJsonValue,
        inputHash: payload.inputHash,
        outputHash: payload.outputHash,
        createdAt: payload.createdAt
      }
    });
  }

  for (const review of seedReviews) {
    await prisma.humanReview.create({ data: review });
  }

  for (const log of seedLogs) {
    await prisma.agentLog.create({
      data: {
        jobId: log.jobId ?? null,
        agentId: log.agentSlug ? agentsBySlug.get(log.agentSlug) : null,
        eventType: log.eventType as never,
        severity: log.severity,
        stage: log.stage ?? null,
        decision: log.decision ?? null,
        score: log.score ?? null,
        message: log.message,
        inputPayload: (log.inputPayload ?? undefined) as Prisma.InputJsonValue | undefined,
        outputPayload: (log.outputPayload ?? undefined) as Prisma.InputJsonValue | undefined,
        errorPayload: (log.errorPayload ?? undefined) as Prisma.InputJsonValue | undefined,
        createdAt: log.createdAt
      }
    });
  }

  for (const setting of seedSettings) {
    await prisma.systemSetting.create({
      data: { key: setting.key, value: setting.value as Prisma.InputJsonValue }
    });
  }

  console.log(
    `Seed completo: ${seedAgents.length} agentes, ${seedJobs.length} jobs, ${seedLogs.length} logs.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
