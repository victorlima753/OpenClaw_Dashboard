import { z } from "zod";

export const agentStatusSchema = z.enum(["online", "idle", "busy", "paused", "offline", "error"]);

export const jobStatusSchema = z.enum([
  "new",
  "researching",
  "relevance_scoring",
  "clustering",
  "validating",
  "writing",
  "seo_optimizing",
  "affiliate_routing",
  "copywriting",
  "editing",
  "compliance_checking",
  "publishing",
  "drafted",
  "published",
  "human_review",
  "discarded",
  "failed"
]);

export const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const severitySchema = z.enum(["info", "warning", "error", "critical"]);

export const auditEventTypeSchema = z.enum([
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
]);

export const createTaskSchema = z.object({
  title: z.string().min(3),
  topic: z.string().min(2),
  category: z.string().min(2),
  sourceName: z.string().min(2),
  sourceUrl: z.string().url(),
  priority: prioritySchema.default("normal"),
  hasAffiliate: z.boolean().default(false),
  requiresHumanReview: z.boolean().default(false)
});

export const updateStatusSchema = z.object({
  status: jobStatusSchema,
  reason: z.string().optional(),
  manual: z.boolean().default(true)
});

export const assignTaskSchema = z.object({
  agentId: z.string().min(1)
});

export const priorityUpdateSchema = z.object({
  priority: prioritySchema
});

export const reviewDecisionSchema = z.object({
  comment: z.string().optional()
});

export const auditCreateSchema = z.object({
  jobId: z.string().optional(),
  agentId: z.string().optional(),
  eventType: auditEventTypeSchema,
  severity: severitySchema.default("info"),
  stage: z.string().optional(),
  decision: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  message: z.string().min(1),
  inputPayload: z.unknown().optional(),
  outputPayload: z.unknown().optional(),
  errorPayload: z.unknown().optional()
});

export const webhookEventSchema = z.object({
  jobId: z.string().optional(),
  agentSlug: z.string().optional(),
  event: z.string().min(1),
  status: z.string().optional(),
  source: z.string().optional(),
  timestamp: z.string().optional(),
  payload: z.unknown().optional()
});

export const openClawJobPayloadSchema = z
  .object({
    jobId: z.string().optional(),
    job_id: z.string().optional(),
    externalId: z.string().optional(),
    external_id: z.string().optional(),
    title: z.string().optional(),
    topic: z.string().optional(),
    category: z.string().optional(),
    sourceName: z.string().optional(),
    source_name: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    source_url: z.string().url().optional(),
    status: jobStatusSchema.optional(),
    currentStage: z.string().optional(),
    current_stage: z.string().optional(),
    priority: prioritySchema.optional(),
    agentId: z.string().optional(),
    agent_id: z.string().optional(),
    relevanceScore: z.number().int().min(0).max(100).optional(),
    relevance_score: z.number().int().min(0).max(100).optional(),
    validationScore: z.number().int().min(0).max(100).optional(),
    validation_score: z.number().int().min(0).max(100).optional(),
    complianceScore: z.number().int().min(0).max(100).nullable().optional(),
    compliance_score: z.number().int().min(0).max(100).nullable().optional(),
    hasAffiliate: z.boolean().optional(),
    has_affiliate: z.boolean().optional(),
    requiresHumanReview: z.boolean().optional(),
    requires_human_review: z.boolean().optional(),
    outputPayload: z.unknown().optional(),
    output_payload: z.unknown().optional()
  })
  .passthrough();

export const settingsUpdateSchema = z.record(z.string(), z.unknown());
