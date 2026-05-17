import type {
  AgentEventPayload,
  N8nAdapter,
  OpenClawAdapter,
  QueueAdapter,
  RealtimeAdapter,
  WordpressAdapter
} from "./types";
import type { ArticleJobDto, RealtimeEvent } from "@/lib/types";

export const mockOpenClawAdapter: OpenClawAdapter = {
  async receiveAgentEvent(event: AgentEventPayload) {
    return {
      accepted: true,
      message: `Evento mockado recebido de ${event.agentSlug}.`
    };
  },
  async receiveTaskUpdate(jobId: string) {
    return {
      accepted: true,
      message: `Atualizacao mockada aceita para ${jobId}.`
    };
  }
};

export const mockN8nAdapter: N8nAdapter = {
  async receiveAffiliateResult(jobId: string) {
    return {
      accepted: true,
      message: `Resultado de afiliados mockado aceito para ${jobId}.`
    };
  }
};

export const mockWordpressAdapter: WordpressAdapter = {
  async receivePublishResult(jobId: string) {
    return {
      accepted: true,
      message: `Resultado WordPress mockado aceito para ${jobId}.`
    };
  }
};

export const mockQueueAdapter: QueueAdapter = {
  async retry(job: ArticleJobDto) {
    return { queued: true, queueName: `techsouls:${job.currentStage}` };
  },
  async cancel() {
    return { cancelled: true };
  }
};

const eventMessages = [
  "Heartbeat recebido do Orchestrator",
  "Novo log de validação registrado",
  "Kanban atualizado por ação manual",
  "Tarefa publicada com sucesso",
  "Alerta crítico simulado em compliance"
];

export const mockRealtimeAdapter: RealtimeAdapter = {
  nextEvent(): RealtimeEvent {
    const index = Math.floor(Date.now() / 4000) % eventMessages.length;
    const types: RealtimeEvent["type"][] = [
      "agent_status",
      "audit_log",
      "task_update",
      "task_completed",
      "critical_error"
    ];

    return {
      type: types[index],
      message: eventMessages[index],
      payload: {
        mock: true,
        sequence: index,
        jobId: `ts-2026-05-17-${String(index + 1).padStart(4, "0")}`
      },
      createdAt: new Date().toISOString()
    };
  }
};
