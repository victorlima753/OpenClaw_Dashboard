import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LogSeverity } from "@/lib/types";

type AlertInput = {
  title: string;
  message: string;
  severity?: LogSeverity;
  source: string;
  dedupeKey?: string | null;
  relatedJobId?: string | null;
  relatedAgentId?: string | null;
  metadata?: unknown;
};

export async function createSystemAlert(input: AlertInput) {
  const data = {
    title: input.title,
    message: input.message,
    severity: input.severity ?? "warning",
    source: input.source,
    relatedJobId: input.relatedJobId ?? null,
    relatedAgentId: input.relatedAgentId ?? null,
    metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
  };

  if (!input.dedupeKey) return prisma.systemAlert.create({ data });

  return prisma.systemAlert.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: { ...data, dedupeKey: input.dedupeKey },
    update: { ...data, status: "active", resolvedAt: null }
  });
}

export async function sendAlertWebhook(alert: Awaited<ReturnType<typeof createSystemAlert>>) {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return { sent: false };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "techsouls.alert",
        alert: {
          id: alert.id,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          source: alert.source,
          createdAt: alert.createdAt
        }
      })
    });
    return { sent: response.ok, status: response.status };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function createAndNotifySystemAlert(input: AlertInput) {
  const alert = await createSystemAlert(input);
  const webhook = await sendAlertWebhook(alert);
  return { alert, webhook };
}
