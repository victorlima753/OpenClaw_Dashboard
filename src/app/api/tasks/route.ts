import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTaskSchema } from "@/lib/validation/schemas";
import { createAuditLog } from "@/lib/server/audit";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const query = searchParams.get("q");

  try {
    const jobs = await prisma.articleJob.findMany({
      where: {
        status: status ? (status as never) : undefined,
        priority: priority ? (priority as never) : undefined,
        OR: query
          ? [
              { title: { contains: query, mode: "insensitive" } },
              { topic: { contains: query, mode: "insensitive" } },
              { jobId: { contains: query, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        assignedAgent: true,
        humanReviews: { orderBy: { createdAt: "desc" }, take: 1 },
        sources: { take: 2 }
      }
    });

    return NextResponse.json(jobs);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.listTasks({ status, priority, q: query }), {
        headers: { "x-techsouls-data-source": "mock" }
      });
    }
    return apiErrorResponse(error, "api/tasks:list");
  }
}

export async function POST(request: NextRequest) {
  const body = createTaskSchema.parse(await request.json());
  try {
    const count = await prisma.articleJob.count();
    const jobId = `ts-${new Date().toISOString().slice(0, 10)}-${String(count + 1).padStart(4, "0")}`;

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
        priority: body.priority,
        hasAffiliate: body.hasAffiliate,
        requiresHumanReview: body.requiresHumanReview
      }
    });

    await createAuditLog({
      jobId,
      eventType: "job_created",
      severity: "info",
      stage: "Entrada",
      message: `Job ${jobId} criado manualmente.`,
      inputPayload: body
    });

    await dispatchOpenClawCommand({
      type: "job_create",
      jobId,
      payload: { ...body, jobId, dispatchTo: "orchestrator", source: "techsouls-command-center" }
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.createTask(body), {
        status: 201,
        headers: { "x-techsouls-data-source": "mock" }
      });
    }
    return apiErrorResponse(error, "api/tasks:create");
  }
}
