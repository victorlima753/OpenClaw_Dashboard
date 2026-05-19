import { describe, expect, it } from "vitest";
import { auditCreateSchema, createTaskSchema, techSoulsJobUpdateSchema, updateStatusSchema } from "./schemas";

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
});
