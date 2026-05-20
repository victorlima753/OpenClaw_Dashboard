import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { createAndNotifySystemAlert } from "@/lib/server/alerts";
import { apiErrorResponse } from "@/lib/server/api-error";
import { rateLimitResponse, rateLimitWebhook } from "@/lib/server/rate-limit";
import { unauthorizedWebhookResponse, verifyNamedWebhookSecret } from "@/lib/server/webhook-auth";
import { inoreaderItemSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = await rateLimitWebhook(request, "webhook:inoreader:item");
  if (!limit.allowed) return rateLimitResponse(limit);
  if (!verifyNamedWebhookSecret(request, "INOREADER_WEBHOOK_SECRET", ["x-inoreader-webhook-secret"])) {
    return unauthorizedWebhookResponse();
  }

  try {
    const body = inoreaderItemSchema.parse(await request.json());
    const duplicate = await prisma.agentLog.findFirst({
      where: { jobId: body.jobId, stage: "Inoreader item", decision: body.idempotencyKey }
    });
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true, jobId: body.jobId });

    const job = await prisma.articleJob.upsert({
      where: { jobId: body.jobId },
      create: {
        jobId: body.jobId,
        dataSource: "inoreader",
        title: body.payload.title,
        topic: body.payload.topic ?? body.payload.title,
        category: body.payload.category ?? "News",
        sourceName: body.payload.sourceName,
        sourceUrl: body.payload.sourceUrl,
        currentStage: "new",
        status: "new",
        relevanceScore: body.payload.relevanceHint ?? null
      },
      update: {
        dataSource: "inoreader",
        title: body.payload.title,
        topic: body.payload.topic ?? body.payload.title,
        category: body.payload.category ?? "News",
        sourceName: body.payload.sourceName,
        sourceUrl: body.payload.sourceUrl,
        relevanceScore: body.payload.relevanceHint ?? undefined
      }
    });

    await prisma.source.upsert({
      where: { id: `${body.jobId}:inoreader:primary` },
      create: {
        id: `${body.jobId}:inoreader:primary`,
        jobId: body.jobId,
        name: body.payload.sourceName,
        url: body.payload.sourceUrl,
        role: "primary",
        reliabilityScore: body.payload.relevanceHint ?? 75,
        publishedAt: body.payload.publishedAt ? new Date(body.payload.publishedAt) : null
      },
      update: {
        name: body.payload.sourceName,
        url: body.payload.sourceUrl,
        reliabilityScore: body.payload.relevanceHint ?? 75,
        publishedAt: body.payload.publishedAt ? new Date(body.payload.publishedAt) : null
      }
    });

    await createAuditLog({
      jobId: body.jobId,
      eventType: "job_created",
      severity: "info",
      stage: "Inoreader item",
      decision: body.idempotencyKey,
      score: body.payload.relevanceHint ?? null,
      message: `Item Inoreader recebido para ${body.jobId}.`,
      inputPayload: body,
      outputPayload: { jobId: job.jobId, status: job.status }
    });

    return NextResponse.json({ ok: true, duplicate: false, jobId: body.jobId, status: job.status });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      await createAndNotifySystemAlert({
        title: "Payload Inoreader invalido",
        message: error.message,
        severity: "warning",
        source: "inoreader",
        dedupeKey: `inoreader:invalid:${Date.now()}`
      });
      return NextResponse.json({ error: "Payload invalido.", message: error.message }, { status: 400 });
    }
    return apiErrorResponse(error, "api/webhooks/inoreader/item");
  }
}
