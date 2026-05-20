import { NextResponse } from "next/server";
import { isRealOpenClawEnabled } from "@/lib/adapters/openclaw";
import { prisma } from "@/lib/prisma";
import { extractOpenClawAgents, ignoredOpenClawAgentIds, openClawAgentMap } from "@/lib/server/openclaw-events";
import { apiErrorResponse } from "@/lib/server/api-error";
import { RUNNING_STATUSES } from "@/lib/domain";
import { deriveAgentWorkStatus } from "@/lib/server/agent-state";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function mappedExternalIds() {
  return Object.values(openClawAgentMap()).flat();
}

function settingRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

export async function GET() {
  try {
    const [
      agents,
      latestOpenClawLog,
      latestSyncLog,
      latestWebhookLog,
      webhookCount,
      webhookByAgentRaw,
      jobsByStatusRaw,
      latestWebhookError,
      workerSetting,
      latestWebhookSetting,
      duplicateSetting,
      latestWebhookErrorSetting,
      openClawJobCount,
      seedJobCount,
      manualJobCount,
      n8nJobCount,
      wordpressJobCount,
      inoreaderJobCount,
      activeAlerts,
      latestJobs,
      recentLogs,
      runningJobs
    ] =
      await Promise.all([
        prisma.agent.findMany({ orderBy: { name: "asc" } }),
        prisma.agentLog.findFirst({
          where: { message: { contains: "OpenClaw", mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, message: true, severity: true }
        }),
        prisma.agentLog.findFirst({
          where: { stage: "OpenClaw sync" },
          orderBy: { createdAt: "desc" },
          select: { inputPayload: true, outputPayload: true, createdAt: true }
        }),
        prisma.agentLog.findFirst({
          where: { stage: "OpenClaw webhook" },
          orderBy: { createdAt: "desc" },
          include: {
            agent: { select: { id: true, name: true, slug: true } },
            job: { select: { jobId: true, title: true, status: true } }
          }
        }),
        prisma.agentLog.count({ where: { stage: "OpenClaw webhook" } }),
        prisma.agentLog.groupBy({
          by: ["agentId"],
          where: { stage: "OpenClaw webhook" },
          _count: { _all: true }
        }),
        prisma.articleJob.groupBy({
          by: ["status"],
          where: { dataSource: "openclaw" },
          _count: { _all: true }
        }),
        prisma.agentLog.findFirst({
          where: { stage: "OpenClaw webhook", severity: { in: ["error", "critical", "warning"] } },
          orderBy: { createdAt: "desc" },
          include: {
            agent: { select: { id: true, name: true, slug: true } },
            job: { select: { jobId: true, title: true, status: true } }
          }
        }),
        prisma.systemSetting.findUnique({ where: { key: "openclaw_worker_status" } }),
        prisma.systemSetting.findUnique({ where: { key: "openclaw_latest_webhook" } }),
        prisma.systemSetting.findUnique({ where: { key: "openclaw_webhook_duplicate_count" } }),
        prisma.systemSetting.findUnique({ where: { key: "openclaw_latest_webhook_error" } }),
        prisma.articleJob.count({ where: { dataSource: "openclaw" } }),
        prisma.articleJob.count({ where: { dataSource: "seed" } }),
        prisma.articleJob.count({ where: { dataSource: "manual" } }),
        prisma.articleJob.count({ where: { dataSource: "n8n" } }),
        prisma.articleJob.count({ where: { dataSource: "wordpress" } }),
        prisma.articleJob.count({ where: { dataSource: "inoreader" } }),
        prisma.systemAlert.findMany({
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 8
        }),
        prisma.articleJob.findMany({
          where: { dataSource: "openclaw" },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: { assignedAgent: true, sources: { take: 2 }, humanReviews: { take: 1 } }
        }),
        prisma.agentLog.findMany({
          where: { message: { contains: "OpenClaw", mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          take: 12,
          include: {
            agent: { select: { id: true, name: true, slug: true } },
            job: { select: { jobId: true, title: true, status: true } }
          }
        }),
        prisma.articleJob.findMany({
          where: {
            assignedAgentId: { not: null },
            status: { in: RUNNING_STATUSES as never[] }
          },
          orderBy: { updatedAt: "desc" },
          select: { jobId: true, assignedAgentId: true }
        })
      ]);

    const latestOpenClawAt = latestOpenClawLog?.createdAt.getTime() ?? 0;
    const gatewayConnected =
      isRealOpenClawEnabled() && latestOpenClawAt > 0 && Date.now() - latestOpenClawAt < 10 * 60_000;
    const workerValue = settingRecord(workerSetting?.value);
    const latestWebhookValue = settingRecord(latestWebhookSetting?.value);
    const duplicateValue = settingRecord(duplicateSetting?.value);
    const latestWebhookErrorValue = settingRecord(latestWebhookErrorSetting?.value);
    const workerLastSeenAt = stringValue(workerValue.lastSeenAt);
    const workerLastSeenMs = workerLastSeenAt ? new Date(workerLastSeenAt).getTime() : 0;
    const workerConnected = workerLastSeenMs > 0 && Date.now() - workerLastSeenMs < 2 * 60_000;

    const agentMap = openClawAgentMap();
    const discoveredExternalIds = extractOpenClawAgents(latestSyncLog?.inputPayload)
      .map((agent) => agent.externalId)
      .filter((externalId): externalId is string => Boolean(externalId));
    const discoveredExternalIdSet = new Set(discoveredExternalIds);
    const ignoredExternalIds = new Set(ignoredOpenClawAgentIds());
    const knownExternalIds = new Set([
      ...agents.map((agent) => agent.externalId).filter((externalId): externalId is string => Boolean(externalId)),
      ...mappedExternalIds()
    ]);
    const unmappedExternalIds = [
      ...new Set(
        discoveredExternalIds.filter((externalId) => !knownExternalIds.has(externalId) && !ignoredExternalIds.has(externalId))
      )
    ];
    const activeJobByAgentId = new Map<string, (typeof runningJobs)[number]>();
    for (const job of runningJobs) {
      if (job.assignedAgentId && !activeJobByAgentId.has(job.assignedAgentId)) {
        activeJobByAgentId.set(job.assignedAgentId, job);
      }
    }
    const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));
    const webhookByAgent = webhookByAgentRaw.map((row) => ({
      agentId: row.agentId,
      agentName: row.agentId ? agentNameById.get(row.agentId) ?? "Agente removido" : "Sem agente",
      total: row._count._all
    }));
    const webhookByStatus = jobsByStatusRaw.map((row) => ({
      status: row.status,
      total: row._count._all
    }));

    return NextResponse.json({
      gateway: {
        realEnabled: isRealOpenClawEnabled(),
        connected: gatewayConnected,
        label: !isRealOpenClawEnabled()
          ? "OpenClaw real desativado"
          : gatewayConnected
            ? "Gateway conectado"
            : "Gateway sem evento recente",
        lastSeenAt: latestOpenClawLog?.createdAt.toISOString() ?? null,
        lastMessage: latestOpenClawLog?.message ?? null
      },
      worker: {
        connected: workerConnected,
        lastSeenAt: workerLastSeenAt ?? null,
        lastMessage: stringValue(workerValue.message) ?? null
      },
      webhook: {
        configured: Boolean(process.env.OPENCLAW_WEBHOOK_SECRET),
        receivedCount: webhookCount,
        duplicateCount: typeof duplicateValue.count === "number" ? duplicateValue.count : 0,
        latestReceivedAt:
          stringValue(latestWebhookValue.receivedAt) ?? latestWebhookLog?.createdAt.toISOString() ?? null,
        latestEvent: stringValue(latestWebhookValue.event) ?? null,
        latestJobId: stringValue(latestWebhookValue.jobId) ?? latestWebhookLog?.jobId ?? null,
        latestAgentKey: stringValue(latestWebhookValue.agentKey) ?? null,
        latestError: latestWebhookError
          ? {
              id: latestWebhookError.id,
              jobId: latestWebhookError.jobId,
              agentId: latestWebhookError.agentId,
              eventType: latestWebhookError.eventType,
              severity: latestWebhookError.severity,
              stage: latestWebhookError.stage,
              decision: latestWebhookError.decision,
              score: latestWebhookError.score,
              message: latestWebhookError.message,
              inputPayload: latestWebhookError.inputPayload,
              outputPayload: latestWebhookError.outputPayload,
              errorPayload: latestWebhookError.errorPayload,
              createdAt: latestWebhookError.createdAt.toISOString(),
              agent: latestWebhookError.agent,
              job: latestWebhookError.job
            }
          : latestWebhookErrorValue.kind
            ? {
                id: "setting-openclaw-latest-webhook-error",
                jobId: null,
                agentId: null,
                eventType: "webhook_received",
                severity: "warning",
                stage: "OpenClaw webhook",
                decision: stringValue(latestWebhookErrorValue.kind) ?? "invalid_payload",
                score: null,
                message: "Ultimo problema de webhook registrado.",
                inputPayload: latestWebhookErrorValue,
                outputPayload: null,
                errorPayload: null,
                createdAt: stringValue(latestWebhookErrorValue.receivedAt) ?? new Date().toISOString(),
                agent: null,
                job: null
              }
            : null,
        byAgent: webhookByAgent,
        byStatus: webhookByStatus,
        latestLog: latestWebhookLog,
        curlExample: [
          "curl -X POST \"$PUBLIC_APP_URL/api/webhooks/openclaw/task-update\" \\",
          "  -H \"Authorization: Bearer [OPENCLAW_WEBHOOK_SECRET]\" \\",
          "  -H \"Content-Type: application/json\" \\",
          "  -d '{\"event\":\"article_written\",\"jobId\":\"ts-openclaw-demo-0001\",\"agentExternalId\":\"writer\",\"status\":\"seo_optimizing\",\"completedStage\":\"writing\",\"idempotencyKey\":\"writer:ts-openclaw-demo-0001:article_written:1\",\"payload\":{\"title\":\"Demo\",\"topic\":\"OpenClaw\",\"category\":\"IA\",\"sourceName\":\"TechSouls\",\"sourceUrl\":\"https://techsouls.com.br/\",\"articleMarkdown\":\"Conteudo demo\"}}'"
        ].join("\n")
      },
      agents: {
        mapped: agents.filter((agent) => agent.externalId).length,
        unmappedExternalIds,
        rows: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          slug: agent.slug,
          externalId: agent.externalId,
          mappedExternalIds: agentMap[agent.slug] ?? [],
          discoveredExternalIds: (agentMap[agent.slug] ?? []).filter((externalId) => discoveredExternalIdSet.has(externalId)),
          openClawEnabled: agent.openClawEnabled,
          status: deriveAgentWorkStatus(agent, activeJobByAgentId.get(agent.id) ?? null),
          lastOpenClawSyncAt: agent.lastOpenClawSyncAt?.toISOString() ?? null,
          lastActivityAt: agent.lastActivityAt?.toISOString() ?? null
        }))
      },
      jobs: {
        openClaw: openClawJobCount,
        seed: seedJobCount,
        manual: manualJobCount,
        n8n: n8nJobCount,
        wordpress: wordpressJobCount,
        inoreader: inoreaderJobCount,
        latest: latestJobs
      },
      integrations: {
        n8nWebhookSecretConfigured: Boolean(process.env.N8N_WEBHOOK_SECRET),
        wordpressWebhookSecretConfigured: Boolean(process.env.WORDPRESS_WEBHOOK_SECRET),
        inoreaderWebhookSecretConfigured: Boolean(process.env.INOREADER_WEBHOOK_SECRET),
        alertWebhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL)
      },
      alerts: {
        activeCount: activeAlerts.length,
        latest: activeAlerts
      },
      recentLogs
    });
  } catch (error) {
    return apiErrorResponse(error, "api/openclaw/diagnostics");
  }
}
