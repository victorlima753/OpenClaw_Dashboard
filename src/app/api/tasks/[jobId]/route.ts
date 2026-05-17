import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobRelations } from "@/lib/server/tasks";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  try {
    const job = await prisma.articleJob.findUnique({
      where: { jobId },
      include: jobRelations()
    });

    if (!job) {
      return NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.getTask(jobId);
      return job
        ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } })
        : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
