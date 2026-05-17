import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

async function resolveAgent(id: string) {
  return prisma.agent.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      logs: {
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          job: { select: { jobId: true, title: true, status: true } }
        }
      },
      payloadSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 20
      },
      assignedJobs: {
        orderBy: { updatedAt: "desc" },
        take: 20
      }
    }
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const agent = await resolveAgent(id);

    if (!agent) {
      return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
    }

    const currentTask = agent.currentTaskId
      ? await prisma.articleJob.findUnique({ where: { jobId: agent.currentTaskId } })
      : null;

    return NextResponse.json({ ...agent, currentTask });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const agent = mockStore.getAgent(id);
      return agent
        ? NextResponse.json(agent, { headers: { "x-techsouls-data-source": "mock" } })
        : NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
    }
    throw error;
  }
}
