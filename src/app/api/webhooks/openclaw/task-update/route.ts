import { NextRequest, NextResponse } from "next/server";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { applyOpenClawTaskUpdate } from "@/lib/server/openclaw-events";
import { unauthorizedWebhookResponse, verifyWebhookSecret } from "@/lib/server/webhook-auth";
import { techSoulsJobUpdateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) return unauthorizedWebhookResponse();
  const parsed = techSoulsJobUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload TechSoulsJobUpdate v1 invalido.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const adapterResult = await getOpenClawAdapter().receiveTaskUpdate(body.jobId ?? "unknown-job", body.payload);
  const applyResult = await applyOpenClawTaskUpdate({
    jobId: body.jobId,
    event: body.event,
    status: body.status,
    agentSlug: body.agentSlug,
    agentExternalId: body.agentExternalId,
    completedStage: body.completedStage,
    idempotencyKey: body.idempotencyKey,
    severity: body.severity,
    timestamp: body.timestamp,
    payload: body.payload
  });

  return NextResponse.json({ ...adapterResult, applyResult });
}
