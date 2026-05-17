import { describe, expect, it, vi } from "vitest";
import { buildConnectRequest, buildRpcRequest, isConnectChallenge, parseGatewayMessage } from "./openclaw-protocol";

describe("OpenClaw gateway protocol helpers", () => {
  it("detects the pre-connect challenge frame", () => {
    const message = parseGatewayMessage(
      JSON.stringify({ type: "event", event: "connect.challenge", payload: { nonce: "abc" } })
    );

    expect(isConnectChallenge(message)).toBe(true);
  });

  it("builds a connect request using gateway shared-secret auth", () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "token-123");
    vi.stubEnv("OPENCLAW_PROTOCOL_VERSION", "4");

    const request = buildConnectRequest("connect-id", { nonce: "nonce-123" });

    expect(request).toMatchObject({
      type: "req",
      id: "connect-id",
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 4,
        client: { id: "gateway-client", mode: "operator" },
        role: "operator",
        auth: { token: "token-123" }
      }
    });

    vi.unstubAllEnvs();
  });

  it("wraps OpenClaw RPC methods in request frames", () => {
    expect(buildRpcRequest("status", "request-id", {})).toEqual({
      type: "req",
      id: "request-id",
      method: "status",
      params: {}
    });
  });
});
