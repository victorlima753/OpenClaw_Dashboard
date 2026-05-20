import { describe, expect, it } from "vitest";
import {
  auditCreateSchema,
  createTaskSchema,
  inoreaderItemSchema,
  n8nAffiliateResultSchema,
  techSoulsJobUpdateSchema,
  updateStatusSchema,
  wordpressPublishResultSchema
} from "./schemas";

describe("api validation schemas", () => {
  it("accepts valid task creation payloads", () => {
    const parsed = createTaskSchema.parse({
      title: "Nova pauta sobre IA",
      topic: "IA generativa",
      category: "Inteligência Artificial",
      sourceName: "TechSouls Research",
      sourceUrl: "https://example.com/source",
      priority: "high",
      hasAffiliate: true,
      requiresHumanReview: false
    });

    expect(parsed.priority).toBe("high");
  });

  it("rejects invalid manual status transitions", () => {
    expect(() => updateStatusSchema.parse({ status: "done" })).toThrow();
  });

  it("validates audit log contracts", () => {
    const parsed = auditCreateSchema.parse({
      jobId: "ts-2026-05-17-0001",
      eventType: "task_status_changed",
      message: "Movido manualmente no Kanban",
      inputPayload: { from: "writing", to: "human_review" }
    });

    expect(parsed.severity).toBe("info");
  });

  it("validates the TechSouls OpenClaw job update contract", () => {
    const parsed = techSoulsJobUpdateSchema.parse({
      event: "article_written",
      jobId: "ts-openclaw-2026-05-18-0001",
      agentExternalId: "writer",
      status: "seo_optimizing",
      completedStage: "writing",
      idempotencyKey: "writer:ts-openclaw-2026-05-18-0001:article_written:1",
      payload: {
        title: "Titulo da pauta",
        sourceName: "TechSouls",
        sourceUrl: "https://techsouls.com.br/",
        scores: { relevance: 91, validation: 88 },
        sources: [{ name: "Fonte", url: "https://example.com", reliabilityScore: 85 }]
      }
    });

    expect(parsed.jobId).toBe("ts-openclaw-2026-05-18-0001");
    expect(parsed.severity).toBe("info");
    expect(parsed.payload.sources?.[0].role).toBe("reference");
  });

  it("rejects OpenClaw job updates without jobId", () => {
    expect(() =>
      techSoulsJobUpdateSchema.parse({
        event: "article_written",
        agentExternalId: "writer",
        status: "seo_optimizing",
        payload: {}
      })
    ).toThrow();
  });

  it("validates the canonical OpenClaw agent stage payloads", () => {
    const jobId = "ts-openclaw-2026-05-18-0001";
    const stages = [
      ["editorial", "job_created", "researching", "new"],
      ["researcher", "research_completed", "relevance_scoring", "researching"],
      ["relevance-classifier", "relevance_scored", "clustering", "relevance_scoring"],
      ["dedup-cluster", "cluster_completed", "validating", "clustering"],
      ["validator", "validation_completed", "writing", "validating"],
      ["writer", "article_written", "seo_optimizing", "writing"],
      ["seo-agent", "seo_completed", "affiliate_routing", "seo_optimizing"],
      ["affiliate-agent", "affiliate_decided", "copywriting", "affiliate_routing"],
      ["copywriter", "copy_completed", "editing", "copywriting"],
      ["editor-final", "editorial_completed", "compliance_checking", "editing"],
      ["compliance-agent", "compliance_completed", "publishing", "compliance_checking"],
      ["wp-publisher", "published", "published", "publishing"],
      ["social-agent", "social_completed", "published", "published"],
      ["analytics-cro", "analytics_completed", "published", "published"],
      ["audit-agent", "audit_completed", "published", "published"]
    ];

    for (const [agentExternalId, event, status, completedStage] of stages) {
      expect(
        techSoulsJobUpdateSchema.parse({
          event,
          jobId,
          agentExternalId,
          status,
          completedStage,
          idempotencyKey: `${agentExternalId}:${jobId}:${event}:1`,
          payload: {
            title: "Pauta TechSouls",
            topic: "OpenClaw",
            category: "IA",
            sourceName: "TechSouls",
            sourceUrl: "https://techsouls.com.br/",
            scores: { relevance: 80 },
            sources: [{ name: "Fonte", url: "https://example.com" }]
          }
        }).agentExternalId
      ).toBe(agentExternalId);
    }
  });

  it("rejects OpenClaw job updates without idempotency key", () => {
    expect(() =>
      techSoulsJobUpdateSchema.parse({
        event: "article_written",
        jobId: "ts-openclaw-2026-05-18-0001",
        agentExternalId: "writer",
        status: "seo_optimizing",
        completedStage: "writing",
        payload: {}
      })
    ).toThrow();
  });

  it("rejects OpenClaw job updates without payload", () => {
    expect(() =>
      techSoulsJobUpdateSchema.parse({
        event: "article_written",
        jobId: "ts-openclaw-2026-05-18-0001",
        agentExternalId: "writer",
        status: "seo_optimizing",
        completedStage: "writing",
        idempotencyKey: "writer:ts-openclaw-2026-05-18-0001:article_written:1"
      })
    ).toThrow();
  });

  it("validates real integration webhook contracts", () => {
    expect(
      n8nAffiliateResultSchema.parse({
        jobId: "ts-real-0001",
        idempotencyKey: "n8n:ts-real-0001:1",
        payload: { hasAffiliate: true, monetizationScore: 84, affiliateUrl: "https://example.com/deal" }
      }).status
    ).toBe("accepted");

    expect(
      wordpressPublishResultSchema.parse({
        jobId: "ts-real-0001",
        idempotencyKey: "wp:ts-real-0001:1",
        status: "published",
        payload: { wordpressPostId: "123", wordpressPreviewUrl: "https://techsouls.com.br/post" }
      }).status
    ).toBe("published");

    expect(
      inoreaderItemSchema.parse({
        jobId: "ts-inoreader-0001",
        idempotencyKey: "inoreader:item:1",
        payload: {
          title: "Nova pauta real",
          sourceName: "Inoreader",
          sourceUrl: "https://example.com/news",
          relevanceHint: 77
        }
      }).payload.relevanceHint
    ).toBe(77);
  });

  it("rejects integration webhooks without idempotency keys", () => {
    expect(() => n8nAffiliateResultSchema.parse({ jobId: "ts-real-0001", payload: {} })).toThrow();
    expect(() => wordpressPublishResultSchema.parse({ jobId: "ts-real-0001", status: "published", payload: {} })).toThrow();
    expect(() =>
      inoreaderItemSchema.parse({
        jobId: "ts-real-0001",
        payload: { title: "Pauta", sourceName: "Fonte", sourceUrl: "https://example.com" }
      })
    ).toThrow();
  });
});
