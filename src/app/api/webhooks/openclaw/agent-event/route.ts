import { NextRequest, NextResponse } from "next/server";
import { mockOpenClawAdapter } from "@/lib/adapters/mock";
import { createAuditLog } from "@/lib/server/audit";
import { webhookEventSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = webhookEventSchema.parse(await request.json());
  const result = await mockOpenClawAdapter.receiveAgentEvent({
    agentSlug: body.agentSlug ?? "unknown-agent",
    jobId: body.jobId,
    event: body.event,
    payload: body.payload
  });

  await createAuditLog({
    jobId: body.jobId,
    eventType: "webhook_received",
    severity: "info",
    message: `Webhook OpenClaw agent-event recebido: ${body.event}.`,
    inputPayload: body,
    outputPayload: result
  });

  return NextResponse.json(result);
}
