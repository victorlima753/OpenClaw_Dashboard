import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const agent = await prisma.agent.update({
      where: { id },
      data: { status: "online", lastHeartbeatAt: new Date(), lastActivityAt: new Date() }
    });

    await createAuditLog({
      agentId: agent.id,
      eventType: "agent_restarted",
      severity: "warning",
      message: `Restart mockado executado para ${agent.name}.`
    });

    return NextResponse.json(agent);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const agent = mockStore.setAgentStatus(id, "online", "agent_restarted", "Restart executado em modo mock.");
      return agent ? NextResponse.json(agent, { headers: { "x-techsouls-data-source": "mock" } }) : NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
    }
    throw error;
  }
}
