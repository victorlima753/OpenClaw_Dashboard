"use client";

import Link from "next/link";
import { ExternalLink, Pause, Play, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentStatusBadge } from "@/components/common/status-badge";
import { Progress } from "@/components/ui/progress";
import { useAgentAction, useAgents } from "@/lib/api/hooks";
import { formatDuration, formatPercent, formatRelativeTime } from "@/lib/utils";
import { PageError, PageLoading } from "./page-state";
import type { AgentDto } from "@/lib/types";

function AgentCard({ agent }: { agent: AgentDto }) {
  const action = useAgentAction(agent.id);
  const successRate = (agent.successCount / Math.max(1, agent.successCount + agent.failureCount)) * 100;

  return (
    <Card className="bg-card/92">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{agent.name}</CardTitle>
            <p className="mt-1 truncate text-xs text-muted-foreground">{agent.skillName}</p>
          </div>
          <AgentStatusBadge status={agent.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{agent.description}</p>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Tarefa atual</p>
          <p className="mt-1 truncate text-sm font-medium">{agent.currentTask?.title ?? agent.currentTaskId ?? "Disponível"}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Execução média</p>
            <p className="font-medium">{formatDuration(agent.averageProcessingTimeMs)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Última atividade</p>
            <p className="font-medium">{formatRelativeTime(agent.lastActivityAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Processadas</p>
            <p className="font-medium">{agent.totalTasksProcessed}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Falhas recentes</p>
            <p className="font-medium">{agent.failureCount}</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Taxa de sucesso</span>
            <span>{formatPercent(successRate)}</span>
          </div>
          <Progress value={successRate} />
        </div>
        <div className="flex flex-wrap gap-2">
          {agent.status === "paused" ? (
            <Button size="sm" variant="secondary" onClick={() => action.mutate("resume")}>
              <Play /> Retomar
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => action.mutate("pause")}>
              <Pause /> Pausar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => action.mutate("heartbeat")}>
            <TimerReset /> Heartbeat
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/agents/${agent.id}`}>
              <ExternalLink /> Detalhes
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentsPage() {
  const { data, isLoading, error } = useAgents();

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Painel de agentes</h1>
        <p className="text-sm text-muted-foreground">
          Status, carga atual, falhas e controles manuais dos agentes editoriais.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {data.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
