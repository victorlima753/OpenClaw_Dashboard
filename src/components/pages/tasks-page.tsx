"use client";

import Link from "next/link";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentStatusBadge, JobStatusBadge, PriorityBadge } from "@/components/common/status-badge";
import { KANBAN_COLUMNS, PRIORITY_META } from "@/lib/domain";
import { useTaskAction, useTasks } from "@/lib/api/hooks";
import { useAdminStore } from "@/lib/store/admin-store";
import { formatRelativeTime } from "@/lib/utils";
import { PageError, PageLoading } from "./page-state";
import type { ArticleJobDto, JobPriority, JobStatus } from "@/lib/types";

function TaskCard({ job, isAdmin }: { job: ArticleJobDto; isAdmin: boolean }) {
  const action = useTaskAction();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.jobId,
    data: { job },
    disabled: !isAdmin
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1
  };

  const setPriority = (priority: JobPriority) =>
    action.mutate({ jobId: job.jobId, action: "priority", body: { priority } });

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="space-y-3 border-border/80 bg-background/80 p-3 shadow-none"
      {...attributes}
      {...listeners}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium">{job.title}</p>
          <JobStatusBadge status={job.status} />
        </div>
        <p className="text-xs text-muted-foreground">{job.jobId}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Categoria</p>
          <p className="truncate">{job.category}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Fonte</p>
          <p className="truncate">{job.sourceName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Relevância</p>
          <p>{job.relevanceScore ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Validação</p>
          <p>{job.validationScore ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Compliance</p>
          <p>{job.complianceScore ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Parado</p>
          <p>{formatRelativeTime(job.updatedAt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <PriorityBadge priority={job.priority} />
        {job.assignedAgent ? <AgentStatusBadge status={job.assignedAgent.status} /> : null}
        {job.hasAffiliate ? <span className="text-emerald-300">Afiliado</span> : null}
        {job.requiresHumanReview ? <span className="text-purple-300">Revisão</span> : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" asChild>
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
          onClick={() =>
            action.mutate({ jobId: job.jobId, action: "status", body: { status: "human_review" } })
          }
        >
          <Send /> Revisão
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => action.mutate({ jobId: job.jobId, action: "status", body: { status: "publishing" } })}
        >
          <ShieldCheck /> Aprovar
        </Button>
        <Button size="sm" variant="destructive" onClick={() => action.mutate({ jobId: job.jobId, action: "cancel" })}>
          <Trash2 /> Cancelar
        </Button>
        <Select value={job.priority} onValueChange={(value) => setPriority(value as JobPriority)}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_META).map(([priority, meta]) => (
              <SelectItem key={priority} value={priority}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

function KanbanColumn({
  status,
  label,
  jobs,
  isAdmin
}: {
  status: JobStatus;
  label: string;
  jobs: ArticleJobDto[];
  isAdmin: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`flex h-[calc(100vh-12rem)] w-80 shrink-0 flex-col rounded-lg border bg-card/70 ${
        isOver ? "border-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <h2 className="text-sm font-semibold">{label}</h2>
          <p className="text-xs text-muted-foreground">{jobs.length} tarefas</p>
        </div>
        <JobStatusBadge status={status} />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {jobs.map((job) => (
          <TaskCard key={job.jobId} job={job} isAdmin={isAdmin} />
        ))}
      </div>
    </section>
  );
}

export function TasksPage() {
  const { data, isLoading, error } = useTasks();
  const action = useTaskAction();
  const { isAdmin } = useAdminStore();

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  const grouped = new Map<JobStatus, ArticleJobDto[]>();
  for (const column of KANBAN_COLUMNS) grouped.set(column.status, []);
  for (const job of data) grouped.get(job.status)?.push(job);

  const onDragEnd = (event: DragEndEvent) => {
    if (!isAdmin || !event.over) return;
    const job = event.active.data.current?.job as ArticleJobDto | undefined;
    const status = event.over.id as JobStatus;
    if (!job || job.status === status) return;
    action.mutate({
      jobId: job.jobId,
      action: "status",
      body: { status, reason: "Movido manualmente no Kanban admin." }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Kanban de tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Movimento manual entre colunas fica ativo apenas no modo admin.
          </p>
        </div>
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          Modo atual: <span className="font-medium text-foreground">{isAdmin ? "Admin" : "Operador"}</span>
        </div>
      </div>

      <DndContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              label={column.label}
              jobs={grouped.get(column.status) ?? []}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
