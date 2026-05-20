import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_META } from "@/lib/domain";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { createAuditLog } from "@/lib/server/audit";
import { reconcileAgentsForJobChange } from "@/lib/server/agent-state";
import type { AgentStatus, JobPriority, JobStatus, LogSeverity } from "@/lib/types";
import type { Agent, AuditEventType, Prisma } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

const agentStatuses: AgentStatus[] = ["online", "idle", "busy", "paused", "offline", "error"];
const jobStatuses = Object.keys(JOB_STATUS_META) as JobStatus[];
const priorities: JobPriority[] = ["low", "normal", "high", "urgent"];
const severities: LogSeverity[] = ["info", "warning", "error", "critical"];
const openClawWebhookStage = "OpenClaw webhook";
const auditEventTypes: AuditEventType[] = [
  "job_created",
  "relevance_scored",
  "validation_completed",
  "article_written",
  "seo_completed",
  "affiliate_decided",
  "compliance_completed",
  "wordpress_payload_created",
  "published",
  "drafted",
  "failed",
  "human_review_requested",
  "prompt_injection_detected",
  "task_status_changed",
  "task_retried",
  "task_cancelled",
  "task_assigned",
  "priority_changed",
  "agent_paused",
  "agent_resumed",
  "agent_heartbeat",
  "review_approved",
  "review_rejected",
  "returned_to_writer",
  "returned_to_validator",
  "webhook_received",
  "errors_cleared",
  "agent_restarted"
];
const defaultTechSoulsAgentMap: Record<string, string[]> = {
  "techsouls-orchestrator": ["orchestrator"],
  "techsouls-trend-editorial": ["editorial", "trend-editorial", "trend-editorial-agent", "editorial-agent", "trend-agent"],
  "techsouls-researcher": ["researcher"],
  "techsouls-relevance-score": ["relevance-classifier"],
  "techsouls-news-clustering": ["dedup-cluster"],
  "techsouls-fact-check": ["validator"],
  "techsouls-blog-writer": ["writer"],
  "techsouls-seo": ["seo-agent"],
  "techsouls-affiliate-router": ["affiliate-agent"],
  "techsouls-copywriter": ["copywriter"],
  "techsouls-final-editor": ["editor-final"],
  "techsouls-compliance": ["compliance-agent"],
  "techsouls-wordpress-publisher": ["wp-publisher"],
  "techsouls-social": ["social-agent"],
  "techsouls-analytics-cro": ["analytics-cro"],
  "techsouls-audit-log": ["audit-agent"]
};

const canonicalOpenClawAgents: Record<
  string,
  {
    name: string;
    description: string;
    skillName: string;
    averageProcessingTimeMs: number;
  }
> = {
  "techsouls-trend-editorial": {
    name: "Trend / Editorial Agent",
    description: "Monitora tendencias, identifica pautas editoriais promissoras e prioriza sinais para o pipeline TechSouls.",
    skillName: "techsouls-trend-editorial",
    averageProcessingTimeMs: 118000
  }
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "sim"].includes(normalized)) return true;
  if (["false", "0", "no", "nao"].includes(normalized)) return false;
  return undefined;
}

function recordEntries(value: unknown) {
  return isRecord(value) ? Object.entries(value) : [];
}

function normalizeStatus<T extends string>(value: unknown, allowed: readonly T[]) {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase().replaceAll("-", "_") as T;
  return allowed.includes(normalized) ? normalized : undefined;
}

function normalizeAgentMapValue(value: string | string[]) {
  return Array.isArray(value) ? value : [value];
}

export function openClawAgentMap() {
  const map = Object.fromEntries(Object.entries(defaultTechSoulsAgentMap).map(([slug, aliases]) => [slug, [...aliases]]));
  try {
    const raw = process.env.OPENCLAW_AGENT_MAP_JSON;
    const configured = raw ? (JSON.parse(raw) as Record<string, string | string[]>) : {};
    for (const [slug, aliases] of Object.entries(configured)) {
      map[slug] = [...new Set([...(map[slug] ?? []), ...normalizeAgentMapValue(aliases)])];
    }
  } catch {
    return map;
  }
  const trendEditorialAliases = new Set(defaultTechSoulsAgentMap["techsouls-trend-editorial"].map((alias) => alias.toLowerCase()));
  map["techsouls-final-editor"] = (map["techsouls-final-editor"] ?? []).filter(
    (alias) => !trendEditorialAliases.has(alias.toLowerCase())
  );
  return map;
}

function externalAgentIdsForSlug(slug?: string | null) {
  if (!slug) return [];
  return openClawAgentMap()[slug] ?? [];
}

function reverseAgentMap() {
  return Object.fromEntries(
    Object.entries(openClawAgentMap()).flatMap(([dashboardSlug, externalIds]) =>
      externalIds.map((externalId) => [externalId, dashboardSlug])
    )
  );
}

function commandMap() {
  try {
    const raw = process.env.OPENCLAW_COMMAND_MAP_JSON;
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function ignoredOpenClawAgentIds() {
  return (process.env.OPENCLAW_IGNORED_AGENT_IDS ?? "main")
    .split(",")
    .map((agentId) => agentId.trim())
    .filter(Boolean);
}

const agentDispatchActions = new Set([
  "job_create",
  "task_update",
  "task_retry",
  "task_cancel",
  "task_priority",
  "task_assign",
  "human_review_approved",
  "human_review_rejected",
  "human_review_drafted",
  "human_review_return_to_writer",
  "human_review_return_to_validator"
]);

function defaultCommandMethod(action: string) {
  if (agentDispatchActions.has(action)) return "agent";
  return action;
}

function externalAgentIdForSlug(slug?: string | null) {
  if (!slug) return undefined;
  return externalAgentIdsForSlug(slug)[0] ?? slug;
}

function externalAgentIdForAgent(agent?: Pick<Agent, "slug" | "externalId"> | null) {
  return agent?.externalId ?? externalAgentIdForSlug(agent?.slug);
}

function orchestratorExternalId() {
  return externalAgentIdForSlug("techsouls-orchestrator") ?? "orchestrator";
}

function openClawAgentMessage(action: string, payload: Record<string, unknown>) {
  return [
    `TechSouls Command Center action: ${action}`,
    "",
    "Process the following editorial job/control payload and update the pipeline state through your normal OpenClaw workflow.",
    "",
    JSON.stringify(
      {
        action,
        source: "techsouls-command-center",
        payload
      },
      null,
      2
    )
  ].join("\n");
}

function rootOpenClawPayload(payload: unknown) {
  return isRecord(payload) && isRecord(payload.payload) ? payload.payload : payload;
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function jsonHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function asJson(value: unknown) {
  return (value ?? null) as Prisma.InputJsonValue;
}

function dateValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function nestedJobRecord(record: JsonRecord | null | undefined) {
  return isRecord(record?.job) ? record.job : undefined;
}

function firstPayloadValue(record: JsonRecord | null | undefined, keys: string[]) {
  if (!record) return undefined;
  const nestedJob = nestedJobRecord(record);
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
    if (nestedJob?.[key] !== undefined) return nestedJob[key];
  }
  return undefined;
}

function firstString(record: JsonRecord | null | undefined, keys: string[]) {
  return stringValue(firstPayloadValue(record, keys));
}

function firstNumber(record: JsonRecord | null | undefined, keys: string[]) {
  return numberValue(firstPayloadValue(record, keys));
}

function firstBoolean(record: JsonRecord | null | undefined, keys: string[]) {
  return booleanValue(firstPayloadValue(record, keys));
}

function scoreRecord(record: JsonRecord | null | undefined) {
  const scores = firstPayloadValue(record, ["scores"]);
  return isRecord(scores) ? scores : undefined;
}

function firstScore(record: JsonRecord | null | undefined, directKeys: string[], scoreKeys: string[]) {
  const direct = firstNumber(record, directKeys);
  if (direct !== undefined) return direct;
  const scores = scoreRecord(record);
  for (const key of scoreKeys) {
    const score = numberValue(scores?.[key]);
    if (score !== undefined) return score;
  }
  return undefined;
}

function firstArray(record: JsonRecord | null | undefined, keys: string[]) {
  const value = firstPayloadValue(record, keys);
  return Array.isArray(value) ? value : [];
}

function sourceRecords(record: JsonRecord | null | undefined) {
  return firstArray(record, ["sources", "references", "referenceSources", "reference_sources"]).filter(isRecord);
}

function referenceUrls(record: JsonRecord | null | undefined) {
  return firstArray(record, ["referenceUrls", "reference_urls", "urls"])
    .map((value) => stringValue(value))
    .filter((value): value is string => Boolean(value));
}

function stageLabel(value?: string | null, fallback?: JobStatus) {
  const normalized = normalizeStatus(value, jobStatuses);
  if (normalized) return JOB_STATUS_META[normalized].stage;
  if (value) return value;
  return fallback ? JOB_STATUS_META[fallback].stage : "OpenClaw";
}

function auditEventFromOpenClawEvent(event: string, status?: JobStatus, jobCreated = false): AuditEventType {
  if (jobCreated) return "job_created";
  if (status === "published") return "published";
  if (status === "drafted") return "drafted";
  if (status === "failed") return "failed";
  if (status === "human_review") return "human_review_requested";
  const normalized = event.toLowerCase().replaceAll("-", "_").replaceAll(".", "_") as AuditEventType;
  return auditEventTypes.includes(normalized) ? normalized : "webhook_received";
}

function dedupeKey(input: {
  jobId?: string;
  agentKey?: string | null;
  event: string;
  idempotencyKey?: string;
}) {
  return input.idempotencyKey ?? `${input.jobId ?? "unknown"}:${input.agentKey ?? "unknown"}:${input.event}`;
}

async function incrementSystemCounter(key: string) {
  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  const current = isRecord(existing?.value) ? numberValue(existing.value.count) ?? 0 : 0;
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: { count: 1, updatedAt: new Date().toISOString() } },
    update: { value: { count: current + 1, updatedAt: new Date().toISOString() } }
  });
  return current + 1;
}

function statusFromEvent(event: string) {
  const normalized = event.toLowerCase().replaceAll("-", "_").replaceAll(".", "_");
  if ((jobStatuses as string[]).includes(normalized)) return normalized as JobStatus;
  if (normalized.includes("human_review")) return "human_review";
  if (normalized.includes("publish") && !normalized.includes("payload")) return "published";
  if (normalized.includes("draft")) return "drafted";
  if (normalized.includes("fail") || normalized.includes("error")) return "failed";
  if (normalized.includes("seo")) return "seo_optimizing";
  if (normalized.includes("affiliate")) return "affiliate_routing";
  if (normalized.includes("compliance")) return "compliance_checking";
  if (normalized.includes("validat")) return "validating";
  if (normalized.includes("writ")) return "writing";
  if (normalized.includes("cluster") || normalized.includes("dedup")) return "clustering";
  if (normalized.includes("relevance")) return "relevance_scoring";
  if (normalized.includes("research")) return "researching";
  if (normalized.includes("created") || normalized.includes("queued")) return "new";
  return undefined;
}

function candidateAgentKeys(input?: string | null) {
  const map = openClawAgentMap();
  const reverseMap = reverseAgentMap();
  const candidates = new Set<string>();
  if (input) candidates.add(input);
  if (input && reverseMap[input]) candidates.add(reverseMap[input]);
  if (input && map[input]) {
    for (const externalId of externalAgentIdsForSlug(input)) candidates.add(externalId);
  }
  return [...candidates].filter(Boolean);
}

function matchesDashboardAgent(agent: Agent, externalKey?: string | null) {
  if (!externalKey) return false;
  const keys = candidateAgentKeys(externalKey).map((value) => value.toLowerCase());
  return keys.includes(agent.slug.toLowerCase()) || keys.includes(agent.name.toLowerCase());
}

async function findDashboardAgent(externalKey?: string | null) {
  if (!externalKey) return null;
  const keys = candidateAgentKeys(externalKey);
  return prisma.agent.findFirst({
    where: {
      OR: keys.flatMap((key) => [{ slug: key }, { name: key }, { externalId: key }])
    }
  });
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
  const scheduleStatus = agent.enabled === true ? "online" : undefined;
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
  const rootPayload = rootOpenClawPayload(payload);
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

type OpenClawAgentCandidate = ReturnType<typeof extractOpenClawAgents>[number];

function normalizedExternalAgentValues(agent: OpenClawAgentCandidate) {
  return [agent.externalId, agent.slug, agent.name].filter(Boolean).map((value) => value!.toLowerCase());
}

function externalAgentMatches(agent: OpenClawAgentCandidate, key: string) {
  return normalizedExternalAgentValues(agent).includes(key.toLowerCase());
}

export function bestOpenClawAgentForDashboardAgent(
  dashboardAgent: Pick<Agent, "slug" | "name">,
  externalAgents: OpenClawAgentCandidate[]
) {
  const mappedExternalIds = externalAgentIdsForSlug(dashboardAgent.slug);
  for (const mappedExternalId of mappedExternalIds) {
    const match = externalAgents.find((agent) => externalAgentMatches(agent, mappedExternalId));
    if (match) return match;
  }

  return externalAgents.find((agent) => {
    const candidates = normalizedExternalAgentValues(agent);
    return candidates.includes(dashboardAgent.slug.toLowerCase()) || candidates.includes(dashboardAgent.name.toLowerCase());
  });
}

async function ensureCanonicalDashboardAgentsForOpenClaw(externalAgents: OpenClawAgentCandidate[]) {
  const existingAgents = await prisma.agent.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existingAgents.map((agent) => agent.slug));

  for (const [slug, definition] of Object.entries(canonicalOpenClawAgents)) {
    if (existingSlugs.has(slug)) continue;
    const mappedExternalIds = externalAgentIdsForSlug(slug);
    const match = externalAgents.find((agent) =>
      mappedExternalIds.some((externalId) => externalAgentMatches(agent, externalId))
    );
    if (!match) continue;

    await prisma.agent.create({
      data: {
        name: definition.name,
        slug,
        externalId: match.externalId ?? mappedExternalIds[0],
        description: definition.description,
        skillName: definition.skillName,
        status: match.status ?? "online",
        currentTaskId: match.currentTaskId,
        lastHeartbeatAt: new Date(),
        lastActivityAt: new Date(),
        lastOpenClawSyncAt: new Date(),
        openClawEnabled: booleanValue(match.raw.enabled),
        averageProcessingTimeMs: definition.averageProcessingTimeMs
      }
    });
    existingSlugs.add(slug);
  }
}

export function extractOpenClawAgentActivities(payload: unknown) {
  const rootPayload = rootOpenClawPayload(payload);
  const sessions = isRecord(rootPayload) && isRecord(rootPayload.sessions) ? rootPayload.sessions : undefined;
  const activities: {
    externalId: string;
    sessionId?: string;
    kind?: string;
    updatedAt?: Date;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    raw: JsonRecord;
  }[] = [];

  const addRecent = (fallbackAgentId: string | undefined, recent: unknown) => {
    if (!isRecord(recent)) return;
    const externalId = stringValue(recent.agentId) ?? fallbackAgentId;
    if (!externalId) return;
    activities.push({
      externalId,
      sessionId: stringValue(recent.sessionId) ?? stringValue(recent.id) ?? stringValue(recent.key),
      kind: stringValue(recent.kind),
      updatedAt: dateValue(recent.updatedAt),
      model: stringValue(recent.model),
      inputTokens: numberValue(recent.inputTokens),
      outputTokens: numberValue(recent.outputTokens),
      totalTokens: numberValue(recent.totalTokens),
      raw: recent
    });
  };

  if (isRecord(sessions) && Array.isArray(sessions.byAgent)) {
    for (const entry of sessions.byAgent.filter(isRecord)) {
      const agentId = stringValue(entry.agentId);
      if (Array.isArray(entry.recent)) {
        for (const recent of entry.recent) addRecent(agentId, recent);
      }
    }
  }

  if (isRecord(sessions) && Array.isArray(sessions.recent)) {
    for (const recent of sessions.recent) addRecent(undefined, recent);
  }

  const key = (activity: (typeof activities)[number]) =>
    `${activity.externalId}:${activity.sessionId ?? activity.raw.key ?? activity.updatedAt?.toISOString() ?? "unknown"}`;
  return [...new Map(activities.map((activity) => [key(activity), activity])).values()];
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

function externalJobId(payloadRecord: JsonRecord | null | undefined, fallbackJobId?: string) {
  return (
    firstString(payloadRecord, ["externalId", "external_id", "openClawJobId", "openclaw_job_id", "taskId", "task_id"]) ??
    fallbackJobId
  );
}

export async function syncOpenClawAgentsFromPayload(payload: unknown) {
  const externalAgents = extractOpenClawAgents(payload);
  const activities = extractOpenClawAgentActivities(payload);
  await ensureCanonicalDashboardAgentsForOpenClaw(externalAgents);
  const dashboardAgents = await prisma.agent.findMany();
  let updated = 0;
  let activitiesRecorded = 0;

  for (const dashboardAgent of dashboardAgents) {
    const mappedExternalIds = externalAgentIdsForSlug(dashboardAgent.slug);
    const match = bestOpenClawAgentForDashboardAgent(dashboardAgent, externalAgents);

    if (!match) continue;

    await prisma.agent.update({
      where: { id: dashboardAgent.id },
      data: {
        externalId: match.externalId ?? mappedExternalIds[0] ?? dashboardAgent.externalId,
        openClawEnabled: booleanValue(match.raw.enabled),
        status: ["paused", "error"].includes(dashboardAgent.status) ? dashboardAgent.status : match.status ?? dashboardAgent.status,
        currentTaskId: match.currentTaskId ?? dashboardAgent.currentTaskId,
        lastHeartbeatAt: new Date(),
        lastOpenClawSyncAt: new Date()
      }
    });
    updated += 1;
  }

  for (const activity of activities) {
    const dashboardAgent = dashboardAgents.find((agent) => matchesDashboardAgent(agent, activity.externalId));
    if (!dashboardAgent) continue;

    const activityAt = activity.updatedAt ?? new Date();
    await prisma.agent.update({
      where: { id: dashboardAgent.id },
      data: {
        lastActivityAt: activityAt,
        lastHeartbeatAt: new Date(),
        lastOpenClawSyncAt: new Date(),
        externalId: activity.externalId
      }
    });

    const decision = activity.sessionId ?? stringValue(activity.raw.key) ?? activityAt.toISOString();
    const existing = await prisma.agentLog.findFirst({
      where: {
        agentId: dashboardAgent.id,
        eventType: "webhook_received",
        stage: "OpenClaw session",
        decision
      }
    });

    if (existing) continue;

    await createAuditLog({
      agentId: dashboardAgent.id,
      eventType: "webhook_received",
      severity: "info",
      stage: "OpenClaw session",
      decision,
      score: numberValue(activity.raw.percentUsed),
      message: `Sessao OpenClaw detectada para ${dashboardAgent.name}.`,
      inputPayload: activity.raw,
      outputPayload: {
        externalId: activity.externalId,
        model: activity.model,
        kind: activity.kind,
        inputTokens: activity.inputTokens,
        outputTokens: activity.outputTokens,
        totalTokens: activity.totalTokens
      }
    });
    activitiesRecorded += 1;
  }

  const recentSyncLog = await prisma.agentLog.findFirst({
    where: {
      eventType: "webhook_received",
      stage: "OpenClaw sync"
    },
    orderBy: { createdAt: "desc" }
  });
  const shouldLogSync =
    activitiesRecorded > 0 ||
    !recentSyncLog ||
    Date.now() - recentSyncLog.createdAt.getTime() > 5 * 60_000;

  if (shouldLogSync) {
    await createAuditLog({
      eventType: "webhook_received",
      severity: updated > 0 ? "info" : "warning",
      stage: "OpenClaw sync",
      message: `Sync OpenClaw atualizou ${updated} de ${dashboardAgents.length} agentes e registrou ${activitiesRecorded} atividades.`,
      inputPayload: payload,
      outputPayload: { updated, discovered: externalAgents.length, sessionsDiscovered: activities.length, activitiesRecorded }
    });
  }

  return { updated, discovered: externalAgents.length, sessionsDiscovered: activities.length, activitiesRecorded };
}

export async function markOpenClawWorkerSeen(message = "Worker OpenClaw ativo.") {
  const now = new Date().toISOString();
  await prisma.systemSetting.upsert({
    where: { key: "openclaw_worker_status" },
    create: {
      key: "openclaw_worker_status",
      value: {
        connected: true,
        lastSeenAt: now,
        message
      }
    },
    update: {
      value: {
        connected: true,
        lastSeenAt: now,
        message
      }
    }
  });
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
  agentExternalId?: string;
  completedStage?: string;
  idempotencyKey?: string;
  severity?: string;
  timestamp?: string;
  payload?: unknown;
}) {
  const foundPayloadRecord = findJobPayload(input.payload);
  const payloadRecord: JsonRecord = {
    ...(isRecord(input.payload) ? input.payload : {}),
    ...(foundPayloadRecord ?? {})
  };
  if (input.jobId) payloadRecord.jobId = input.jobId;
  if (input.status) payloadRecord.status = input.status;
  if (input.agentSlug) payloadRecord.agentSlug = input.agentSlug;
  if (input.agentExternalId) payloadRecord.agentExternalId = input.agentExternalId;
  if (input.completedStage) payloadRecord.completedStage = input.completedStage;
  if (input.severity) payloadRecord.severity = input.severity;
  const jobId =
    input.jobId ??
    stringValue(payloadRecord?.jobId) ??
    stringValue(payloadRecord?.job_id) ??
    stringValue(isRecord(payloadRecord?.job) ? payloadRecord.job.jobId : undefined);
  const status =
    normalizeStatus(input.status ?? payloadRecord?.status ?? payloadRecord?.stage, jobStatuses) ??
    statusFromEvent(input.event);
  const severity =
    normalizeStatus(input.severity ?? payloadRecord?.severity, severities) ?? (status === "failed" ? "error" : "info");
  const agentKey =
    input.agentSlug ??
    input.agentExternalId ??
    firstString(payloadRecord, [
      "agentSlug",
      "agent_slug",
      "agentExternalId",
      "agent_external_id",
      "agentId",
      "agent_id",
      "assignedAgent",
      "currentAgent"
    ]);
  const agent = await findDashboardAgent(agentKey);
  const webhookDedupeKey = dedupeKey({ jobId, agentKey, event: input.event, idempotencyKey: input.idempotencyKey });

  if (jobId) {
    const duplicate = await prisma.agentLog.findFirst({
      where: {
        jobId,
        stage: openClawWebhookStage,
        decision: webhookDedupeKey,
        ...(agent ? { agentId: agent.id } : {})
      },
      select: { id: true, createdAt: true }
    });

    if (duplicate) {
      await incrementSystemCounter("openclaw_webhook_duplicate_count");
      await prisma.systemSetting.upsert({
        where: { key: "openclaw_latest_webhook" },
        create: {
          key: "openclaw_latest_webhook",
          value: {
            event: input.event,
            jobId,
            agentKey: agentKey ?? null,
            status: status ?? null,
            completedStage: input.completedStage ?? null,
            idempotencyKey: webhookDedupeKey,
            duplicate: true,
            receivedAt: new Date().toISOString()
          }
        },
        update: {
          value: {
            event: input.event,
            jobId,
            agentKey: agentKey ?? null,
            status: status ?? null,
            completedStage: input.completedStage ?? null,
            idempotencyKey: webhookDedupeKey,
            duplicate: true,
            receivedAt: new Date().toISOString()
          }
        }
      });
      return {
        accepted: true,
        duplicate: true,
        updatedJob: false,
        createdJob: false,
        jobId,
        status,
        idempotencyKey: webhookDedupeKey
      };
    }
  }

  let jobUpdated = false;
  let jobCreated = false;
  if (jobId) {
    const existing = await prisma.articleJob.findUnique({ where: { jobId } });
    const effectiveStatus = status ?? "new";
    const title =
      firstString(payloadRecord, ["title", "headline", "articleTitle", "article_title"]) ??
      `Job OpenClaw ${jobId}`;
    const topic = firstString(payloadRecord, ["topic", "subject", "query"]) ?? title;
    const category = firstString(payloadRecord, ["category", "vertical", "section"]) ?? "OpenClaw";
    const sourceName = firstString(payloadRecord, ["sourceName", "source_name", "source", "publisher"]) ?? "OpenClaw Gateway";
    const sourceUrl = firstString(payloadRecord, ["sourceUrl", "source_url", "url", "link"]) ?? "https://openclaw.local/events";
    const explicitStage = firstString(payloadRecord, ["currentStage", "current_stage", "stage"]);
    const completedStage = firstString(payloadRecord, ["completedStage", "completed_stage"]) ?? input.completedStage;
    const currentStage = status ? JOB_STATUS_META[status].stage : explicitStage ?? stageLabel(completedStage, effectiveStatus);
    const priority = normalizeStatus(firstPayloadValue(payloadRecord, ["priority"]), priorities);
    const articleMarkdown = firstString(payloadRecord, ["articleMarkdown", "article_markdown", "article", "content", "body"]);
    const openClawExternalId = externalJobId(payloadRecord, jobId);
    const relevanceScore = firstScore(payloadRecord, ["relevanceScore", "relevance_score"], ["relevance"]);
    const validationScore = firstScore(payloadRecord, ["validationScore", "validation_score"], ["validation"]);
    const editorialScore = firstScore(payloadRecord, ["editorialScore", "editorial_score"], ["editorial"]);
    const seoScore = firstScore(payloadRecord, ["seoScore", "seo_score"], ["seo"]);
    const complianceScore = firstScore(payloadRecord, ["complianceScore", "compliance_score"], ["compliance"]);
    const monetizationScore = firstScore(payloadRecord, ["monetizationScore", "monetization_score"], ["monetization"]);
    const requiresHumanReview =
      effectiveStatus === "human_review" ||
      firstBoolean(payloadRecord, ["requiresHumanReview", "requires_human_review"]) === true;

    const job = await prisma.articleJob.upsert({
      where: { jobId },
      create: {
        jobId,
        externalId: openClawExternalId,
        dataSource: "openclaw",
        title,
        topic,
        category,
        sourceName,
        sourceUrl,
        clusterId: firstString(payloadRecord, ["clusterId", "cluster_id"]),
        currentStage,
        status: effectiveStatus,
        priority: priority ?? "normal",
        assignedAgentId: agent?.id ?? null,
        relevanceScore,
        validationScore,
        editorialScore,
        seoScore,
        complianceScore,
        monetizationScore,
        hasAffiliate: firstBoolean(payloadRecord, ["hasAffiliate", "has_affiliate"]) ?? false,
        requiresHumanReview,
        wordpressPostId: firstString(payloadRecord, ["wordpressPostId", "wordpress_post_id", "postId"]),
        wordpressPreviewUrl: firstString(payloadRecord, ["wordpressPreviewUrl", "wordpress_preview_url", "previewUrl"]),
        errorMessage:
          effectiveStatus === "failed"
            ? firstString(payloadRecord, ["errorMessage", "error_message", "error", "message"])
            : undefined,
        articleMarkdown
      },
      update: {
        externalId: openClawExternalId ?? undefined,
        dataSource: "openclaw",
        status: status ?? undefined,
        currentStage: status ? JOB_STATUS_META[status].stage : explicitStage ?? (completedStage ? stageLabel(completedStage) : undefined),
        assignedAgentId: agent?.id ?? undefined,
        relevanceScore: relevanceScore ?? undefined,
        validationScore: validationScore ?? undefined,
        editorialScore: editorialScore ?? undefined,
        seoScore: seoScore ?? undefined,
        complianceScore: complianceScore ?? undefined,
        monetizationScore: monetizationScore ?? undefined,
        hasAffiliate: firstBoolean(payloadRecord, ["hasAffiliate", "has_affiliate"]) ?? undefined,
        requiresHumanReview:
          status === "human_review"
            ? true
            : firstBoolean(payloadRecord, ["requiresHumanReview", "requires_human_review"]) ?? undefined,
        wordpressPostId: firstString(payloadRecord, ["wordpressPostId", "wordpress_post_id", "postId"]) ?? undefined,
        wordpressPreviewUrl:
          firstString(payloadRecord, ["wordpressPreviewUrl", "wordpress_preview_url", "previewUrl"]) ?? undefined,
        errorMessage:
          status === "failed"
            ? firstString(payloadRecord, ["errorMessage", "error_message", "error", "message"]) ??
              "Falha reportada pelo OpenClaw."
            : undefined,
        articleMarkdown: articleMarkdown ?? undefined
      }
    });

    const snapshotStage = stageLabel(completedStage, status ?? effectiveStatus);
    const inputPayload =
      firstPayloadValue(payloadRecord, ["inputPayload", "input_payload", "promptPayload", "prompt_payload"]) ??
      input.payload ??
      payloadRecord;
    const outputPayload =
      firstPayloadValue(payloadRecord, ["outputPayload", "output_payload", "output", "result", "response"]) ??
      payloadRecord;
    const inputHash = jsonHash(inputPayload);
    const outputHash = jsonHash(outputPayload);
    const existingSnapshot = await prisma.payloadSnapshot.findFirst({
      where: { jobId, stage: snapshotStage, inputHash, outputHash }
    });
    if (!existingSnapshot) {
      await prisma.payloadSnapshot.create({
        data: {
          jobId,
          stage: snapshotStage,
          agentId: agent?.id ?? null,
          inputPayload: asJson(inputPayload),
          outputPayload: asJson(outputPayload),
          inputHash,
          outputHash
        }
      });
    }

    const sourceInputs = [
      ...sourceRecords(payloadRecord).map((source) => ({
        name: stringValue(source.name) ?? stringValue(source.sourceName) ?? "Fonte OpenClaw",
        url: stringValue(source.url) ?? stringValue(source.sourceUrl) ?? "",
        role: stringValue(source.role) ?? "reference",
        reliabilityScore: numberValue(source.reliabilityScore) ?? numberValue(source.reliability_score) ?? 80,
        publishedAt: dateValue(source.publishedAt)
      })),
      ...referenceUrls(payloadRecord).map((url, index) => ({
        name: `Referencia ${index + 1}`,
        url,
        role: "reference",
        reliabilityScore: 80,
        publishedAt: undefined
      }))
    ].filter((source) => source.url);

    const sourceUrlValue = firstString(payloadRecord, ["sourceUrl", "source_url", "url", "link"]);
    if (sourceUrlValue && !sourceInputs.some((source) => source.url === sourceUrlValue)) {
      sourceInputs.unshift({
        name: sourceName,
        url: sourceUrlValue,
        role: "primary",
        reliabilityScore: firstNumber(payloadRecord, ["reliabilityScore", "reliability_score"]) ?? 80,
        publishedAt: undefined
      });
    }

    for (const source of sourceInputs) {
      const existingSource = await prisma.source.findFirst({ where: { jobId, url: source.url } });
      if (!existingSource) {
        await prisma.source.create({
          data: {
            jobId,
            name: source.name,
            url: source.url,
            role: source.role,
            reliabilityScore: source.reliabilityScore,
            publishedAt: source.publishedAt
          }
        });
      }
    }

    const pendingReview = await prisma.humanReview.findFirst({ where: { jobId, status: "pending" } });
    if (requiresHumanReview || status === "human_review") {
      const reason =
        firstString(payloadRecord, ["humanReviewReason", "human_review_reason", "reviewReason", "review_reason"]) ??
        "Revisao humana solicitada pelo OpenClaw.";
      if (pendingReview) {
        await prisma.humanReview.update({
          where: { id: pendingReview.id },
          data: {
            reason,
            decision: null,
            reviewerComment: null
          }
        });
      } else {
        await prisma.humanReview.create({
          data: {
            jobId,
            status: "pending",
            reason
          }
        });
      }
    } else if (pendingReview && ["published", "publishing"].includes(effectiveStatus)) {
      await prisma.humanReview.update({
        where: { id: pendingReview.id },
        data: { status: "approved", decision: "approved", reviewerComment: "Aprovado pelo fluxo OpenClaw." }
      });
    } else if (pendingReview && effectiveStatus === "drafted") {
      await prisma.humanReview.update({
        where: { id: pendingReview.id },
        data: { status: "approved", decision: "drafted", reviewerComment: "Salvo como rascunho pelo fluxo OpenClaw." }
      });
    } else if (pendingReview && ["discarded", "failed"].includes(effectiveStatus)) {
      await prisma.humanReview.update({
        where: { id: pendingReview.id },
        data: { status: "rejected", decision: effectiveStatus, reviewerComment: "Encerrado pelo fluxo OpenClaw." }
      });
    }

    jobUpdated = true;
    jobCreated = !existing;
    if (agent) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          lastActivityAt: new Date()
        }
      });
    }
    await reconcileAgentsForJobChange(existing?.assignedAgentId, job.assignedAgentId);
  }

  await prisma.systemSetting.upsert({
    where: { key: "openclaw_latest_webhook" },
    create: {
      key: "openclaw_latest_webhook",
      value: {
        event: input.event,
        jobId: jobId ?? null,
        agentKey: agentKey ?? null,
        status: status ?? null,
        completedStage: input.completedStage ?? null,
        idempotencyKey: webhookDedupeKey,
        duplicate: false,
        receivedAt: new Date().toISOString()
      }
    },
    update: {
      value: {
        event: input.event,
        jobId: jobId ?? null,
        agentKey: agentKey ?? null,
        status: status ?? null,
        completedStage: input.completedStage ?? null,
        idempotencyKey: webhookDedupeKey,
        duplicate: false,
        receivedAt: new Date().toISOString()
      }
    }
  });

  await createAuditLog({
    jobId,
    agentId: agent?.id,
    eventType: auditEventFromOpenClawEvent(input.event, status, jobCreated && statusFromEvent(input.event) === "new"),
    severity,
    stage: openClawWebhookStage,
    decision: webhookDedupeKey,
    score:
      numberValue(payloadRecord?.score) ??
      firstScore(payloadRecord, ["relevanceScore", "relevance_score"], ["relevance"]),
    message: `Update OpenClaw recebido: ${input.event}.`,
    inputPayload: {
      event: input.event,
      jobId: jobId ?? null,
      agentKey: agentKey ?? null,
      status: status ?? null,
      completedStage: input.completedStage ?? null,
      timestamp: input.timestamp ?? null,
      payload: input.payload ?? null
    },
    outputPayload: {
      updatedJob: jobUpdated,
      createdJob: jobCreated,
      dataSource: jobId ? "openclaw" : null,
      status: status ?? null,
      completedStage: input.completedStage ?? null
    },
    errorPayload: asJson(firstPayloadValue(payloadRecord, ["errors", "errorPayload", "error_payload"]) ?? null)
  });

  return { accepted: true, duplicate: false, updatedJob: jobUpdated, createdJob: jobCreated, jobId, status, idempotencyKey: webhookDedupeKey };
}

export async function handleOpenClawGatewayMessage(message: unknown) {
  const record = isRecord(message) ? message : { raw: message };
  const payload = record.payload ?? record;
  const type = stringValue(record.type) ?? "gateway_event";

  if (extractOpenClawAgents(payload).length > 0 || extractOpenClawAgentActivities(payload).length > 0) {
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
    const type = commandMap()[input.type] ?? defaultCommandMethod(input.type);
    const agent = input.agentId
      ? await prisma.agent.findUnique({ where: { id: input.agentId }, select: { id: true, slug: true, externalId: true } })
      : null;
    const agentExternalId =
      externalAgentIdForAgent(agent) ??
      (agentDispatchActions.has(input.type) ? orchestratorExternalId() : undefined);
    const payload: Record<string, unknown> = {
      ...input.payload,
      ...(agentExternalId
        ? {
            agentId: agentExternalId,
            agentExternalId,
            dashboardAgentId: agent?.id,
            agentSlug: agent?.slug
          }
        : {}),
      ...(input.jobId ? { jobId: input.jobId } : {}),
      source: input.payload.source ?? "techsouls-command-center"
    };
    const params =
      type === "agent"
        ? {
            agentId: agentExternalId ?? orchestratorExternalId(),
            sessionKey: `agent:${agentExternalId ?? orchestratorExternalId()}:main`,
            idempotencyKey: `techsouls:${input.type}:${input.jobId ?? crypto.randomUUID()}:${crypto.randomUUID()}`,
            message:
              typeof payload.message === "string"
                ? payload.message
                : openClawAgentMessage(input.type, payload),
            deliver: false
          }
        : { ...payload, action: input.type };
    const result = await getOpenClawAdapter().sendCommand({ type, payload: params });
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
