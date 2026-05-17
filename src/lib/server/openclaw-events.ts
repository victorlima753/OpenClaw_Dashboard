import { prisma } from "@/lib/prisma";
import { JOB_STATUS_META } from "@/lib/domain";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { createAuditLog } from "@/lib/server/audit";
import type { AgentStatus, JobStatus, LogSeverity } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

const agentStatuses: AgentStatus[] = ["online", "idle", "busy", "paused", "offline", "error"];
const jobStatuses = Object.keys(JOB_STATUS_META) as JobStatus[];
const severities: LogSeverity[] = ["info", "warning", "error", "critical"];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}

function recordEntries(value: unknown) {
  return isRecord(value) ? Object.entries(value) : [];
}

function normalizeStatus<T extends string>(value: unknown, allowed: readonly T[]) {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase().replaceAll("-", "_") as T;
  return allowed.includes(normalized) ? normalized : undefined;
}

function agentMap() {
  try {
    const raw = process.env.OPENCLAW_AGENT_MAP_JSON;
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function heartbeatStatus(agentId: string, payload: unknown): AgentStatus | undefined {
  const heartbeat = isRecord(payload) && isRecord(payload.heartbeats) ? payload.heartbeats[agentId] : undefined;
  if (!isRecord(heartbeat)) return undefined;
  const age = numberValue(heartbeat.age);
  if (age !== undefined) return age < 120_000 ? "online" : "offline";
  return "online";
}

function normalizeOpenClawAgent(agent: JsonRecord, fallbackId?: string, rootPayload?: unknown) {
  const id = stringValue(agent.id) ?? stringValue(agent.agentId) ?? stringValue(agent.slug) ?? fallbackId;
  const scheduleStatus =
    typeof agent.enabled === "boolean" ? (agent.enabled ? "online" : "offline") : undefined;
  return {
    externalId: id,
    slug: stringValue(agent.slug) ?? stringValue(agent.name) ?? id,
    name: stringValue(agent.name) ?? stringValue(agent.label) ?? stringValue(agent.slug) ?? id,
    status:
      normalizeStatus(agent.status ?? agent.state ?? agent.presence, agentStatuses) ??
      (id ? heartbeatStatus(id, rootPayload) : undefined) ??
      scheduleStatus,
    currentTaskId: stringValue(agent.currentTaskId) ?? stringValue(agent.jobId) ?? stringValue(agent.job_id),
    raw: agent
  };
}

function candidateArrays(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return [payload];
  if (!isRecord(payload)) return [];
  const candidates = [payload.agents, payload.data, payload.payload, payload.status, payload.result];
  return candidates.flatMap((candidate) => {
    if (Array.isArray(candidate)) return [candidate];
    if (isRecord(candidate)) return candidateArrays(candidate);
    return [];
  });
}

export function extractOpenClawAgents(payload: unknown) {
  const rootPayload = isRecord(payload) && isRecord(payload.payload) ? payload.payload : payload;
  const mappedAgents =
    isRecord(rootPayload) && isRecord(rootPayload.agents)
      ? recordEntries(rootPayload.agents)
          .map(([agentId, agent]) => (isRecord(agent) ? normalizeOpenClawAgent(agent, agentId, rootPayload) : null))
          .filter((agent) => agent !== null)
      : [];
  const heartbeatAgents =
    isRecord(rootPayload) && isRecord(rootPayload.heartbeat) && Array.isArray(rootPayload.heartbeat.agents)
      ? rootPayload.heartbeat.agents
          .filter(isRecord)
          .map((agent) => normalizeOpenClawAgent(agent, stringValue(agent.agentId), rootPayload))
      : [];

  const arrayAgents = candidateArrays(payload)
    .flat()
    .filter(isRecord)
    .map((agent) => normalizeOpenClawAgent(agent, undefined, rootPayload))
    .filter((agent) => agent.externalId || agent.slug || agent.name);

  const agentsById = new Map<string, (typeof arrayAgents)[number]>();
  for (const agent of [...mappedAgents, ...heartbeatAgents, ...arrayAgents]) {
    const key = agent.externalId ?? agent.slug ?? agent.name;
    if (key) agentsById.set(key, agent);
  }
  return [...agentsById.values()];
}

function findJobPayload(payload: unknown): JsonRecord | null {
  if (!isRecord(payload)) return null;
  if (payload.jobId || payload.job_id || payload.job) return payload;
  for (const value of Object.values(payload)) {
    const nested = findJobPayload(value);
    if (nested) return nested;
  }
  return null;
}

export async function syncOpenClawAgentsFromPayload(payload: unknown) {
  const externalAgents = extractOpenClawAgents(payload);
  const map = agentMap();
  const dashboardAgents = await prisma.agent.findMany();
  let updated = 0;

  for (const dashboardAgent of dashboardAgents) {
    const mappedExternalId = map[dashboardAgent.slug];
    const match = externalAgents.find((agent) => {
      const candidates = [agent.externalId, agent.slug, agent.name].filter(Boolean).map((value) => value!.toLowerCase());
      return (
        (mappedExternalId && candidates.includes(mappedExternalId.toLowerCase())) ||
        candidates.includes(dashboardAgent.slug.toLowerCase()) ||
        candidates.includes(dashboardAgent.name.toLowerCase())
      );
    });

    if (!match) continue;

    await prisma.agent.update({
      where: { id: dashboardAgent.id },
      data: {
        status: match.status ?? "online",
        currentTaskId: match.currentTaskId ?? dashboardAgent.currentTaskId,
        lastHeartbeatAt: new Date(),
        lastActivityAt: new Date()
      }
    });
    updated += 1;
  }

  await createAuditLog({
    eventType: "webhook_received",
    severity: updated > 0 ? "info" : "warning",
    message: `Sync OpenClaw atualizou ${updated} de ${dashboardAgents.length} agentes.`,
    inputPayload: payload,
    outputPayload: { updated, discovered: externalAgents.length }
  });

  return { updated, discovered: externalAgents.length };
}

export async function applyOpenClawAgentEvent(input: {
  agentSlug?: string;
  jobId?: string;
  event: string;
  status?: string;
  payload?: unknown;
}) {
  const status = normalizeStatus(input.status ?? (isRecord(input.payload) ? input.payload.status : undefined), agentStatuses);
  const agent = input.agentSlug
    ? await prisma.agent.findFirst({ where: { OR: [{ slug: input.agentSlug }, { name: input.agentSlug }] } })
    : null;

  if (agent && status) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status, lastHeartbeatAt: new Date(), lastActivityAt: new Date(), currentTaskId: input.jobId ?? undefined }
    });
  }

  await createAuditLog({
    jobId: input.jobId,
    agentId: agent?.id,
    eventType: "webhook_received",
    severity: status === "error" ? "error" : "info",
    stage: input.event,
    decision: status,
    message: `Evento OpenClaw recebido: ${input.event}.`,
    inputPayload: input
  });

  return { accepted: true, updatedAgent: Boolean(agent && status) };
}

export async function applyOpenClawTaskUpdate(input: {
  jobId?: string;
  event: string;
  status?: string;
  agentSlug?: string;
  payload?: unknown;
}) {
  const payloadRecord = findJobPayload(input.payload);
  const jobId =
    input.jobId ??
    stringValue(payloadRecord?.jobId) ??
    stringValue(payloadRecord?.job_id) ??
    stringValue(isRecord(payloadRecord?.job) ? payloadRecord.job.jobId : undefined);
  const status = normalizeStatus(input.status ?? payloadRecord?.status ?? payloadRecord?.stage, jobStatuses);
  const severity = normalizeStatus(payloadRecord?.severity, severities) ?? (status === "failed" ? "error" : "info");
  const agent = input.agentSlug
    ? await prisma.agent.findFirst({ where: { OR: [{ slug: input.agentSlug }, { name: input.agentSlug }] } })
    : null;

  let jobUpdated = false;
  if (jobId && status) {
    const existing = await prisma.articleJob.findUnique({ where: { jobId } });
    if (existing) {
      await prisma.articleJob.update({
        where: { jobId },
        data: {
          status,
          currentStage: JOB_STATUS_META[status].stage,
          assignedAgentId: agent?.id ?? undefined,
          relevanceScore: numberValue(payloadRecord?.relevanceScore ?? payloadRecord?.relevance_score) ?? undefined,
          validationScore: numberValue(payloadRecord?.validationScore ?? payloadRecord?.validation_score) ?? undefined,
          editorialScore: numberValue(payloadRecord?.editorialScore ?? payloadRecord?.editorial_score) ?? undefined,
          seoScore: numberValue(payloadRecord?.seoScore ?? payloadRecord?.seo_score) ?? undefined,
          complianceScore: numberValue(payloadRecord?.complianceScore ?? payloadRecord?.compliance_score) ?? undefined,
          monetizationScore: numberValue(payloadRecord?.monetizationScore ?? payloadRecord?.monetization_score) ?? undefined,
          errorMessage: status === "failed" ? stringValue(payloadRecord?.errorMessage ?? payloadRecord?.error) : undefined
        }
      });
      jobUpdated = true;
    }
  }

  await createAuditLog({
    jobId,
    agentId: agent?.id,
    eventType: status === "failed" ? "failed" : "webhook_received",
    severity,
    stage: status ? JOB_STATUS_META[status].stage : input.event,
    decision: status,
    score: numberValue(payloadRecord?.score),
    message: `Update OpenClaw recebido: ${input.event}.`,
    inputPayload: input
  });

  return { accepted: true, updatedJob: jobUpdated, jobId, status };
}

export async function handleOpenClawGatewayMessage(message: unknown) {
  const record = isRecord(message) ? message : { raw: message };
  const payload = record.payload ?? record;
  const type = stringValue(record.type) ?? "gateway_event";

  if (extractOpenClawAgents(payload).length > 0) {
    await syncOpenClawAgentsFromPayload(payload);
  }

  if (findJobPayload(payload)) {
    await applyOpenClawTaskUpdate({ event: type, payload });
  }

  return { accepted: true, type };
}

export async function dispatchOpenClawCommand(input: {
  type: string;
  payload: Record<string, unknown>;
  jobId?: string | null;
  agentId?: string | null;
}) {
  try {
    const result = await getOpenClawAdapter().sendCommand({ type: input.type, payload: input.payload });
    return result;
  } catch (error) {
    await createAuditLog({
      jobId: input.jobId,
      agentId: input.agentId,
      eventType: "failed",
      severity: "error",
      stage: "OpenClaw",
      decision: input.type,
      message: `Falha ao enviar comando ${input.type} ao OpenClaw.`,
      inputPayload: input.payload,
      errorPayload: { message: error instanceof Error ? error.message : String(error) }
    });
    return {
      accepted: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
