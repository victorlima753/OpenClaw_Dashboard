import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/server/audit";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { dispatchOpenClawCommand } from "@/lib/server/openclaw-events";
import { reconcileAgentWorkState } from "@/lib/server/agent-state";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const agent = await prisma.agent.update({
      where: { id },
      data: { lastActivityAt: new Date(), lastHeartbeatAt: new Date() }
    });
    const reconciledAgent = await reconcileAgentWorkState(agent.id, { wakeOffline: true, clearPaused: true });

    await createAuditLog({
      agentId: agent.id,
      eventType: "agent_resumed",
      severity: "info",
      message: `${agent.name} retomado manualmente.`
    });

    await dispatchOpenClawCommand({
      type: "agent_resume",
      agentId: agent.id,
      payload: { agentId: agent.id, agentSlug: agent.slug, source: "techsouls-command-center" }
    });

    return NextResponse.json(reconciledAgent ?? agent);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const agent = mockStore.setAgentStatus(id, "online", "agent_resumed", "Agente retomado em modo mock.");
      return agent ? NextResponse.json(agent, { headers: { "x-techsouls-data-source": "mock" } }) : NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
    }
    throw error;
  }
}
