import { NextRequest, NextResponse } from "next/server";
import { mockN8nAdapter } from "@/lib/adapters/mock";
import { createAuditLog } from "@/lib/server/audit";
import { webhookEventSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = webhookEventSchema.parse(await request.json());
  const result = await mockN8nAdapter.receiveAffiliateResult(body.jobId ?? "unknown-job", body.payload);

  await createAuditLog({
    jobId: body.jobId,
    eventType: "webhook_received",
    severity: "info",
    message: "Webhook N8N affiliate-result recebido.",
    inputPayload: body,
    outputPayload: result
  });

  return NextResponse.json(result);
}
