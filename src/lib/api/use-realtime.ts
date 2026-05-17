"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeEvent } from "@/lib/types";

export function useRealtime() {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource("/api/events");
    const eventTypes: RealtimeEvent["type"][] = [
      "agent_status",
      "task_update",
      "audit_log",
      "task_completed",
      "critical_error"
    ];

    const onMessage = (message: MessageEvent) => {
      const event = JSON.parse(message.data) as RealtimeEvent;
      setEvents((current) => [event, ...current].slice(0, 8));
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["openclaw", "overview"] });
      if (event.type.includes("task")) queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (event.type === "agent_status") queryClient.invalidateQueries({ queryKey: ["agents"] });
      if (event.type === "audit_log" || event.type === "critical_error") {
        queryClient.invalidateQueries({ queryKey: ["audit"] });
      }
    };

    for (const type of eventTypes) {
      source.addEventListener(type, onMessage);
    }

    return () => {
      for (const type of eventTypes) {
        source.removeEventListener(type, onMessage);
      }
      source.close();
    };
  }, [queryClient]);

  return events;
}
