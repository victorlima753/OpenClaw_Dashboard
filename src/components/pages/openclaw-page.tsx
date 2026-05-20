"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  PlayCircle,
  RadioTower,
  RefreshCw,
  Send,
  Server,
  Terminal,
  Unplug,
  Webhook
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentStatusBadge, JobStatusBadge, SeverityBadge } from "@/components/common/status-badge";
import { JsonViewer } from "@/components/common/json-viewer";
import { apiFetch } from "@/lib/api/client";
import { useOpenClawOverview } from "@/lib/api/hooks";
import { compactNumber, formatRelativeTime } from "@/lib/utils";
import { PageError, PageLoading } from "./page-state";

type SyncResult = {
  sync?: {
    updated: number;
    discovered: number;
    sessionsDiscovered?: number;
    activitiesRecorded?: number;
  };
};

export function OpenClawPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useOpenClawOverview();
  const invalidate = () => {
    for (const key of ["openclaw", "dashboard", "agents", "tasks", "queue", "review", "audit"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const syncMutation = useMutation({
    mutationFn: () => apiFetch<SyncResult>("/api/openclaw/sync-agents", { method: "POST", body: "{}" }),
    onSuccess: invalidate
  });
  const testJobMutation = useMutation({
    mutationFn: () => apiFetch("/api/openclaw/test-job", { method: "POST", body: "{}" }),
    onSuccess: invalidate
  });

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">OpenClaw</h1>
          <p className="text-sm text-muted-foreground">
            Diagnostico da integracao real entre o Command Center, Gateway, worker, agentes e jobs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className={syncMutation.isPending ? "animate-spin" : ""} />
            Sincronizar
          </Button>
          <Button onClick={() => testJobMutation.mutate()} disabled={testJobMutation.isPending}>
            <Send />
            Enviar job teste
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Gateway</p>
              <p className="mt-1 text-sm font-medium">{data.gateway.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.gateway.lastSeenAt ? formatRelativeTime(data.gateway.lastSeenAt) : "Sem evento"}
              </p>
            </div>
            {data.gateway.connected ? (
              <CheckCircle2 className="size-5 text-emerald-300" />
            ) : (
              <Unplug className="size-5 text-amber-300" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Worker</p>
              <p className="mt-1 text-sm font-medium">{data.worker.connected ? "Ativo" : "Sem heartbeat recente"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.worker.lastSeenAt ? formatRelativeTime(data.worker.lastSeenAt) : "Nao visto"}
              </p>
            </div>
            <Server className={data.worker.connected ? "size-5 text-emerald-300" : "size-5 text-amber-300"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Webhook real</p>
              <p className="mt-1 text-sm font-medium">{data.webhook.configured ? "Secret configurado" : "Secret ausente"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.webhook.latestReceivedAt ? formatRelativeTime(data.webhook.latestReceivedAt) : "Sem eventos"}
              </p>
            </div>
            <Webhook className={data.webhook.configured ? "size-5 text-emerald-300" : "size-5 text-amber-300"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Agentes mapeados</p>
              <p className="mt-1 text-2xl font-semibold">{data.agents.mapped}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.agents.unmappedExternalIds.length} externos sem mapa</p>
            </div>
            <Bot className="size-5 text-sky-300" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Jobs OpenClaw</p>
              <p className="mt-1 text-2xl font-semibold">{compactNumber(data.jobs.openClaw)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Seed {data.jobs.seed} / Manual {data.jobs.manual}</p>
            </div>
            <PlayCircle className="size-5 text-violet-300" />
          </CardContent>
        </Card>
      </div>

      <Card className={data.webhook.configured ? "border-emerald-500/20" : "border-amber-500/25"}>
        <CardHeader>
          <CardTitle>Webhook estruturado dos agentes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Eventos recebidos</p>
                <p className="mt-1 text-2xl font-semibold">{compactNumber(data.webhook.receivedCount)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Duplicados ignorados</p>
                <p className="mt-1 text-2xl font-semibold">{compactNumber(data.webhook.duplicateCount)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Ultimo evento</p>
                <p className="mt-1 truncate text-sm font-medium">{data.webhook.latestEvent ?? "-"}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{data.webhook.latestJobId ?? "Sem job"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Ultimo problema</p>
                <p className="mt-1 truncate text-sm font-medium">{data.webhook.latestError?.decision ?? "-"}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {data.webhook.latestError ? formatRelativeTime(data.webhook.latestError.createdAt) : "Sem erros"}
                </p>
              </div>
            </div>
            {!data.webhook.configured ? (
              <p className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
                Configure `OPENCLAW_WEBHOOK_SECRET` no EasyPanel antes de orientar os agentes a chamarem o webhook.
              </p>
            ) : (
              <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Endpoint pronto para receber eventos `TechSoulsJobUpdate v1` dos agentes OpenClaw.
              </p>
            )}
            {data.webhook.latestLog ? (
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <SeverityBadge severity={data.webhook.latestLog.severity} />
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(data.webhook.latestLog.createdAt)}
                  </span>
                </div>
                <p className="text-sm">{data.webhook.latestLog.message}</p>
              </div>
            ) : null}
            {data.webhook.latestError ? (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-100">
                  <AlertTriangle className="size-4" />
                  Ultimo alerta do webhook
                </div>
                <p className="text-sm text-amber-100">{data.webhook.latestError.message}</p>
              </div>
            ) : null}
          </div>
          <div className="min-w-0 rounded-md border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="size-4" />
              Snippet de teste redigido
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {data.webhook.curlExample}
            </pre>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Eventos por agente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.webhook.byAgent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum webhook de agente recebido ainda.</p>
            ) : (
              data.webhook.byAgent.map((row) => (
                <div key={row.agentId ?? "none"} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>{row.agentName}</span>
                  <Badge>{compactNumber(row.total)}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jobs reais por status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {data.webhook.byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum job OpenClaw real recebido ainda.</p>
            ) : (
              data.webhook.byStatus.map((row) => (
                <div key={row.status} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <JobStatusBadge status={row.status} />
                  <span className="font-medium">{compactNumber(row.total)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-emerald-300" />
            Checklist de producao
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          {[
            "OPENCLAW_WEBHOOK_SECRET configurado no dashboard e nos agentes.",
            "Worker OpenClaw rodando como segundo servico no EasyPanel.",
            "Cada agente colou o snippet TechSoulsJobUpdate v1 correspondente.",
            "Todos os agentes reutilizam o mesmo jobId do inicio ao fim.",
            "Curl de teste retorna 200 e cria card no Kanban.",
            "Um job real passa por pesquisa, escrita, compliance e publisher mockado."
          ].map((item) => (
            <div key={item} className="rounded-md border p-3">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>

      {syncMutation.data?.sync ? (
        <Card className="border-sky-500/25">
          <CardContent className="p-4 text-sm text-sky-200">
            Sync concluido: {syncMutation.data.sync.updated} agentes atualizados, {syncMutation.data.sync.discovered} descobertos,
            {" "}
            {syncMutation.data.sync.activitiesRecorded ?? 0} atividades registradas.
          </CardContent>
        </Card>
      ) : null}
      {syncMutation.error || testJobMutation.error ? (
        <Card className="border-red-500/25">
          <CardContent className="p-4 text-sm text-red-300">
            {(syncMutation.error ?? testJobMutation.error)?.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mapa de agentes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 font-medium">Agente</th>
                  <th className="py-2 font-medium">Slug dashboard</th>
                  <th className="py-2 font-medium">ID ativo</th>
                  <th className="py-2 font-medium">Aliases OpenClaw</th>
                  <th className="py-2 font-medium">Descobertos</th>
                  <th className="py-2 font-medium">Scheduler</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Ultimo sync</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.rows.map((agent) => (
                  <tr key={agent.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link className="font-medium hover:text-primary" href={`/agents/${agent.id}`}>
                        {agent.name}
                      </Link>
                    </td>
                    <td className="py-3 text-muted-foreground">{agent.slug}</td>
                    <td className="py-3">{agent.externalId ?? "-"}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {agent.mappedExternalIds.length === 0
                          ? "-"
                          : agent.mappedExternalIds.map((externalId) => (
                            <Badge key={externalId} className="border-sky-500/25 bg-sky-500/10 text-sky-200">
                                {externalId}
                              </Badge>
                            ))}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {agent.discoveredExternalIds.length === 0
                          ? "-"
                          : agent.discoveredExternalIds.map((externalId) => (
                              <Badge key={externalId} className="border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
                                {externalId}
                              </Badge>
                            ))}
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge
                        className={
                          agent.openClawEnabled
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
                        }
                      >
                        {agent.openClawEnabled ? "enabled" : "disabled"}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <AgentStatusBadge status={agent.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {agent.lastOpenClawSyncAt ? formatRelativeTime(agent.lastOpenClawSyncAt) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Externos sem mapeamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.agents.unmappedExternalIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agente externo pendente no ultimo sync.</p>
            ) : (
              data.agents.unmappedExternalIds.map((externalId) => (
                <div key={externalId} className="rounded-md border p-3 text-sm">
                  {externalId}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jobs reais recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.jobs.latest.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda nao chegaram jobs com `dataSource=openclaw`.</p>
            ) : (
              data.jobs.latest.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <Link className="truncate text-sm font-medium hover:text-primary" href={`/tasks/${job.jobId}`}>
                      {job.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {job.jobId} · {formatRelativeTime(job.updatedAt)}
                    </p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs OpenClaw</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <SeverityBadge severity={log.severity} />
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                </div>
                <p className="text-sm">{log.message}</p>
                {log.outputPayload ? <JsonViewer value={log.outputPayload} /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RadioTower className="size-4" />
        O worker deve permanecer como servico separado; esta pagina confirma se ele gravou heartbeat no Postgres.
      </div>
    </div>
  );
}
