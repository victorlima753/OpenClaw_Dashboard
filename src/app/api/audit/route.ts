import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { auditCreateSchema } from "@/lib/validation/schemas";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const agentId = searchParams.get("agent");
  const severity = searchParams.get("severity");
  const eventType = searchParams.get("eventType");

  try {
    const logs = await prisma.agentLog.findMany({
      where: {
        jobId: jobId || undefined,
        agentId: agentId || undefined,
        severity: severity ? (severity as never) : undefined,
        eventType: eventType ? (eventType as never) : undefined
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        agent: { select: { id: true, name: true, slug: true } },
        job: { select: { jobId: true, title: true, status: true } }
      }
    });

    return NextResponse.json(logs);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.auditLogs({ jobId, agentId, severity, eventType }), {
        headers: { "x-techsouls-data-source": "mock" }
      });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = auditCreateSchema.parse(await request.json());
  try {
    const log = await createAuditLog(body);
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.createAudit(body), {
        status: 201,
        headers: { "x-techsouls-data-source": "mock" }
      });
    }
    throw error;
  }
}
