import { handleOpenClawGatewayMessage } from "../src/lib/server/openclaw-events";
import { prisma } from "../src/lib/prisma";

function gatewayUrl() {
  const url = process.env.OPENCLAW_GATEWAY_WS_URL;
  if (!url) throw new Error("OPENCLAW_GATEWAY_WS_URL nao configurado.");
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  const authMode = process.env.OPENCLAW_AUTH_MODE ?? "query";
  if (!token || authMode !== "query") return url;

  const parsed = new URL(url);
  parsed.searchParams.set("token", token);
  return parsed.toString();
}

function parseMessage(data: unknown) {
  if (typeof data === "string") return JSON.parse(data) as unknown;
  if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data)) as unknown;
  if (ArrayBuffer.isView(data)) return JSON.parse(new TextDecoder().decode(data)) as unknown;
  return JSON.parse(String(data)) as unknown;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  if (typeof WebSocket === "undefined") {
    throw new Error("Node.js 22+ e necessario para o worker WebSocket.");
  }

  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  const authMode = process.env.OPENCLAW_AUTH_MODE ?? "query";
  const reconnectMs = Number(process.env.OPENCLAW_WORKER_RECONNECT_MS ?? 5000);

  for (;;) {
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(gatewayUrl());
      let heartbeat: NodeJS.Timeout | undefined;

      ws.addEventListener("open", () => {
        console.log("[openclaw-worker] conectado ao Gateway.");
        if (token && authMode === "message") {
          ws.send(JSON.stringify({ type: "auth", payload: { token }, timestamp: new Date().toISOString() }));
        }
        ws.send(JSON.stringify({ type: "status", payload: {}, timestamp: new Date().toISOString() }));
        heartbeat = setInterval(() => {
          ws.send(JSON.stringify({ type: "status", payload: {}, timestamp: new Date().toISOString() }));
        }, 30_000);
      });

      ws.addEventListener("message", (event) => {
        handleOpenClawGatewayMessage(parseMessage(event.data)).catch((error) => {
          console.error("[openclaw-worker] falha ao persistir evento:", error);
        });
      });

      ws.addEventListener("error", () => {
        console.error("[openclaw-worker] erro na conexao WebSocket.");
      });

      ws.addEventListener("close", () => {
        if (heartbeat) clearInterval(heartbeat);
        console.warn(`[openclaw-worker] conexao fechada; reconectando em ${reconnectMs}ms.`);
        resolve();
      });
    });

    await sleep(reconnectMs);
  }
}

connect()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
