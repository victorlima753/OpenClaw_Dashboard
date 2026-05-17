"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  Loader2,
  PauseCircle,
  RadioTower,
  XCircle
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/common/status-badge";
import { useDashboard } from "@/lib/api/hooks";
import { compactNumber, formatDuration, formatPercent, formatRelativeTime } from "@/lib/utils";
import { PageError, PageLoading } from "./page-state";

const metricIcons = {
  agents: Bot,
  online: RadioTower,
  busy: Loader2,
  offline: PauseCircle,
  error: XCircle,
  queue: Clock3,
  running: Activity,
  review: AlertTriangle,
  published: CheckCircle2,
  drafted: FileText,
  failed: XCircle,
  success: Gauge
};

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  const metrics = [
    { label: "Total de agentes", value: data.totalAgents, icon: metricIcons.agents },
    { label: "Agentes online", value: data.agentsOnline, icon: metricIcons.online },
    { label: "Ocupados", value: data.agentsBusy, icon: metricIcons.busy },
    { label: "Offline", value: data.agentsOffline, icon: metricIcons.offline },
    { label: "Com erro", value: data.agentsError, icon: metricIcons.error },
    { label: "Na fila", value: data.queuedTasks, icon: metricIcons.queue },
    { label: "Em execução", value: data.runningTasks, icon: metricIcons.running },
    { label: "Revisão humana", value: data.humanReviewTasks, icon: metricIcons.review },
    { label: "Publicados hoje", value: data.publishedToday, icon: metricIcons.published },
    { label: "Rascunhos", value: data.draftedTasks, icon: metricIcons.drafted },
    { label: "Falharam", value: data.failedTasks, icon: metricIcons.failed },
    { label: "Taxa de sucesso", value: formatPercent(data.successRate), icon: metricIcons.success }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard principal</h1>
          <p className="text-sm text-muted-foreground">
            Visão de saúde do pipeline editorial multiagente TechSouls.
          </p>
        </div>
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          Tempo médio {formatDuration(data.averageProcessingTimeMs)}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {metrics.map((metric) => (
          <Card key={metric.label} className="bg-card/92">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
              </div>
              <metric.icon className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tarefas por status</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.tasksByStatus}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-28} textAnchor="end" height={80} />
                <YAxis allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarefas por agente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.tasksByAgent.slice(0, 10).map((item) => (
              <div key={item.agent} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <span className="truncate text-sm">{item.agent}</span>
                <Badge className="border-sky-500/30 bg-sky-500/10 text-sky-300">
                  {compactNumber(item.total)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimas atividades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="flex gap-3 rounded-md border p-3">
                <SeverityBadge severity={log.severity} />
                <div className="min-w-0">
                  <p className="truncate text-sm">{log.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.agent?.name ?? "Sistema"} · {formatRelativeTime(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-red-500/25">
          <CardHeader>
            <CardTitle>Falhas críticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.criticalAlerts.map((log) => (
              <div key={log.id} className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <SeverityBadge severity={log.severity} />
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm">{log.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
