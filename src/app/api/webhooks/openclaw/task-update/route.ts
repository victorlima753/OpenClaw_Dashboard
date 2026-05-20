import { NextRequest, NextResponse } from "next/server";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { prisma } from "@/lib/prisma";
import { createAndNotifySystemAlert } from "@/lib/server/alerts";
import { createAuditLog } from "@/lib/server/audit";
import { applyOpenClawTaskUpdate } from "@/lib/server/openclaw-events";
import { rateLimitResponse, rateLimitWebhook } from "@/lib/server/rate-limit";
import { unauthorizedWebhookResponse, verifyWebhookSecret } from "@/lib/server/webhook-auth";
import { techSoulsJobUpdateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimit = await rateLimitWebhook(request, "openclaw-task-update");
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  if (!verifyWebhookSecret(request)) return unauthorizedWebhookResponse();
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    await Promise.allSettled([
      createAuditLog({
        eventType: "webhook_received",
        severity: "warning",
        stage: "OpenClaw webhook",
        decision: "invalid_json",
        message: "JSON invalido recebido pelo webhook OpenClaw."
      }),
      prisma.systemSetting.upsert({
        where: { key: "openclaw_latest_webhook_error" },
        create: {
          key: "openclaw_latest_webhook_error",
          value: { kind: "invalid_json", receivedAt: new Date().toISOString() }
        },
        update: {
          value: { kind: "invalid_json", receivedAt: new Date().toISOString() }
        }
      }),
      createAndNotifySystemAlert({
        title: "Webhook OpenClaw com JSON invalido",
        message: "O endpoint recebeu uma requisicao sem JSON valido.",
        severity: "warning",
        source: "openclaw-webhook",
        dedupeKey: "openclaw-webhook:invalid-json"
      })
    ]);
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }
  const parsed = techSoulsJobUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
    await Promise.allSettled([
      createAuditLog({
        eventType: "webhook_received",
        severity: "warning",
        stage: "OpenClaw webhook",
        decision: "invalid_payload",
        message: "Payload TechSoulsJobUpdate v1 invalido recebido pelo webhook OpenClaw.",
        inputPayload: { issues }
      }),
      prisma.systemSetting.upsert({
        where: { key: "openclaw_latest_webhook_error" },
        create: {
          key: "openclaw_latest_webhook_error",
          value: {
            kind: "invalid_payload",
            issues,
            receivedAt: new Date().toISOString()
          }
        },
        update: {
          value: {
            kind: "invalid_payload",
            issues,
            receivedAt: new Date().toISOString()
          }
        }
      }),
      createAndNotifySystemAlert({
        title: "Webhook OpenClaw com payload invalido",
        message: "O endpoint recebeu payload fora do contrato TechSoulsJobUpdate v1.",
        severity: "warning",
        source: "openclaw-webhook",
        dedupeKey: "openclaw-webhook:invalid-payload",
        metadata: { issues }
      })
    ]);
    return NextResponse.json(
      {
        error: "Payload TechSoulsJobUpdate v1 invalido.",
        issues
      },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const adapterResult = await getOpenClawAdapter().receiveTaskUpdate(body.jobId ?? "unknown-job", body.payload);
  const applyResult = await applyOpenClawTaskUpdate({
    jobId: body.jobId,
    event: body.event,
    status: body.status,
    agentSlug: body.agentSlug,
    agentExternalId: body.agentExternalId,
    completedStage: body.completedStage,
    idempotencyKey: body.idempotencyKey,
    severity: body.severity,
    timestamp: body.timestamp,
    payload: body.payload
  });

  return NextResponse.json({ ...adapterResult, applyResult });
}
