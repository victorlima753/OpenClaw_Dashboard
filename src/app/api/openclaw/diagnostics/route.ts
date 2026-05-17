import { NextResponse } from "next/server";
import { isRealOpenClawEnabled } from "@/lib/adapters/openclaw";
import { prisma } from "@/lib/prisma";
import { extractOpenClawAgents } from "@/lib/server/openclaw-events";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function agentMap() {
  try {
    return process.env.OPENCLAW_AGENT_MAP_JSON ? (JSON.parse(process.env.OPENCLAW_AGENT_MAP_JSON) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function settingRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

export async function GET() {
  try {
    const [agents, latestOpenClawLog, latestSyncLog, workerSetting, openClawJobCount, seedJobCount, manualJobCount, latestJobs, recentLogs] =
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
        prisma.systemSetting.findUnique({ where: { key: "openclaw_worker_status" } }),
        prisma.articleJob.count({ where: { dataSource: "openclaw" } }),
        prisma.articleJob.count({ where: { dataSource: "seed" } }),
        prisma.articleJob.count({ where: { dataSource: "manual" } }),
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
        })
      ]);

    const latestOpenClawAt = latestOpenClawLog?.createdAt.getTime() ?? 0;
    const gatewayConnected =
      isRealOpenClawEnabled() && latestOpenClawAt > 0 && Date.now() - latestOpenClawAt < 10 * 60_000;
    const workerValue = settingRecord(workerSetting?.value);
    const workerLastSeenAt = stringValue(workerValue.lastSeenAt);
    const workerLastSeenMs = workerLastSeenAt ? new Date(workerLastSeenAt).getTime() : 0;
    const workerConnected = workerLastSeenMs > 0 && Date.now() - workerLastSeenMs < 2 * 60_000;

    const discoveredExternalIds = extractOpenClawAgents(latestSyncLog?.inputPayload)
      .map((agent) => agent.externalId)
      .filter((externalId): externalId is string => Boolean(externalId));
    const knownExternalIds = new Set([
      ...agents.map((agent) => agent.externalId).filter((externalId): externalId is string => Boolean(externalId)),
      ...Object.values(agentMap())
    ]);
    const unmappedExternalIds = [...new Set(discoveredExternalIds.filter((externalId) => !knownExternalIds.has(externalId)))];

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
      agents: {
        mapped: agents.filter((agent) => agent.externalId).length,
        unmappedExternalIds,
        rows: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          slug: agent.slug,
          externalId: agent.externalId,
          openClawEnabled: agent.openClawEnabled,
          status: agent.status,
          lastOpenClawSyncAt: agent.lastOpenClawSyncAt?.toISOString() ?? null,
          lastActivityAt: agent.lastActivityAt?.toISOString() ?? null
        }))
      },
      jobs: {
        openClaw: openClawJobCount,
        seed: seedJobCount,
        manual: manualJobCount,
        latest: latestJobs
      },
      recentLogs
    });
  } catch (error) {
    return apiErrorResponse(error, "api/openclaw/diagnostics");
  }
}
