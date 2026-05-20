import net from "node:net";
import { NextRequest, NextResponse } from "next/server";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
};

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function redisCommand(url: URL, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const socket = net.createConnection(
      {
        host: url.hostname,
        port: Number(url.port || 6379),
        timeout: 1500
      },
      () => {
        const password = decodeURIComponent(url.password || "");
        const username = decodeURIComponent(url.username || "");
        const commands = [];
        if (password && username) commands.push(["AUTH", username, password]);
        else if (password) commands.push(["AUTH", password]);
        commands.push(args);
        socket.write(commands.map(encodeRespArray).join(""));
      }
    );
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
    });
    socket.on("timeout", () => {
      socket.destroy(new Error("Redis rate limit timeout."));
    });
    socket.on("error", reject);
    socket.on("close", () => resolve(buffer));
  });
}

function encodeRespArray(args: string[]) {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`;
}

function parseIntegerResponse(response: string) {
  const matches = [...response.matchAll(/:(-?\d+)\r\n/g)];
  const last = matches.at(-1)?.[1];
  return last ? Number(last) : undefined;
}

async function redisBucket(key: string, limit: number, windowSeconds: number) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  try {
    const url = new URL(redisUrl);
    if (!["redis:", "rediss:"].includes(url.protocol)) return null;
    const count = parseIntegerResponse(await redisCommand(url, ["INCR", key]));
    if (!count) return null;
    if (count === 1) await redisCommand(url, ["EXPIRE", key, String(windowSeconds)]);
    return count;
  } catch {
    return null;
  }
}

function memoryBucket(key: string, windowMs: number) {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { count: 1, resetAt };
  }
  current.count += 1;
  return current;
}

export async function rateLimitWebhook(request: NextRequest, route: string): Promise<RateLimitResult> {
  const limit = numberEnv("WEBHOOK_RATE_LIMIT_MAX", 120);
  const windowSeconds = numberEnv("WEBHOOK_RATE_LIMIT_WINDOW_SECONDS", 60);
  const windowMs = windowSeconds * 1000;
  const bucketId = `webhook:${route}:${clientIp(request)}`;
  const redisCount = await redisBucket(bucketId, limit, windowSeconds);
  const now = Date.now();
  const count = redisCount ?? memoryBucket(bucketId, windowMs).count;
  const resetAt = new Date(now + windowMs).toISOString();

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Muitas requisicoes para o webhook.", retryAfter: result.resetAt },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000))),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": result.resetAt
      }
    }
  );
}
