import { NextRequest, NextResponse } from "next/server";
import { constantEqual } from "@/lib/auth/session";

export function verifyWebhookSecret(request: NextRequest) {
  return verifyNamedWebhookSecret(request, "OPENCLAW_WEBHOOK_SECRET", ["x-openclaw-webhook-secret"]);
}

export function verifyNamedWebhookSecret(request: NextRequest, envName: string, extraHeaders: string[] = []) {
  const expected = process.env[envName];
  if (!expected) return process.env.NODE_ENV !== "production";

  const provided =
    request.headers.get("x-techsouls-webhook-secret") ??
    extraHeaders.map((header) => request.headers.get(header)).find(Boolean) ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return Boolean(provided && constantEqual(provided, expected));
}

export function unauthorizedWebhookResponse() {
  return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
}
