import net from "node:net";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMockFallbackEnabled } from "@/lib/server/mock-store";
import { isRealOpenClawEnabled } from "@/lib/adapters/openclaw";
import { isDatabaseSetupError } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

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
  let database = {
    ok: false,
    message: "Nao verificado.",
    setupReady: false,
    agentCount: null as number | null,
    hint: null as string | null
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    const agentCount = await prisma.agent.count();
    database = {
      ok: true,
      message: "Postgres acessivel e schema Prisma aplicado.",
      setupReady: true,
      agentCount,
      hint: agentCount === 0 ? "Banco sem seed. Execute: npm run db:seed." : null
    };
  } catch (error) {
    database = {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      setupReady: false,
      agentCount: null,
      hint: isDatabaseSetupError(error)
        ? "Confira DATABASE_URL e execute: npm run prisma:deploy && npm run db:seed."
        : "Verifique os logs do container no EasyPanel."
    };
  }

  const redis = await checkRedis();

  return NextResponse.json({
    ok: database.ok,
    app: "TechSouls Command Center",
    environment: process.env.NODE_ENV ?? "development",
    publicUrl: process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? null,
    mockFallbackEnabled: isMockFallbackEnabled(),
    realOpenClawEnabled: isRealOpenClawEnabled(),
    database,
    redis,
    createdAt: new Date().toISOString()
  });
}
