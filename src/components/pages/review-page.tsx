"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, FileText, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { JobStatusBadge, SeverityBadge } from "@/components/common/status-badge";
import { useReviewAction, useReviewQueue } from "@/lib/api/hooks";
import { PageError, PageLoading } from "./page-state";

export function ReviewPage() {
  const { data, isLoading, error } = useReviewQueue();
  const reviewAction = useReviewAction();
  const [comments, setComments] = useState<Record<string, string>>({});

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Revisão humana</h1>
        <p className="text-sm text-muted-foreground">
          Aprovação manual para pautas sensíveis, alertas de validação e compliance.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.map((review) => {
          const job = review.job;
          if (!job) return null;
          const comment = comments[job.jobId] ?? "";
          const decide = (action: string) => reviewAction.mutate({ jobId: job.jobId, action, comment });

          return (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{job.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{job.jobId}</p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{review.reason}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Resumo da pauta</p>
                    <p className="mt-1 text-sm">{job.topic} · {job.category}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Fontes</p>
                    <p className="mt-1 truncate text-sm">{job.sources?.map((source) => source.name).join(", ")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {job.logs?.map((log) => (
                    <div key={log.id} className="flex gap-2 rounded-md border p-2 text-sm">
                      <SeverityBadge severity={log.severity} />
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
                <Textarea
                  value={comment}
                  onChange={(event) => setComments((current) => ({ ...current, [job.jobId]: event.target.value }))}
                  placeholder="Comentário humano para auditoria..."
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => decide("approve")}>
                    <Check /> Aprovar publicação
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide("return-to-writer")}>
                    <RotateCcw /> Devolver ao Writer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide("return-to-validator")}>
                    <ShieldAlert /> Devolver ao Validator
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide("reject")}>
                    <X /> Rejeitar
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/tasks/${job.jobId}`}>
                      <ExternalLink /> Detalhes
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decide("draft")}>
                    <FileText /> Salvar rascunho
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
