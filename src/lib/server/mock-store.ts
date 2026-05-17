import { JOB_STATUS_META, RUNNING_STATUSES } from "@/lib/domain";
import {
  seedAgents,
  seedJobs,
  seedLogs,
  seedPayloads,
  seedReviews,
  seedSettings,
  seedSources
} from "@/lib/mock/seed-data";
import type { AgentStatus, JobPriority, JobStatus, LogSeverity } from "@/lib/types";

// Mock route payloads intentionally mirror loosely shaped JSON from Prisma includes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
type AuditInput = {
  jobId?: string | null;
  agentId?: string | null;
  eventType: string;
  severity?: LogSeverity;
  stage?: string | null;
  decision?: string | null;
  score?: number | null;
  message: string;
  inputPayload?: unknown;
  outputPayload?: unknown;
  errorPayload?: unknown;
};

const globalForMockStore = globalThis as unknown as { techsoulsMockStore?: MockStore };

function iso(date: Date | string | null | undefined) {
  return date ? new Date(date).toISOString() : null;
}

function now() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isDatabaseUnavailable(error: unknown) {
  if (!isMockFallbackEnabled()) return false;
  const message = String(error instanceof Error ? error.message : error);
  const code = (error as { code?: string } | null)?.code;
  return code === "ECONNREFUSED" || message.includes("ECONNREFUSED") || message.includes("Can't reach database");
}

export function isMockFallbackEnabled() {
  const value = process.env.ALLOW_MOCK_FALLBACK;
  if (value === undefined) return process.env.NODE_ENV !== "production";
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

class MockStore {
  agents: AnyRecord[];
  jobs: AnyRecord[];
  logs: AnyRecord[];
  payloads: AnyRecord[];
  sources: AnyRecord[];
  reviews: AnyRecord[];
  settings: AnyRecord[];

  constructor() {
    const agentIds = new Map(seedAgents.map((agent) => [agent.slug, `agent-${agent.slug}`]));

    this.agents = seedAgents.map((agent, index) => ({
      ...agent,
      id: agentIds.get(agent.slug),
      currentTaskId: agent.currentTaskId ?? null,
      lastHeartbeatAt: iso(new Date(Date.now() - (index + 1) * 90_000)),
      lastActivityAt: iso(new Date(Date.now() - (index + 2) * 120_000)),
      createdAt: iso(new Date("2026-05-17T09:00:00.000Z")),
      updatedAt: now()
    }));

    this.jobs = seedJobs.map((job) => ({
      ...job,
      id: `job-${job.jobId}`,
      assignedAgentId: job.assignedAgentSlug ? agentIds.get(job.assignedAgentSlug) ?? null : null,
      assignedAgentSlug: undefined,
      clusterId: job.clusterId ?? null,
      relevanceScore: job.relevanceScore ?? null,
      validationScore: job.validationScore ?? null,
      editorialScore: job.editorialScore ?? null,
      seoScore: job.seoScore ?? null,
      complianceScore: job.complianceScore ?? null,
      monetizationScore: job.monetizationScore ?? null,
      wordpressPostId: job.wordpressPostId ?? null,
      wordpressPreviewUrl: job.wordpressPreviewUrl ?? null,
      errorMessage: job.errorMessage ?? null,
      articleMarkdown: job.articleMarkdown ?? null,
      createdAt: iso(job.createdAt),
      updatedAt: iso(new Date(new Date(job.createdAt).getTime() + 26 * 60_000))
    }));

    this.logs = seedLogs.map((log, index) => ({
      ...log,
      id: `log-${String(index + 1).padStart(4, "0")}`,
      agentId: log.agentSlug ? agentIds.get(log.agentSlug) ?? null : null,
      agentSlug: undefined,
      jobId: log.jobId ?? null,
      stage: log.stage ?? null,
      decision: log.decision ?? null,
      score: log.score ?? null,
      inputPayload: log.inputPayload ?? null,
      outputPayload: log.outputPayload ?? null,
      errorPayload: log.errorPayload ?? null,
      createdAt: iso(log.createdAt)
    }));

    this.payloads = seedPayloads.map((payload, index) => ({
      ...payload,
      id: `payload-${String(index + 1).padStart(4, "0")}`,
      agentId: payload.agentSlug ? agentIds.get(payload.agentSlug) ?? null : null,
      agentSlug: undefined,
      createdAt: iso(payload.createdAt)
    }));

    this.sources = seedSources.map((source, index) => ({
      ...source,
      id: `source-${String(index + 1).padStart(4, "0")}`,
      publishedAt: iso(source.publishedAt),
      createdAt: now()
    }));

    this.reviews = seedReviews.map((review, index) => ({
      ...review,
      id: `review-${String(index + 1).padStart(4, "0")}`,
      reviewerComment: review.reviewerComment ?? null,
      decision: review.decision ?? null,
      createdAt: iso(new Date(Date.now() - (index + 1) * 480_000)),
      updatedAt: now()
    }));

    this.settings = seedSettings.map((setting, index) => ({
      ...setting,
      id: `setting-${index + 1}`,
      createdAt: now(),
      updatedAt: now()
    }));
  }

  private agentLite(agentId: string | null | undefined) {
    if (!agentId) return null;
    const agent = this.agents.find((item) => item.id === agentId);
    return agent ? { id: agent.id, name: agent.name, slug: agent.slug } : null;
  }

  private jobLite(jobId: string | null | undefined) {
    if (!jobId) return null;
    const job = this.jobs.find((item) => item.jobId === jobId);
    return job ? { jobId: job.jobId, title: job.title, status: job.status } : null;
  }

  private enrichLog(log: AnyRecord) {
    return {
      ...log,
      agent: this.agentLite(log.agentId),
      job: this.jobLite(log.jobId)
    };
  }

  private enrichJob(job: AnyRecord) {
    return {
      ...job,
      assignedAgent: job.assignedAgentId
        ? this.agents.find((agent) => agent.id === job.assignedAgentId) ?? null
        : null,
      sources: this.sources.filter((source) => source.jobId === job.jobId),
      payloadSnapshots: this.payloads
        .filter((payload) => payload.jobId === job.jobId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      humanReviews: this.reviews
        .filter((review) => review.jobId === job.jobId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      logs: this.logs
        .filter((log) => log.jobId === job.jobId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40)
        .map((log) => this.enrichLog(log))
    };
  }

  private enrichAgent(agent: AnyRecord) {
    const currentTask = agent.currentTaskId
      ? this.jobs.find((job) => job.jobId === agent.currentTaskId) ?? null
      : null;
    return {
      ...agent,
      currentTask,
      logs: this.logs
        .filter((log) => log.agentId === agent.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 80)
        .map((log) => this.enrichLog(log)),
      payloadSnapshots: this.payloads
        .filter((payload) => payload.agentId === agent.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20),
      assignedJobs: this.jobs
        .filter((job) => job.assignedAgentId === agent.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 20)
    };
  }

  private audit(input: AuditInput) {
    const log = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobId: input.jobId ?? null,
      agentId: input.agentId ?? null,
      eventType: input.eventType,
      severity: input.severity ?? "info",
      stage: input.stage ?? null,
      decision: input.decision ?? null,
      score: input.score ?? null,
      message: input.message,
      inputPayload: input.inputPayload ?? null,
      outputPayload: input.outputPayload ?? null,
      errorPayload: input.errorPayload ?? null,
      createdAt: now()
    };
    this.logs.unshift(log);
    return this.enrichLog(log);
  }

  dashboard() {
    const completed = this.jobs.filter((job) => ["published", "drafted"].includes(job.status)).length;
    const failed = this.jobs.filter((job) => job.status === "failed").length;
    const totalTerminal = completed + failed;
    const tasksByStatus = Object.entries(
      this.jobs.reduce<Record<string, number>>((acc, job) => {
        acc[job.status] = (acc[job.status] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([status, total]) => ({
      status,
      total,
      label: JOB_STATUS_META[status as JobStatus].label
    }));
    const tasksByAgent = Object.entries(
      this.jobs.reduce<Record<string, number>>((acc, job) => {
        const name = this.agents.find((agent) => agent.id === job.assignedAgentId)?.name ?? "Sem agente";
        acc[name] = (acc[name] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([agent, total]) => ({ agent, total }));

    return clone({
      totalAgents: this.agents.length,
      agentsOnline: this.agents.filter((agent) => ["online", "busy", "idle"].includes(agent.status)).length,
      agentsBusy: this.agents.filter((agent) => agent.status === "busy").length,
      agentsOffline: this.agents.filter((agent) => agent.status === "offline").length,
      agentsError: this.agents.filter((agent) => agent.status === "error").length,
      queuedTasks: this.jobs.filter((job) => job.status === "new").length,
      runningTasks: this.jobs.filter((job) => RUNNING_STATUSES.includes(job.status)).length,
      humanReviewTasks: this.jobs.filter((job) => job.status === "human_review").length,
      publishedToday: this.jobs.filter((job) => job.status === "published").length,
      draftedTasks: this.jobs.filter((job) => job.status === "drafted").length,
      failedTasks: failed,
      successRate: totalTerminal === 0 ? 100 : (completed / totalTerminal) * 100,
      averageProcessingTimeMs:
        this.agents.reduce((sum, agent) => sum + agent.averageProcessingTimeMs, 0) /
        Math.max(1, this.agents.length),
      tasksByStatus,
      tasksByAgent,
      recentLogs: this.logs.slice(0, 12).map((log) => this.enrichLog(log)),
      criticalAlerts: this.logs
        .filter((log) => ["error", "critical"].includes(log.severity))
        .slice(0, 5)
        .map((log) => this.enrichLog(log))
    });
  }

  listAgents() {
    return clone(this.agents.map((agent) => this.enrichAgent(agent)));
  }

  getAgent(id: string) {
    const agent = this.agents.find((item) => item.id === id || item.slug === id);
    return agent ? clone(this.enrichAgent(agent)) : null;
  }

  setAgentStatus(id: string, status: AgentStatus, eventType: string, message: string) {
    const agent = this.agents.find((item) => item.id === id || item.slug === id);
    if (!agent) return null;
    agent.status = status;
    agent.lastActivityAt = now();
    agent.lastHeartbeatAt = status === "online" ? now() : agent.lastHeartbeatAt;
    agent.updatedAt = now();
    this.audit({ agentId: agent.id, eventType, severity: status === "paused" ? "warning" : "info", message });
    return clone(this.enrichAgent(agent));
  }

  listTasks(filters?: { status?: string | null; priority?: string | null; q?: string | null }) {
    let jobs = [...this.jobs];
    if (filters?.status) jobs = jobs.filter((job) => job.status === filters.status);
    if (filters?.priority) jobs = jobs.filter((job) => job.priority === filters.priority);
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      jobs = jobs.filter((job) => `${job.title} ${job.topic} ${job.jobId}`.toLowerCase().includes(q));
    }
    return clone(jobs.map((job) => this.enrichJob(job)));
  }

  getTask(jobId: string) {
    const job = this.jobs.find((item) => item.jobId === jobId);
    return job ? clone(this.enrichJob(job)) : null;
  }

  createTask(body: AnyRecord) {
    const jobId = `ts-${new Date().toISOString().slice(0, 10)}-${String(this.jobs.length + 1).padStart(4, "0")}`;
    const job = {
      id: `job-${jobId}`,
      jobId,
      ...body,
      clusterId: null,
      currentStage: "Entrada",
      status: "new",
      assignedAgentId: null,
      relevanceScore: null,
      validationScore: null,
      editorialScore: null,
      seoScore: null,
      complianceScore: null,
      monetizationScore: null,
      wordpressPostId: null,
      wordpressPreviewUrl: null,
      errorMessage: null,
      articleMarkdown: null,
      createdAt: now(),
      updatedAt: now()
    };
    this.jobs.unshift(job);
    this.audit({ jobId, eventType: "job_created", message: `Job ${jobId} criado em modo mock.`, inputPayload: body });
    return clone(this.enrichJob(job));
  }

  updateTaskStatus(jobId: string, status: JobStatus, reason?: string) {
    const job = this.jobs.find((item) => item.jobId === jobId);
    if (!job) return null;
    job.status = status;
    job.currentStage = JOB_STATUS_META[status].stage;
    job.requiresHumanReview = status === "human_review" ? true : job.requiresHumanReview;
    job.errorMessage = status === "failed" ? reason ?? "Falha registrada manualmente." : job.errorMessage;
    job.updatedAt = now();
    this.audit({
      jobId,
      agentId: job.assignedAgentId,
      eventType: "task_status_changed",
      severity: status === "failed" ? "error" : "info",
      stage: job.currentStage,
      decision: status,
      message: `Status alterado para ${status} em modo mock.`,
      inputPayload: { status, reason }
    });
    return clone(this.enrichJob(job));
  }

  retryTask(jobId: string) {
    const job = this.updateTaskStatus(jobId, "new", "Retry manual");
    this.audit({ jobId, eventType: "task_retried", severity: "warning", message: `Retry mockado enviado para ${jobId}.` });
    return job ? { job, queueResult: { queued: true, queueName: "techsouls:mock" } } : null;
  }

  cancelTask(jobId: string) {
    const job = this.updateTaskStatus(jobId, "discarded", "Cancelado manualmente");
    this.audit({ jobId, eventType: "task_cancelled", severity: "warning", message: `Job ${jobId} cancelado em modo mock.` });
    return job;
  }

  assignTask(jobId: string, agentId: string) {
    const job = this.jobs.find((item) => item.jobId === jobId);
    if (!job) return null;
    job.assignedAgentId = agentId;
    job.updatedAt = now();
    this.audit({ jobId, agentId, eventType: "task_assigned", message: `Job ${jobId} atribuido em modo mock.` });
    return clone(this.enrichJob(job));
  }

  setPriority(jobId: string, priority: JobPriority) {
    const job = this.jobs.find((item) => item.jobId === jobId);
    if (!job) return null;
    job.priority = priority;
    job.updatedAt = now();
    this.audit({ jobId, eventType: "priority_changed", decision: priority, message: `Prioridade alterada para ${priority}.` });
    return clone(this.enrichJob(job));
  }

  queue() {
    return clone(
      this.jobs
        .filter((job) => ["new", "failed", "human_review"].includes(job.status))
        .map((job, index) => ({
          ...this.enrichJob(job),
          attempts: job.status === "failed" ? 3 : index % 3,
          retryDelaySeconds: job.status === "failed" ? 300 : 0,
          nextAgent: this.agents.find((agent) => agent.id === job.assignedAgentId)?.name ?? "Orchestrator"
        }))
    );
  }

  reviewQueue() {
    return clone(
      this.reviews
        .filter((review) => review.status === "pending")
        .map((review) => ({ ...review, job: this.getTask(review.jobId) }))
    );
  }

  reviewDecision(jobId: string, action: "approve" | "reject" | "draft" | "return-to-writer" | "return-to-validator", comment?: string) {
    const review = this.reviews.find((item) => item.jobId === jobId && item.status === "pending");
    if (review) {
      review.reviewerComment = comment ?? null;
      review.updatedAt = now();
    }
    if (action === "approve") {
      if (review) Object.assign(review, { status: "approved", decision: "approved" });
      return this.updateTaskStatus(jobId, "publishing", "Aprovado por revisão humana");
    }
    if (action === "draft") {
      if (review) Object.assign(review, { status: "approved", decision: "drafted" });
      return this.updateTaskStatus(jobId, "drafted", "Salvo como rascunho");
    }
    if (action === "reject") {
      if (review) Object.assign(review, { status: "rejected", decision: "rejected" });
      return this.updateTaskStatus(jobId, "discarded", "Rejeitado por revisão humana");
    }
    if (action === "return-to-writer") {
      if (review) Object.assign(review, { status: "returned_to_writer", decision: "returned_to_writer" });
      return this.updateTaskStatus(jobId, "writing", "Devolvido para Writer");
    }
    if (review) Object.assign(review, { status: "returned_to_validator", decision: "returned_to_validator" });
    return this.updateTaskStatus(jobId, "validating", "Devolvido para Validator");
  }

  auditLogs(filters?: { jobId?: string | null; agentId?: string | null; severity?: string | null; eventType?: string | null }) {
    let logs = [...this.logs];
    if (filters?.jobId) logs = logs.filter((log) => log.jobId === filters.jobId);
    if (filters?.agentId) logs = logs.filter((log) => log.agentId === filters.agentId);
    if (filters?.severity) logs = logs.filter((log) => log.severity === filters.severity);
    if (filters?.eventType) logs = logs.filter((log) => log.eventType === filters.eventType);
    return clone(logs.slice(0, 250).map((log) => this.enrichLog(log)));
  }

  createAudit(input: AuditInput) {
    return clone(this.audit(input));
  }

  listSettings() {
    return clone(this.settings);
  }

  updateSettings(values: Record<string, unknown>) {
    for (const [key, value] of Object.entries(values)) {
      const current = this.settings.find((setting) => setting.key === key);
      if (current) {
        current.value = value;
        current.updatedAt = now();
      } else {
        this.settings.push({ id: `setting-${this.settings.length + 1}`, key, value, createdAt: now(), updatedAt: now() });
      }
    }
    return this.listSettings();
  }
}

export const mockStore = globalForMockStore.techsoulsMockStore ?? new MockStore();
globalForMockStore.techsoulsMockStore = mockStore;
