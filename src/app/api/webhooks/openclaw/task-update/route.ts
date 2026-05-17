import { NextRequest, NextResponse } from "next/server";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { applyOpenClawTaskUpdate } from "@/lib/server/openclaw-events";
import { unauthorizedWebhookResponse, verifyWebhookSecret } from "@/lib/server/webhook-auth";
import { webhookEventSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) return unauthorizedWebhookResponse();
  const body = webhookEventSchema.parse(await request.json());
  const adapterResult = await getOpenClawAdapter().receiveTaskUpdate(body.jobId ?? "unknown-job", body.payload);
  const applyResult = await applyOpenClawTaskUpdate({
    jobId: body.jobId,
    event: body.event,
    status: body.status,
    agentSlug: body.agentSlug,
    payload: body.payload
  });

  return NextResponse.json({ ...adapterResult, applyResult });
}
