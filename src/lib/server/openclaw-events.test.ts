import { describe, expect, it } from "vitest";
import { extractOpenClawAgentActivities, extractOpenClawAgents } from "./openclaw-events";

describe("extractOpenClawAgents", () => {
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
        expect.objectContaining({ externalId: "orchestrator", status: "offline" }),
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
});
