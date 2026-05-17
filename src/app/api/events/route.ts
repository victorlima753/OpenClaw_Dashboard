import { mockRealtimeAdapter } from "@/lib/adapters/mock";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const event = mockRealtimeAdapter.nextEvent();
        controller.enqueue(encoder.encode(`event: ${event.type}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send();
      const interval = setInterval(send, 4000);

      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 60_000);
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
