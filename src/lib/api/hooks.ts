"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { AgentDto, AgentLogDto, ArticleJobDto, DashboardStats, HumanReviewDto, OpenClawOverview } from "@/lib/types";

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardStats>("/api/dashboard") });
}

export function useAgents() {
  return useQuery({ queryKey: ["agents"], queryFn: () => apiFetch<AgentDto[]>("/api/agents") });
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => apiFetch<AgentDto>(`/api/agents/${agentId}`),
    enabled: Boolean(agentId)
  });
}

export function useTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: () => apiFetch<ArticleJobDto[]>("/api/tasks") });
}

export function useTask(jobId: string) {
  return useQuery({
    queryKey: ["task", jobId],
    queryFn: () => apiFetch<ArticleJobDto>(`/api/tasks/${jobId}`),
    enabled: Boolean(jobId)
  });
}

export function useQueue() {
  return useQuery({ queryKey: ["queue"], queryFn: () => apiFetch<ArticleJobDto[]>("/api/queue") });
}

export function useReviewQueue() {
  return useQuery({ queryKey: ["review"], queryFn: () => apiFetch<HumanReviewDto[]>("/api/review") });
}

export function useAuditLogs() {
  return useQuery({ queryKey: ["audit"], queryFn: () => apiFetch<AgentLogDto[]>("/api/audit") });
}

export function useOpenClawOverview() {
  return useQuery({
    queryKey: ["openclaw", "overview"],
    queryFn: () => apiFetch<OpenClawOverview>("/api/openclaw/diagnostics")
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      topic: string;
      category: string;
      sourceName: string;
      sourceUrl: string;
      priority: string;
      hasAffiliate: boolean;
      requiresHumanReview: boolean;
    }) => apiFetch<ArticleJobDto>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      queryClient.invalidateQueries({ queryKey: ["openclaw", "overview"] });
    }
  });
}

export function useAgentAction(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: "pause" | "resume" | "heartbeat" | "restart" | "clear-errors") =>
      apiFetch(`/api/agents/${agentId}/${action}`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useTaskAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, action, body }: { jobId: string; action: string; body?: unknown }) =>
      apiFetch(`/api/tasks/${jobId}/${action}`, {
        method: action === "status" ? "PATCH" : "POST",
        body: JSON.stringify(body ?? {})
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["openclaw", "overview"] });
    }
  });
}

export function useReviewAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, action, comment }: { jobId: string; action: string; comment?: string }) =>
      apiFetch(`/api/review/${jobId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ comment })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    }
  });
}
