import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  agent: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  articleJob: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  payloadSnapshot: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  source: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  humanReview: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  agentLog: {
    findFirst: vi.fn(),
    create: vi.fn()
  }
}));

const reconcileAgentsForJobChangeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/server/agent-state", () => ({
  reconcileAgentsForJobChange: reconcileAgentsForJobChangeMock
}));

import {
  applyOpenClawTaskUpdate,
  bestOpenClawAgentForDashboardAgent,
  extractOpenClawAgentActivities,
  extractOpenClawAgents,
  openClawAgentMap
} from "./openclaw-events";

describe("extractOpenClawAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ships the TechSouls agent map with editorial aliases by default", () => {
    vi.stubEnv("OPENCLAW_AGENT_MAP_JSON", "");

    expect(openClawAgentMap()["techsouls-trend-editorial"]).toEqual([
      "editorial",
      "trend-editorial",
      "trend-editorial-agent",
      "editorial-agent",
      "trend-agent"
    ]);
    expect(openClawAgentMap()["techsouls-final-editor"]).toEqual(["editor-final"]);

    vi.unstubAllEnvs();
  });

  it("merges configured aliases with the built-in TechSouls map", () => {
    vi.stubEnv("OPENCLAW_AGENT_MAP_JSON", JSON.stringify({ "techsouls-final-editor": "final-reviewer" }));

    expect(openClawAgentMap()["techsouls-final-editor"]).toEqual(["editor-final", "final-reviewer"]);

    vi.unstubAllEnvs();
  });

  it("does not let legacy config map editorial back to the final editor", () => {
    vi.stubEnv(
      "OPENCLAW_AGENT_MAP_JSON",
      JSON.stringify({ "techsouls-final-editor": ["editorial", "editor-final"] })
    );

    expect(openClawAgentMap()["techsouls-trend-editorial"]).toContain("editorial");
    expect(openClawAgentMap()["techsouls-final-editor"]).toEqual(["editor-final"]);

    vi.unstubAllEnvs();
  });

  it("reads the Gateway status response where agents are keyed by agentId", () => {
    const agents = extractOpenClawAgents({
      type: "res",
      ok: true,
      payload: {
        agents: {
          orchestrator: { enabled: false, every: "disabled" },
          "relevance-classifier": { enabled: false, every: "disabled" }
        },
        heartbeats: {
          orchestrator: { updatedAt: Date.now(), age: 10_000 },
          "relevance-classifier": { updatedAt: Date.now() - 500_000, age: 500_000 }
        }
      }
    });

    expect(agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: "orchestrator", status: "online" }),
        expect.objectContaining({ externalId: "relevance-classifier", status: "offline" })
      ])
    );
  });

  it("reads the Gateway heartbeat agents array", () => {
    const agents = extractOpenClawAgents({
      type: "res",
      ok: true,
      payload: {
        heartbeat: {
          agents: [
            { agentId: "orchestrator", enabled: false, every: "disabled" },
            { agentId: "writer", enabled: true, every: "30m" }
          ]
        }
      }
    });

    expect(agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: "orchestrator", status: undefined }),
        expect.objectContaining({ externalId: "writer", status: "online" })
      ])
    );
  });

  it("reads recent sessions by agent from Gateway status", () => {
    const activities = extractOpenClawAgentActivities({
      type: "res",
      ok: true,
      payload: {
        sessions: {
          byAgent: [
            {
              agentId: "writer",
              recent: [
                {
                  agentId: "writer",
                  sessionId: "session-1",
                  updatedAt: 1779053939504,
                  model: "gemini-flash-latest",
                  inputTokens: 100,
                  outputTokens: 25
                }
              ]
            }
          ]
        }
      }
    });

    expect(activities).toEqual([
      expect.objectContaining({
        externalId: "writer",
        sessionId: "session-1",
        model: "gemini-flash-latest",
        inputTokens: 100,
        outputTokens: 25
      })
    ]);
  });

  it("keeps editorial and editor-final mapped to independent dashboard agents", () => {
    vi.stubEnv("OPENCLAW_AGENT_MAP_JSON", "");
    const agents = extractOpenClawAgents({
      type: "res",
      ok: true,
      payload: {
        heartbeat: {
          agents: [
            { agentId: "editor-final", enabled: false, every: "disabled" },
            { agentId: "editorial", enabled: false, every: "disabled" }
          ]
        }
      }
    });

    expect(
      bestOpenClawAgentForDashboardAgent(
        { slug: "techsouls-trend-editorial", name: "Trend / Editorial Agent" },
        agents
      )
    ).toEqual(expect.objectContaining({ externalId: "editorial" }));
    expect(
      bestOpenClawAgentForDashboardAgent(
        { slug: "techsouls-final-editor", name: "Editor Final" },
        agents
      )
    ).toEqual(expect.objectContaining({ externalId: "editor-final" }));

    vi.unstubAllEnvs();
  });

  it("creates an OpenClaw job update with sources, snapshots and human review", async () => {
    const writer = {
      id: "agent-writer",
      name: "Writer",
      slug: "techsouls-blog-writer",
      externalId: "writer"
    };
    prismaMock.agent.findFirst.mockResolvedValue(writer);
    prismaMock.agentLog.findFirst.mockResolvedValue(null);
    prismaMock.articleJob.findUnique.mockResolvedValue(null);
    prismaMock.articleJob.upsert.mockResolvedValue({
      jobId: "ts-openclaw-2026-05-18-0001",
      assignedAgentId: writer.id
    });
    prismaMock.payloadSnapshot.findFirst.mockResolvedValue(null);
    prismaMock.source.findFirst.mockResolvedValue(null);
    prismaMock.humanReview.findFirst.mockResolvedValue(null);
    prismaMock.systemSetting.findUnique.mockResolvedValue(null);
    prismaMock.agent.update.mockResolvedValue(writer);
    prismaMock.payloadSnapshot.create.mockResolvedValue({});
    prismaMock.source.create.mockResolvedValue({});
    prismaMock.humanReview.create.mockResolvedValue({});
    prismaMock.systemSetting.upsert.mockResolvedValue({});
    prismaMock.agentLog.create.mockResolvedValue({});

    const result = await applyOpenClawTaskUpdate({
      event: "article_written",
      jobId: "ts-openclaw-2026-05-18-0001",
      agentExternalId: "writer",
      status: "human_review",
      completedStage: "writing",
      idempotencyKey: "writer:ts-openclaw-2026-05-18-0001:article_written:1",
      payload: {
        title: "Titulo real",
        topic: "OpenClaw",
        category: "IA",
        sourceName: "TechSouls",
        sourceUrl: "https://techsouls.com.br/",
        scores: { relevance: 91, validation: 88, compliance: 72 },
        articleMarkdown: "# Artigo",
        sources: [{ name: "Fonte A", url: "https://example.com/a", reliabilityScore: 85 }],
        outputPayload: { articleMarkdown: "# Artigo" }
      }
    });

    expect(result).toEqual(expect.objectContaining({ accepted: true, createdJob: true, duplicate: false }));
    expect(prismaMock.articleJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          dataSource: "openclaw",
          status: "human_review",
          assignedAgentId: writer.id,
          relevanceScore: 91,
          validationScore: 88,
          complianceScore: 72,
          requiresHumanReview: true
        })
      })
    );
    expect(prismaMock.payloadSnapshot.create).toHaveBeenCalled();
    expect(prismaMock.source.create).toHaveBeenCalled();
    expect(prismaMock.humanReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "pending" }) })
    );
    expect(prismaMock.agentLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stage: "OpenClaw webhook",
          decision: "writer:ts-openclaw-2026-05-18-0001:article_written:1"
        })
      })
    );
  });

  it("deduplicates OpenClaw job updates by idempotency key", async () => {
    prismaMock.agent.findFirst.mockResolvedValue({ id: "agent-writer", name: "Writer", slug: "techsouls-blog-writer" });
    prismaMock.agentLog.findFirst.mockResolvedValue({ id: "log-1", createdAt: new Date() });
    prismaMock.systemSetting.findUnique.mockResolvedValue({ value: { count: 2 } });

    const result = await applyOpenClawTaskUpdate({
      event: "article_written",
      jobId: "ts-openclaw-2026-05-18-0001",
      agentExternalId: "writer",
      status: "seo_optimizing",
      idempotencyKey: "duplicate-key",
      payload: { title: "Titulo real" }
    });

    expect(result).toEqual(expect.objectContaining({ accepted: true, duplicate: true, updatedJob: false }));
    expect(prismaMock.articleJob.upsert).not.toHaveBeenCalled();
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "openclaw_webhook_duplicate_count" },
        update: expect.objectContaining({ value: expect.objectContaining({ count: 3 }) })
      })
    );
  });
});
