import net from "node:net";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMockFallbackEnabled } from "@/lib/server/mock-store";
import { isRealOpenClawEnabled } from "@/lib/adapters/openclaw";
import { isDatabaseSetupError } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

type DatabaseHealth = {
  ok: boolean;
  message: string;
  setupReady: boolean;
  agentCount: number | null;
  hint: string | null;
  activeAlertCount: number | null;
  criticalAlertCount: number | null;
  workerConnected: boolean | null;
  workerLastSeenAt: string | null;
  workerMessage: string | null;
};

async function checkRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return { ok: false, message: "REDIS_URL nao configurado." };

  return new Promise<{ ok: boolean; message: string }>((resolve) => {
    const parsed = new URL(redisUrl);
    const socket = net.createConnection({
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      timeout: 1500
    });

    socket.once("connect", () => {
      socket.end();
      resolve({ ok: true, message: "Redis acessivel." });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, message: "Timeout ao conectar no Redis." });
    });
    socket.once("error", (error) => {
      resolve({ ok: false, message: error.message });
    });
  });
}

export async function GET() {
  let database: DatabaseHealth = {
    ok: false,
    message: "Nao verificado.",
    setupReady: false,
    agentCount: null as number | null,
    hint: null as string | null,
    activeAlertCount: null,
    criticalAlertCount: null,
    workerConnected: null,
    workerLastSeenAt: null,
    workerMessage: null
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [agentCount, activeAlertCount, criticalAlertCount, workerSetting] = await Promise.all([
      prisma.agent.count(),
      prisma.systemAlert.count({ where: { status: "active" } }),
      prisma.systemAlert.count({ where: { status: "active", severity: "critical" } }),
      prisma.systemSetting.findUnique({ where: { key: "openclaw_worker_status" } })
    ]);
    const workerValue =
      workerSetting?.value && typeof workerSetting.value === "object" && !Array.isArray(workerSetting.value)
        ? (workerSetting.value as { lastSeenAt?: unknown; message?: unknown })
        : {};
    const workerLastSeenAt = typeof workerValue.lastSeenAt === "string" ? workerValue.lastSeenAt : null;
    const workerConnected = workerLastSeenAt ? Date.now() - new Date(workerLastSeenAt).getTime() < 2 * 60_000 : false;
    database = {
      ok: true,
      message: "Postgres acessivel e schema Prisma aplicado.",
      setupReady: true,
      agentCount,
      hint:
        agentCount === 0
          ? "Banco sem seed. Execute: npm run db:seed."
          : criticalAlertCount > 0
            ? "Existem alertas criticos ativos."
            : null,
      activeAlertCount,
      criticalAlertCount,
      workerConnected,
      workerLastSeenAt,
      workerMessage: typeof workerValue.message === "string" ? workerValue.message : null
    };
  } catch (error) {
    database = {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      setupReady: false,
      agentCount: null,
      hint: isDatabaseSetupError(error)
        ? "Confira DATABASE_URL e execute: npm run prisma:deploy && npm run db:seed."
        : "Verifique os logs do container no EasyPanel.",
      activeAlertCount: null,
      criticalAlertCount: null,
      workerConnected: null,
      workerLastSeenAt: null,
      workerMessage: null
    };
  }

  const redis = await checkRedis();

  return NextResponse.json({
    ok: database.ok && (database.criticalAlertCount ?? 0) === 0,
    app: "TechSouls Command Center",
    environment: process.env.NODE_ENV ?? "development",
    publicUrl: process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? null,
    mockFallbackEnabled: isMockFallbackEnabled(),
    realOpenClawEnabled: isRealOpenClawEnabled(),
    database,
    redis,
    integrations: {
      openclawWebhookSecretConfigured: Boolean(process.env.OPENCLAW_WEBHOOK_SECRET),
      n8nWebhookSecretConfigured: Boolean(process.env.N8N_WEBHOOK_SECRET),
      wordpressWebhookSecretConfigured: Boolean(process.env.WORDPRESS_WEBHOOK_SECRET),
      inoreaderWebhookSecretConfigured: Boolean(process.env.INOREADER_WEBHOOK_SECRET),
      alertWebhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL)
    },
    createdAt: new Date().toISOString()
  });
}
