"use client";

import { useParams } from "next/navigation";
import { Ban, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentStatusBadge, JobStatusBadge, SeverityBadge } from "@/components/common/status-badge";
import { JsonViewer } from "@/components/common/json-viewer";
import { Progress } from "@/components/ui/progress";
import { useAgent, useAgentAction } from "@/lib/api/hooks";
import { formatDuration, formatPercent, formatRelativeTime } from "@/lib/utils";
import { PageError, PageLoading } from "./page-state";

export function AgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const { data: agent, isLoading, error } = useAgent(agentId);
  const action = useAgentAction(agentId);

  if (isLoading) return <PageLoading />;
  if (error || !agent) return <PageError error={error} />;

  const successRate = (agent.successCount / Math.max(1, agent.successCount + agent.failureCount)) * 100;
  const approvalRate = Math.max(52, Math.min(98, successRate - 3));
  const openClawEvents = agent.logs?.filter((log) => log.stage === "OpenClaw webhook" || log.stage === "OpenClaw session") ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-normal">{agent.name}</h1>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{agent.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {agent.status === "paused" ? (
            <Button onClick={() => action.mutate("resume")}>
              <Play /> Retomar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => action.mutate("pause")}>
              <Ban /> Pausar
            </Button>
          )}
          <Button variant="outline" onClick={() => action.mutate("restart")}>
            <RotateCcw /> Restart
          </Button>
          <Button variant="destructive" onClick={() => action.mutate("clear-errors")}>
            <Trash2 /> Clear errors
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Skill carregada</p>
            <p className="mt-1 font-medium">{agent.skillName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tarefa atual</p>
            <p className="mt-1 truncate font-medium">{agent.currentTask?.title ?? agent.currentTaskId ?? "Disponível"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tempo médio</p>
            <p className="mt-1 font-medium">{formatDuration(agent.averageProcessingTimeMs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Última atividade</p>
            <p className="mt-1 font-medium">{formatRelativeTime(agent.lastActivityAt)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="openclaw">OpenClaw</TabsTrigger>
          <TabsTrigger value="payloads">Payloads</TabsTrigger>
          <TabsTrigger value="errors">Erros</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Sucesso</span>
                  <span>{formatPercent(successRate)}</span>
                </div>
                <Progress value={successRate} />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Aprovação/rejeição</span>
                  <span>{formatPercent(approvalRate)}</span>
                </div>
                <Progress value={approvalRate} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{agent.totalTasksProcessed}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Sucesso</p>
                  <p className="text-lg font-semibold">{agent.successCount}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Falhas</p>
                  <p className="text-lg font-semibold">{agent.failureCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Permissões operacionais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>read:queue, read:payloads, write:audit</p>
              <p>execute:manual-action para administradores autenticados</p>
              <p>external-integrations: disabled na V1</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {agent.assignedJobs?.map((job) => (
            <Card key={job.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.jobId}</p>
                </div>
                <JobStatusBadge status={job.status} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="space-y-3">
          {agent.logs?.map((log) => (
            <Card key={log.id}>
              <CardContent className="flex gap-3 p-4">
                <SeverityBadge severity={log.severity} />
                <div>
                  <p className="text-sm">{log.message}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="openclaw" className="space-y-3">
          {openClawEvents.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Este agente ainda nao emitiu eventos reais OpenClaw para o dashboard.
              </CardContent>
            </Card>
          ) : (
            openClawEvents.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={log.severity} />
                      <span className="text-sm font-medium">{log.stage}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.job ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.job.jobId} - {log.job.title}
                    </p>
                  ) : null}
                  {log.outputPayload ? <JsonViewer value={log.outputPayload} /> : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="payloads" className="space-y-3">
          {agent.payloadSnapshots?.map((payload) => (
            <div key={payload.id} className="space-y-2">
              <p className="text-sm font-medium">{payload.stage}</p>
              <JsonViewer value={{ input: payload.inputPayload, output: payload.outputPayload }} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="errors" className="space-y-3">
          {agent.logs
            ?.filter((log) => ["error", "critical"].includes(log.severity))
            .map((log) => (
              <Card key={log.id} className="border-red-500/30">
                <CardContent className="p-4">
                  <SeverityBadge severity={log.severity} />
                  <p className="mt-2 text-sm">{log.message}</p>
                  <JsonViewer value={log.errorPayload} />
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
