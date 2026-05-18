import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_META } from "@/lib/domain";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { createAuditLog } from "@/lib/server/audit";
import type { AgentStatus, JobPriority, JobStatus, LogSeverity } from "@/lib/types";
import type { Agent, Prisma } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

const agentStatuses: AgentStatus[] = ["online", "idle", "busy", "paused", "offline", "error"];
const jobStatuses = Object.keys(JOB_STATUS_META) as JobStatus[];
const priorities: JobPriority[] = ["low", "normal", "high", "urgent"];
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

function agentMap() {
  try {
    const raw = process.env.OPENCLAW_AGENT_MAP_JSON;
    return raw ? (JSON.parse(raw) as Record<string, string | string[]>) : {};
  } catch {
    return {};
  }
}

function externalAgentIdsForSlug(slug?: string | null) {
  if (!slug) return [];
  const mapped = agentMap()[slug];
  if (Array.isArray(mapped)) return mapped;
  return mapped ? [mapped] : [];
}

function reverseAgentMap() {
  return Object.fromEntries(
    Object.entries(agentMap()).flatMap(([dashboardSlug, externalIds]) =>
      (Array.isArray(externalIds) ? externalIds : [externalIds]).map((externalId) => [externalId, dashboardSlug])
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
  const map = agentMap();
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
      OR: keys.flatMap((key) => [{ slug: key }, { name: key }])
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
  const dashboardAgents = await prisma.agent.findMany();
  let updated = 0;
  let activitiesRecorded = 0;

  for (const dashboardAgent of dashboardAgents) {
    const mappedExternalIds = externalAgentIdsForSlug(dashboardAgent.slug);
    const match = externalAgents.find((agent) => {
      const candidates = [agent.externalId, agent.slug, agent.name].filter(Boolean).map((value) => value!.toLowerCase());
      return (
        mappedExternalIds.some((mappedExternalId) => candidates.includes(mappedExternalId.toLowerCase())) ||
        candidates.includes(dashboardAgent.slug.toLowerCase()) ||
        candidates.includes(dashboardAgent.name.toLowerCase())
      );
    });

    if (!match) continue;

    await prisma.agent.update({
      where: { id: dashboardAgent.id },
      data: {
        externalId: match.externalId ?? mappedExternalIds[0] ?? dashboardAgent.externalId,
        openClawEnabled: booleanValue(match.raw.enabled),
        status: match.status ?? "online",
        currentTaskId: match.currentTaskId ?? dashboardAgent.currentTaskId,
        lastHeartbeatAt: new Date(),
        lastActivityAt: new Date(),
        lastOpenClawSyncAt: new Date()
      }
    });
    updated += 1;
  }

  for (const activity of activities) {
    const dashboardAgent = dashboardAgents.find((agent) => matchesDashboardAgent(agent, activity.externalId));
    if (!dashboardAgent) continue;

    const activityAt = activity.updatedAt ?? new Date();
    const ageMs = Date.now() - activityAt.getTime();
    await prisma.agent.update({
      where: { id: dashboardAgent.id },
      data: {
        status: ageMs >= 0 && ageMs < 5 * 60_000 ? "busy" : undefined,
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
  payload?: unknown;
}) {
  const payloadRecord = findJobPayload(input.payload);
  const jobId =
    input.jobId ??
    stringValue(payloadRecord?.jobId) ??
    stringValue(payloadRecord?.job_id) ??
    stringValue(isRecord(payloadRecord?.job) ? payloadRecord.job.jobId : undefined);
  const status =
    normalizeStatus(input.status ?? payloadRecord?.status ?? payloadRecord?.stage, jobStatuses) ??
    statusFromEvent(input.event);
  const severity = normalizeStatus(payloadRecord?.severity, severities) ?? (status === "failed" ? "error" : "info");
  const agentKey =
    input.agentSlug ??
    firstString(payloadRecord, ["agentSlug", "agent_slug", "agentId", "agent_id", "assignedAgent", "currentAgent"]);
  const agent = await findDashboardAgent(agentKey);

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
    const currentStage = explicitStage ?? JOB_STATUS_META[effectiveStatus].stage;
    const priority = normalizeStatus(firstPayloadValue(payloadRecord, ["priority"]), priorities);
    const articleMarkdown = firstString(payloadRecord, ["articleMarkdown", "article_markdown", "article", "content", "body"]);
    const openClawExternalId = externalJobId(payloadRecord, jobId);

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
        relevanceScore: firstNumber(payloadRecord, ["relevanceScore", "relevance_score"]),
        validationScore: firstNumber(payloadRecord, ["validationScore", "validation_score"]),
        editorialScore: firstNumber(payloadRecord, ["editorialScore", "editorial_score"]),
        seoScore: firstNumber(payloadRecord, ["seoScore", "seo_score"]),
        complianceScore: firstNumber(payloadRecord, ["complianceScore", "compliance_score"]),
        monetizationScore: firstNumber(payloadRecord, ["monetizationScore", "monetization_score"]),
        hasAffiliate: booleanValue(firstPayloadValue(payloadRecord, ["hasAffiliate", "has_affiliate"])) ?? false,
        requiresHumanReview:
          effectiveStatus === "human_review" ||
          booleanValue(firstPayloadValue(payloadRecord, ["requiresHumanReview", "requires_human_review"])) === true,
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
        currentStage: status ? JOB_STATUS_META[status].stage : explicitStage ?? undefined,
        assignedAgentId: agent?.id ?? undefined,
        relevanceScore: firstNumber(payloadRecord, ["relevanceScore", "relevance_score"]) ?? undefined,
        validationScore: firstNumber(payloadRecord, ["validationScore", "validation_score"]) ?? undefined,
        editorialScore: firstNumber(payloadRecord, ["editorialScore", "editorial_score"]) ?? undefined,
        seoScore: firstNumber(payloadRecord, ["seoScore", "seo_score"]) ?? undefined,
        complianceScore: firstNumber(payloadRecord, ["complianceScore", "compliance_score"]) ?? undefined,
        monetizationScore: firstNumber(payloadRecord, ["monetizationScore", "monetization_score"]) ?? undefined,
        hasAffiliate: booleanValue(firstPayloadValue(payloadRecord, ["hasAffiliate", "has_affiliate"])) ?? undefined,
        requiresHumanReview:
          status === "human_review"
            ? true
            : booleanValue(firstPayloadValue(payloadRecord, ["requiresHumanReview", "requires_human_review"])) ??
              undefined,
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

    const snapshotStage = status ? JOB_STATUS_META[status].stage : currentStage;
    const outputPayload =
      firstPayloadValue(payloadRecord, ["outputPayload", "output_payload", "output", "result", "response"]) ?? {};
    const inputHash = jsonHash(input.payload ?? payloadRecord);
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
          inputPayload: asJson(input.payload ?? payloadRecord),
          outputPayload: asJson(outputPayload),
          inputHash,
          outputHash
        }
      });
    }

    const sourceUrlValue = firstString(payloadRecord, ["sourceUrl", "source_url", "url", "link"]);
    if (sourceUrlValue) {
      const existingSource = await prisma.source.findFirst({ where: { jobId, url: sourceUrlValue } });
      if (!existingSource) {
        await prisma.source.create({
          data: {
            jobId,
            name: sourceName,
            url: sourceUrlValue,
            role: "primary",
            reliabilityScore: firstNumber(payloadRecord, ["reliabilityScore", "reliability_score"]) ?? 80
          }
        });
      }
    }

    jobUpdated = true;
    jobCreated = !existing;
    if (agent) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          currentTaskId: job.jobId,
          lastActivityAt: new Date(),
          status: status && ["published", "drafted", "discarded", "failed"].includes(status) ? "online" : "busy"
        }
      });
    }
  }

  await createAuditLog({
    jobId,
    agentId: agent?.id,
    eventType: jobCreated ? "job_created" : status === "failed" ? "failed" : "webhook_received",
    severity,
    stage: status ? JOB_STATUS_META[status].stage : input.event,
    decision: status,
    score: numberValue(payloadRecord?.score),
    message: `Update OpenClaw recebido: ${input.event}.`,
    inputPayload: input
  });

  return { accepted: true, updatedJob: jobUpdated, createdJob: jobCreated, jobId, status };
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
