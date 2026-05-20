import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { createAndNotifySystemAlert } from "@/lib/server/alerts";
import { rateLimitResponse, rateLimitWebhook } from "@/lib/server/rate-limit";
import { unauthorizedWebhookResponse, verifyNamedWebhookSecret } from "@/lib/server/webhook-auth";
import { n8nAffiliateResultSchema } from "@/lib/validation/schemas";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = await rateLimitWebhook(request, "webhook:n8n:affiliate-result");
  if (!limit.allowed) return rateLimitResponse(limit);
  if (!verifyNamedWebhookSecret(request, "N8N_WEBHOOK_SECRET", ["x-n8n-webhook-secret"])) return unauthorizedWebhookResponse();

  try {
    const body = n8nAffiliateResultSchema.parse(await request.json());
    const duplicate = await prisma.agentLog.findFirst({
      where: { jobId: body.jobId, stage: "N8N affiliate-result", decision: body.idempotencyKey }
    });
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true, jobId: body.jobId });

    const hasAffiliate = body.payload.hasAffiliate ?? body.status === "accepted";
    const monetizationScore = body.payload.monetizationScore ?? null;
    const job = await prisma.articleJob.upsert({
      where: { jobId: body.jobId },
      create: {
        jobId: body.jobId,
        dataSource: "n8n",
        title: `Resultado afiliado ${body.jobId}`,
        topic: "Afiliados",
        category: "Monetizacao",
        sourceName: "N8N",
        sourceUrl: "https://n8n.io",
        currentStage: "affiliate_routing",
        status: body.status === "failed" ? "failed" : "affiliate_routing",
        hasAffiliate,
        monetizationScore,
        errorMessage: body.status === "failed" ? body.payload.reason ?? "N8N retornou falha no afiliado." : null
      },
      update: {
        dataSource: "openclaw",
        currentStage: "affiliate_routing",
        hasAffiliate,
        monetizationScore,
        ...(body.status === "failed" ? { status: "failed" as const, errorMessage: body.payload.reason ?? "N8N retornou falha no afiliado." } : {})
      }
    });

    await createAuditLog({
      jobId: body.jobId,
      eventType: "affiliate_decided",
      severity: body.status === "failed" ? "error" : "info",
      stage: "N8N affiliate-result",
      decision: body.idempotencyKey,
      score: monetizationScore,
      message: `Webhook N8N affiliate-result recebido para ${body.jobId}.`,
      inputPayload: body,
      outputPayload: { jobId: job.jobId, hasAffiliate, monetizationScore }
    });

    if (body.status === "failed") {
      await createAndNotifySystemAlert({
        title: "Falha no roteamento de afiliado",
        message: body.payload.reason ?? `N8N retornou falha para ${body.jobId}.`,
        severity: "error",
        source: "n8n",
        dedupeKey: `n8n:${body.jobId}:${body.idempotencyKey}`,
        relatedJobId: body.jobId,
        metadata: body as Prisma.InputJsonValue
      });
    }

    return NextResponse.json({ ok: true, duplicate: false, jobId: body.jobId });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      await createAndNotifySystemAlert({
        title: "Payload N8N invalido",
        message: error.message,
        severity: "warning",
        source: "n8n",
        dedupeKey: `n8n:invalid:${Date.now()}`
      });
      return NextResponse.json({ error: "Payload invalido.", message: error.message }, { status: 400 });
    }
    return apiErrorResponse(error, "api/webhooks/n8n/affiliate-result");
  }
}
