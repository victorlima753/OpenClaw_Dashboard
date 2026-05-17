import { mockOpenClawAdapter } from "./mock";
import {
  buildConnectRequest,
  buildRpcRequest,
  gatewayErrorMessage,
  isConnectChallenge,
  isGatewayResponse,
  parseGatewayMessage
} from "./openclaw-protocol";
import type { OpenClawAdapter, OpenClawCommand, OpenClawCommandResult } from "./types";

function configuredUrl() {
  return process.env.OPENCLAW_GATEWAY_WS_URL?.trim();
}

export function isRealOpenClawEnabled() {
  const url = configuredUrl();
  return Boolean(url && url !== "mock" && process.env.OPENCLAW_USE_MOCK !== "true");
}

function gatewayUrl() {
  const url = configuredUrl();
  if (!url) {
    if (process.env.NODE_ENV === "production") throw new Error("OPENCLAW_GATEWAY_WS_URL nao configurado.");
    return "mock";
  }
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  const authMode = process.env.OPENCLAW_AUTH_MODE ?? "query";
  if (!token || authMode !== "query") return url;

  const parsed = new URL(url);
  parsed.searchParams.set("token", token);
  return parsed.toString();
}

class RealOpenClawAdapter implements OpenClawAdapter {
  async receiveAgentEvent(event: { agentSlug: string; jobId?: string; event: string; payload?: unknown }) {
    return {
      accepted: true,
      message: `Evento OpenClaw recebido de ${event.agentSlug}.`
    };
  }

  async receiveTaskUpdate(jobId: string) {
    return {
      accepted: true,
      message: `Atualizacao OpenClaw aceita para ${jobId}.`
    };
  }

  async getStatus() {
    return this.sendCommand({ type: "status", payload: {} });
  }

  async sendCommand(command: OpenClawCommand): Promise<OpenClawCommandResult> {
    if (!isRealOpenClawEnabled()) return mockOpenClawAdapter.sendCommand(command);
    if (typeof WebSocket === "undefined") {
      throw new Error("Runtime sem suporte a WebSocket global. Use Node.js 22+ no EasyPanel.");
    }

    const requestId = crypto.randomUUID();
    const connectId = crypto.randomUUID();
    const timeoutMs = Number(process.env.OPENCLAW_COMMAND_TIMEOUT_MS ?? 8000);

    return new Promise((resolve, reject) => {
      let settled = false;
      let connected = false;
      const ws = new WebSocket(gatewayUrl());
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        ws.close();
        reject(new Error(`Timeout aguardando resposta do OpenClaw para ${command.type}.`));
      }, timeoutMs);

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
        ws.close();
      };

      ws.addEventListener("message", (event) => {
        try {
          const message = parseGatewayMessage(event.data);

          if (isConnectChallenge(message)) {
            ws.send(JSON.stringify(buildConnectRequest(connectId, message.payload ?? {})));
            return;
          }

          if (isGatewayResponse(message, connectId)) {
            if (!message.ok) {
              settle(() => reject(new Error(`Handshake OpenClaw rejeitado: ${gatewayErrorMessage(message.error)}`)));
              return;
            }
            connected = true;
            ws.send(JSON.stringify(buildRpcRequest(command.type, requestId, command.payload)));
            return;
          }

          if (!isGatewayResponse(message, requestId)) return;
          settle(() =>
            resolve({
              accepted: Boolean(message.ok),
              message: message.ok
                ? `Comando ${command.type} aceito pelo OpenClaw.`
                : `Comando ${command.type} rejeitado pelo OpenClaw: ${gatewayErrorMessage(message.error)}`,
              requestId,
              response: message
            })
          );
        } catch (error) {
          settle(() => reject(error));
        }
      });

      ws.addEventListener("error", () => {
        settle(() => reject(new Error(`Falha WebSocket ao enviar ${command.type} para OpenClaw.`)));
      });

      ws.addEventListener("close", () => {
        if (!settled) {
          const phase = connected ? `resposta de ${command.type}` : "handshake connect";
          settle(() => reject(new Error(`Conexao OpenClaw fechada antes de concluir ${phase}.`)));
        }
      });
    });
  }
}

export const realOpenClawAdapter = new RealOpenClawAdapter();

export function getOpenClawAdapter() {
  if (process.env.NODE_ENV === "production" && process.env.OPENCLAW_USE_MOCK !== "true") return realOpenClawAdapter;
  return isRealOpenClawEnabled() ? realOpenClawAdapter : mockOpenClawAdapter;
}
