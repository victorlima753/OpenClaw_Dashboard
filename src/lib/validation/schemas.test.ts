import { describe, expect, it } from "vitest";
import { auditCreateSchema, createTaskSchema, updateStatusSchema } from "./schemas";

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
});
