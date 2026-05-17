import { NextRequest, NextResponse } from "next/server";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { applyOpenClawAgentEvent } from "@/lib/server/openclaw-events";
import { unauthorizedWebhookResponse, verifyWebhookSecret } from "@/lib/server/webhook-auth";
import { webhookEventSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) return unauthorizedWebhookResponse();
  const body = webhookEventSchema.parse(await request.json());
  const adapterResult = await getOpenClawAdapter().receiveAgentEvent({
    agentSlug: body.agentSlug ?? "unknown-agent",
    jobId: body.jobId,
    event: body.event,
    payload: body.payload
  });
  const applyResult = await applyOpenClawAgentEvent({
    agentSlug: body.agentSlug,
    jobId: body.jobId,
    event: body.event,
    status: body.status,
    payload: body.payload
  });

  return NextResponse.json({ ...adapterResult, applyResult });
}
