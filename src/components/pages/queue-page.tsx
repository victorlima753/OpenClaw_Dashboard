"use client";

import Link from "next/link";
import { ArrowUp, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JobStatusBadge, PriorityBadge } from "@/components/common/status-badge";
import { JsonViewer } from "@/components/common/json-viewer";
import { useQueue, useTaskAction } from "@/lib/api/hooks";
import { PageError, PageLoading } from "./page-state";
import type { ArticleJobDto } from "@/lib/types";

type QueueItem = ArticleJobDto & { attempts?: number; retryDelaySeconds?: number; nextAgent?: string };

export function QueuePage() {
  const { data, isLoading, error } = useQueue();
  const action = useTaskAction();

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Fila de tarefas</h1>
        <p className="text-sm text-muted-foreground">
          Jobs aguardando execução, retry ou decisão manual.
        </p>
      </div>
      <div className="space-y-3">
        {(data as QueueItem[]).map((job) => (
          <Card key={job.jobId}>
            <CardContent className="grid gap-4 p-4 xl:grid-cols-[1fr_0.7fr_auto] xl:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{job.title}</h2>
                  <JobStatusBadge status={job.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.jobId} · próximo agente: {job.nextAgent ?? job.assignedAgent?.name ?? "Orchestrator"}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span>Tentativas: {job.attempts ?? 0}</span>
                  <span>Delay/retry: {job.retryDelaySeconds ?? 0}s</span>
                  <PriorityBadge priority={job.priority} />
                </div>
              </div>
              <JsonViewer value={job.payloadSnapshots?.[0]?.inputPayload ?? { jobId: job.jobId, topic: job.topic }} />
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/tasks/${job.jobId}`}>
                    <ExternalLink /> Abrir
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => action.mutate({ jobId: job.jobId, action: "retry" })}>
                  <RotateCcw /> Retry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => action.mutate({ jobId: job.jobId, action: "priority", body: { priority: "urgent" } })}
                >
                  <ArrowUp /> Promover
                </Button>
                <Button size="sm" variant="destructive" onClick={() => action.mutate({ jobId: job.jobId, action: "cancel" })}>
                  <Trash2 /> Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
