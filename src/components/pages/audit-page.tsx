"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JsonViewer } from "@/components/common/json-viewer";
import { SeverityBadge } from "@/components/common/status-badge";
import { useAuditLogs } from "@/lib/api/hooks";
import { formatRelativeTime } from "@/lib/utils";
import { PageError, PageLoading } from "./page-state";

export function AuditPage() {
  const { data, isLoading, error } = useAuditLogs();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");

  const filtered = useMemo(() => {
    return (data ?? []).filter((log) => {
      const matchesSeverity = severity === "all" || log.severity === severity;
      const haystack = `${log.jobId ?? ""} ${log.agent?.name ?? ""} ${log.eventType} ${log.message}`.toLowerCase();
      return matchesSeverity && haystack.includes(query.toLowerCase());
    });
  }, [data, query, severity]);

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Logs e auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Eventos do sistema, decisões, scores, severidade e payloads expansíveis.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por job_id, agente, evento ou mensagem..." />
          </div>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.map((log) => (
          <Card key={log.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={log.severity} />
                  <CardTitle>{log.eventType}</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm md:grid-cols-5">
                <p><span className="text-muted-foreground">Job:</span> {log.jobId ?? "-"}</p>
                <p><span className="text-muted-foreground">Agente:</span> {log.agent?.name ?? "-"}</p>
                <p><span className="text-muted-foreground">Etapa:</span> {log.stage ?? "-"}</p>
                <p><span className="text-muted-foreground">Decisão:</span> {log.decision ?? "-"}</p>
                <p><span className="text-muted-foreground">Score:</span> {log.score ?? "-"}</p>
              </div>
              <p className="text-sm">{log.message}</p>
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">Payload JSON</summary>
                <div className="mt-3">
                  <JsonViewer value={{ input: log.inputPayload, output: log.outputPayload, error: log.errorPayload }} />
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
