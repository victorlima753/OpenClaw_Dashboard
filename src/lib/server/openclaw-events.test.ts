import { describe, expect, it } from "vitest";
import { extractOpenClawAgents } from "./openclaw-events";

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
});
