import { NextRequest, NextResponse } from "next/server";
import { constantEqual } from "@/lib/auth/session";

export function verifyWebhookSecret(request: NextRequest) {
  const expected = process.env.OPENCLAW_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";

  const provided =
    request.headers.get("x-techsouls-webhook-secret") ??
    request.headers.get("x-openclaw-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return Boolean(provided && constantEqual(provided, expected));
}

export function unauthorizedWebhookResponse() {
  return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
}
