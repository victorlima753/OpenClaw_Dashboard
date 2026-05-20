import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { createAndNotifySystemAlert } from "@/lib/server/alerts";
import { apiErrorResponse } from "@/lib/server/api-error";
import { rateLimitResponse, rateLimitWebhook } from "@/lib/server/rate-limit";
import { unauthorizedWebhookResponse, verifyNamedWebhookSecret } from "@/lib/server/webhook-auth";
import { wordpressPublishResultSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = await rateLimitWebhook(request, "webhook:wordpress:publish-result");
  if (!limit.allowed) return rateLimitResponse(limit);
  if (!verifyNamedWebhookSecret(request, "WORDPRESS_WEBHOOK_SECRET", ["x-wordpress-webhook-secret"])) {
    return unauthorizedWebhookResponse();
  }

  try {
    const body = wordpressPublishResultSchema.parse(await request.json());
    const duplicate = await prisma.agentLog.findFirst({
      where: { jobId: body.jobId, stage: "WordPress publish-result", decision: body.idempotencyKey }
    });
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true, jobId: body.jobId });

    const wordpressPostId = body.payload.wordpressPostId ?? body.payload.wordpress_post_id ?? null;
    const wordpressPreviewUrl = body.payload.wordpressPreviewUrl ?? body.payload.wordpress_preview_url ?? body.payload.postUrl ?? null;
    const job = await prisma.articleJob.upsert({
      where: { jobId: body.jobId },
      create: {
        jobId: body.jobId,
        dataSource: "wordpress",
        title: `Publicacao WordPress ${body.jobId}`,
        topic: "WordPress",
        category: "Publicacao",
        sourceName: "WordPress",
        sourceUrl: wordpressPreviewUrl ?? "https://techsouls.com.br",
        currentStage: "publishing",
        status: body.status,
        wordpressPostId,
        wordpressPreviewUrl,
        errorMessage: body.status === "failed" ? body.payload.errorMessage ?? "WordPress retornou falha." : null
      },
      update: {
        dataSource: "openclaw",
        currentStage: "publishing",
        status: body.status,
        wordpressPostId,
        wordpressPreviewUrl,
        errorMessage: body.status === "failed" ? body.payload.errorMessage ?? "WordPress retornou falha." : null
      }
    });

    await createAuditLog({
      jobId: body.jobId,
      eventType: body.status === "published" ? "published" : body.status === "drafted" ? "drafted" : "failed",
      severity: body.status === "failed" ? "error" : "info",
      stage: "WordPress publish-result",
      decision: body.idempotencyKey,
      message: `Webhook WordPress publish-result marcou ${body.jobId} como ${body.status}.`,
      inputPayload: body,
      outputPayload: { jobId: job.jobId, status: job.status, wordpressPostId, wordpressPreviewUrl }
    });

    if (body.status === "failed") {
      await createAndNotifySystemAlert({
        title: "Falha de publicacao WordPress",
        message: body.payload.errorMessage ?? `WordPress retornou falha para ${body.jobId}.`,
        severity: "error",
        source: "wordpress",
        dedupeKey: `wordpress:${body.jobId}:${body.idempotencyKey}`,
        relatedJobId: body.jobId,
        metadata: body as Prisma.InputJsonValue
      });
    }

    return NextResponse.json({ ok: true, duplicate: false, jobId: body.jobId, status: job.status });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      await createAndNotifySystemAlert({
        title: "Payload WordPress invalido",
        message: error.message,
        severity: "warning",
        source: "wordpress",
        dedupeKey: `wordpress:invalid:${Date.now()}`
      });
      return NextResponse.json({ error: "Payload invalido.", message: error.message }, { status: 400 });
    }
    return apiErrorResponse(error, "api/webhooks/wordpress/publish-result");
  }
}
