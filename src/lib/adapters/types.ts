import type { ArticleJobDto, RealtimeEvent } from "@/lib/types";

export type AgentEventPayload = {
  agentSlug: string;
  jobId?: string;
  event: string;
  payload?: unknown;
};

export interface OpenClawAdapter {
  receiveAgentEvent(event: AgentEventPayload): Promise<{ accepted: boolean; message: string }>;
  receiveTaskUpdate(jobId: string, payload: unknown): Promise<{ accepted: boolean; message: string }>;
}

export interface N8nAdapter {
  receiveAffiliateResult(jobId: string, payload: unknown): Promise<{ accepted: boolean; message: string }>;
}

export interface WordpressAdapter {
  receivePublishResult(jobId: string, payload: unknown): Promise<{ accepted: boolean; message: string }>;
}

export interface QueueAdapter {
  retry(job: ArticleJobDto): Promise<{ queued: boolean; queueName: string }>;
  cancel(job: ArticleJobDto): Promise<{ cancelled: boolean }>;
}

export interface RealtimeAdapter {
  nextEvent(): RealtimeEvent;
}
