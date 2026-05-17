"use client";

import { useParams } from "next/navigation";
import { Check, RotateCcw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { JobStatusBadge, PriorityBadge, SeverityBadge } from "@/components/common/status-badge";
import { JsonViewer } from "@/components/common/json-viewer";
import { useTask, useTaskAction } from "@/lib/api/hooks";
import { formatRelativeTime } from "@/lib/utils";
import { PageError, PageLoading } from "./page-state";

const workflow = [
  "new",
  "researching",
  "relevance_scoring",
  "clustering",
  "validating",
  "writing",
  "seo_optimizing",
  "affiliate_routing",
  "editing",
  "compliance_checking",
  "publishing",
  "published"
];

export function TaskDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { data: job, isLoading, error } = useTask(jobId);
  const action = useTaskAction();

  if (isLoading) return <PageLoading />;
  if (error || !job) return <PageError error={error} />;

  const currentIndex = workflow.indexOf(job.status);
  const completed = workflow.filter((_, index) => currentIndex >= 0 && index <= currentIndex);
  const pending = workflow.filter((_, index) => currentIndex < 0 || index > currentIndex);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-normal">{job.title}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.jobId} · {job.topic} · {job.category}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => action.mutate({ jobId, action: "retry" })}>
            <RotateCcw /> Retry
          </Button>
          <Button
            variant="outline"
            onClick={() => action.mutate({ jobId, action: "status", body: { status: "human_review" } })}
          >
            <Send /> Revisão humana
          </Button>
          <Button onClick={() => action.mutate({ jobId, action: "status", body: { status: "publishing" } })}>
            <Check /> Aprovar
          </Button>
          <Button variant="destructive" onClick={() => action.mutate({ jobId, action: "cancel" })}>
            <Trash2 /> Rejeitar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="payloads">Payloads</TabsTrigger>
          <TabsTrigger value="article">Article Preview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Scores e roteamento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {[
                ["Relevance", job.relevanceScore],
                ["Validation", job.validationScore],
                ["Editorial", job.editorialScore],
                ["SEO", job.seoScore],
                ["Compliance", job.complianceScore],
                ["Monetization", job.monetizationScore]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between rounded-md border p-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value ?? "-"}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-muted-foreground">Prioridade</span>
                <PriorityBadge priority={job.priority} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contexto</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p><span className="text-muted-foreground">Fonte original:</span> {job.sourceName}</p>
              <p><span className="text-muted-foreground">URL:</span> {job.sourceUrl}</p>
              <p><span className="text-muted-foreground">Cluster:</span> {job.clusterId ?? "Sem cluster"}</p>
              <p><span className="text-muted-foreground">Agente atual:</span> {job.assignedAgent?.name ?? "Sem agente"}</p>
              <p><span className="text-muted-foreground">Criado:</span> {formatRelativeTime(job.createdAt)}</p>
              <p><span className="text-muted-foreground">WordPress:</span> {job.wordpressPostId ?? "Ainda nao enviado"}</p>
              {job.errorMessage ? <p className="text-red-300">{job.errorMessage}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Etapas concluídas</CardTitle></CardHeader>
            <CardContent className="space-y-2">{completed.map((step) => <div key={step} className="rounded-md border p-3 text-sm">{step}</div>)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Etapas pendentes</CardTitle></CardHeader>
            <CardContent className="space-y-2">{pending.map((step) => <div key={step} className="rounded-md border p-3 text-sm text-muted-foreground">{step}</div>)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payloads" className="space-y-4">
          {job.payloadSnapshots?.map((payload) => (
            <div key={payload.id} className="space-y-2">
              <p className="text-sm font-medium">{payload.stage}</p>
              <JsonViewer value={{ input: payload.inputPayload, output: payload.outputPayload }} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="article">
          <Card>
            <CardContent className="p-5">
              <article className="prose prose-zinc max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap text-sm">{job.articleMarkdown ?? "Artigo ainda nao gerado."}</pre>
              </article>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-3">
          {job.sources?.map((source) => (
            <Card key={source.id}>
              <CardContent className="p-4">
                <p className="font-medium">{source.name}</p>
                <p className="text-sm text-muted-foreground">{source.url}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {source.role} · confiabilidade {source.reliabilityScore}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="affiliate">
          <Card>
            <CardContent className="grid gap-3 p-4 text-sm">
              <p>Afiliado: {job.hasAffiliate ? "ativo" : "inativo"}</p>
              <p>Score de monetização: {job.monetizationScore ?? "-"}</p>
              <JsonViewer value={{ router: "mock", decision: job.hasAffiliate ? "include_offer" : "skip" }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-3">
          {job.logs?.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <SeverityBadge severity={log.severity} />
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm">{log.message}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader><CardTitle>Ação manual com comentário</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Comentário humano para auditoria..." />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => action.mutate({ jobId, action: "status", body: { status: "publishing" } })}>Aprovar publicação</Button>
                <Button variant="outline" onClick={() => action.mutate({ jobId, action: "status", body: { status: "drafted" } })}>Salvar rascunho</Button>
                <Button variant="outline" onClick={() => action.mutate({ jobId, action: "status", body: { status: "writing" } })}>Devolver ao Writer</Button>
                <Button variant="outline" onClick={() => action.mutate({ jobId, action: "status", body: { status: "validating" } })}>Devolver ao Validator</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
