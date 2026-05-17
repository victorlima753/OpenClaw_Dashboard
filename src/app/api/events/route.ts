import { mockRealtimeAdapter } from "@/lib/adapters/mock";
import { isRealOpenClawEnabled } from "@/lib/adapters/openclaw";
import { prisma } from "@/lib/prisma";
import { isMockFallbackEnabled } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

function realtimeTypeFromLog(log: { eventType: string; severity: string; jobId: string | null; agentId: string | null }) {
  if (log.severity === "critical" || log.severity === "error") return "critical_error";
  if (["published", "drafted"].includes(log.eventType)) return "task_completed";
  if (log.jobId) return "task_update";
  if (log.agentId || log.eventType.startsWith("agent_")) return "agent_status";
  return "audit_log";
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const useMockStream = isMockFallbackEnabled() && !isRealOpenClawEnabled() && process.env.NODE_ENV !== "production";

  const stream = new ReadableStream({
    start(controller) {
      if (useMockStream) {
        const send = () => {
          const event = mockRealtimeAdapter.nextEvent();
          controller.enqueue(encoder.encode(`event: ${event.type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        send();
        const interval = setInterval(send, 4000);
        request.signal.addEventListener("abort", () => clearInterval(interval));
        setTimeout(() => {
          clearInterval(interval);
          controller.close();
        }, 60_000);
        return;
      }

      let lastSeen = new Date(Date.now() - 5 * 60_000);
      const send = async () => {
        const logs = await prisma.agentLog.findMany({
          where: { createdAt: { gt: lastSeen } },
          orderBy: { createdAt: "asc" },
          take: 20,
          include: {
            agent: { select: { id: true, name: true, slug: true } },
            job: { select: { jobId: true, title: true, status: true } }
          }
        });

        if (logs.length === 0) {
          controller.enqueue(encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`));
        }

        for (const log of logs) {
          lastSeen = log.createdAt;
          const type = realtimeTypeFromLog(log);
          const event = {
            type,
            message: log.message,
            payload: log,
            createdAt: log.createdAt.toISOString()
          };
          controller.enqueue(encoder.encode(`event: ${type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      };

      send().catch(() => {
        if (useMockStream) {
          const event = mockRealtimeAdapter.nextEvent();
          controller.enqueue(encoder.encode(`event: ${event.type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      });
      const interval = setInterval(() => {
        send().catch((error) => {
          const event = {
            type: "critical_error",
            message: error instanceof Error ? error.message : "Falha no stream realtime.",
            payload: null,
            createdAt: new Date().toISOString()
          };
          controller.enqueue(encoder.encode("event: critical_error\n"));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        });
      }, 4000);

      request.signal.addEventListener("abort", () => clearInterval(interval));
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
