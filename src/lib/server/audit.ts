import { prisma } from "@/lib/prisma";
import type { LogSeverity } from "@/lib/types";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  jobId?: string | null;
  agentId?: string | null;
  eventType: string;
  severity?: LogSeverity;
  stage?: string | null;
  decision?: string | null;
  score?: number | null;
  message: string;
  inputPayload?: unknown;
  outputPayload?: unknown;
  errorPayload?: unknown;
};

export async function createAuditLog(input: AuditInput) {
  return prisma.agentLog.create({
    data: {
      jobId: input.jobId ?? null,
      agentId: input.agentId ?? null,
      severity: input.severity ?? "info",
      stage: input.stage ?? null,
      decision: input.decision ?? null,
      score: input.score ?? null,
      message: input.message,
      eventType: input.eventType as never,
      inputPayload: (input.inputPayload ?? undefined) as Prisma.InputJsonValue | undefined,
      outputPayload: (input.outputPayload ?? undefined) as Prisma.InputJsonValue | undefined,
      errorPayload: (input.errorPayload ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
}
