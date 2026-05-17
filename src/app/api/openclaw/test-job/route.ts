import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

const testJobSchema = z.object({
  title: z.string().min(3).default("Teste de integração OpenClaw TechSouls"),
  topic: z.string().min(2).default("Diagnóstico do pipeline editorial"),
  category: z.string().min(2).default("OpenClaw"),
  sourceName: z.string().min(2).default("TechSouls Command Center"),
  sourceUrl: z.string().url().default("https://techsouls.com.br/"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal")
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}));
    const body = testJobSchema.parse(raw);
    const count = await prisma.articleJob.count();
    const jobId = `ts-openclaw-test-${new Date().toISOString().slice(0, 10)}-${String(count + 1).padStart(4, "0")}`;

    const job = await prisma.articleJob.create({
      data: {
        jobId,
        externalId: jobId,
        dataSource: "manual",
        title: body.title,
        topic: body.topic,
        category: body.category,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
        currentStage: "Entrada",
        status: "new",
        priority: body.priority
      }
    });

    const command = await dispatchOpenClawCommand({
      type: "job_create",
      jobId,
      payload: {
        ...body,
        jobId,
        dispatchTo: "orchestrator",
        source: "techsouls-command-center",
        diagnostic: true
      }
    });

    await createAuditLog({
      jobId,
      eventType: "job_created",
      severity: command.accepted ? "info" : "warning",
      stage: "OpenClaw",
      decision: command.accepted ? "sent" : "not_sent",
      message: `Job teste ${jobId} criado e enviado ao Orchestrator OpenClaw.`,
      inputPayload: body,
      outputPayload: command
    });

    return NextResponse.json({ job, command }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "api/openclaw/test-job");
  }
}
