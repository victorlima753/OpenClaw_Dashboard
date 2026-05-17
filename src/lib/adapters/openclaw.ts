import { mockOpenClawAdapter } from "./mock";
import type { OpenClawAdapter, OpenClawCommand, OpenClawCommandResult } from "./types";

type GatewayMessage = {
  type: string;
  id?: string;
  payload?: unknown;
  timestamp?: string;
};

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

function parseMessage(data: unknown): GatewayMessage {
  if (typeof data === "string") return JSON.parse(data) as GatewayMessage;
  if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data)) as GatewayMessage;
  if (ArrayBuffer.isView(data)) return JSON.parse(new TextDecoder().decode(data)) as GatewayMessage;
  return JSON.parse(String(data)) as GatewayMessage;
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
    const timeoutMs = Number(process.env.OPENCLAW_COMMAND_TIMEOUT_MS ?? 8000);
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    const authMode = process.env.OPENCLAW_AUTH_MODE ?? "query";

    return new Promise((resolve, reject) => {
      let settled = false;
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

      ws.addEventListener("open", () => {
        if (token && authMode === "message") {
          ws.send(JSON.stringify({ type: "auth", payload: { token }, timestamp: new Date().toISOString() }));
        }
        ws.send(
          JSON.stringify({
            type: command.type,
            id: requestId,
            payload: command.payload,
            timestamp: new Date().toISOString()
          })
        );
      });

      ws.addEventListener("message", (event) => {
        try {
          const message = parseMessage(event.data);
          if (message.id && message.id !== requestId) return;
          settle(() =>
            resolve({
              accepted: true,
              message: `Comando ${command.type} aceito pelo OpenClaw.`,
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
        if (!settled) settle(() => reject(new Error(`Conexao OpenClaw fechada antes da resposta de ${command.type}.`)));
      });
    });
  }
}

export const realOpenClawAdapter = new RealOpenClawAdapter();

export function getOpenClawAdapter() {
  if (process.env.NODE_ENV === "production" && process.env.OPENCLAW_USE_MOCK !== "true") return realOpenClawAdapter;
  return isRealOpenClawEnabled() ? realOpenClawAdapter : mockOpenClawAdapter;
}
