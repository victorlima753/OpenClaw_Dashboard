"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import { PageError, PageLoading } from "./page-state";

type Setting = { id: string; key: string; value: unknown };
type SyncResult = {
  sync?: {
    updated: number;
    discovered: number;
    sessionsDiscovered?: number;
    activitiesRecorded?: number;
  };
};
type ClearDemoResult = {
  counts?: Record<string, number>;
};

const labels: Record<string, string> = {
  operation_mode: "Modo de operação",
  auto_publish_enabled: "Publicação automática",
  minimum_relevance_score: "Limite relevance_score",
  minimum_validation_score: "Limite validation_score",
  minimum_compliance_score: "Limite compliance_score",
  affiliate_enabled: "Afiliados",
  social_posts_enabled: "Social posts",
  n8n_endpoint: "Endpoint N8N",
  orchestrator_endpoint: "Endpoint Orchestrator",
  wordpress_endpoint: "Endpoint WordPress",
  mock_api_key: "Chave API mockada",
  inoreader_collection_interval_minutes: "Intervalo Inoreader",
  max_articles_per_day: "Máximo de artigos/dia",
  safe_mode: "Modo seguro"
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Setting[]>("/api/settings")
  });
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] })
  });
  const invalidateOperationalQueries = () => {
    for (const key of ["dashboard", "agents", "tasks", "queue", "review", "audit"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const syncOpenClawMutation = useMutation({
    mutationFn: () => apiFetch<SyncResult>("/api/openclaw/sync-agents", { method: "POST", body: "{}" }),
    onSuccess: (result) => {
      invalidateOperationalQueries();
      setOperationMessage(
        `OpenClaw sincronizado: ${result.sync?.updated ?? 0} agentes atualizados, ${
          result.sync?.discovered ?? 0
        } descobertos, ${result.sync?.activitiesRecorded ?? 0} atividades registradas.`
      );
    },
    onError: (error) => setOperationMessage(error instanceof Error ? error.message : "Falha ao sincronizar OpenClaw.")
  });
  const clearDemoMutation = useMutation({
    mutationFn: () =>
      apiFetch<ClearDemoResult>("/api/admin/clear-demo-data", {
        method: "POST",
        body: JSON.stringify({ confirm: "CLEAR_DEMO_DATA" })
      }),
    onSuccess: (result) => {
      invalidateOperationalQueries();
      const jobs = result.counts?.articleJobs ?? 0;
      const logs = result.counts?.agentLogs ?? 0;
      setOperationMessage(`Dados demo/seed limpos: ${jobs} jobs e ${logs} logs removidos. Jobs OpenClaw foram preservados.`);
    },
    onError: (error) => setOperationMessage(error instanceof Error ? error.message : "Falha ao limpar dados demo.")
  });

  const persisted = useMemo(
    () => Object.fromEntries((data ?? []).map((setting) => [setting.key, setting.value])),
    [data]
  );
  const form = { ...persisted, ...draft };

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  const setValue = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const clearDemoData = () => {
    if (!window.confirm("Remover somente jobs, logs, payloads, fontes e revisoes de seed/demo? Jobs reais OpenClaw serao preservados.")) return;
    clearDemoMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Parâmetros operacionais do painel. Credenciais reais ficam apenas em secrets do servidor.
          </p>
        </div>
        <Button onClick={() => mutation.mutate(form)}>
          <Save /> Salvar ajustes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OpenClaw real</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Sincronize agentes, sessoes recentes e novos jobs reais do Gateway. Para diagnostico completo, abra a pagina OpenClaw.
            </p>
            {operationMessage ? <p className="mt-2 text-sm text-sky-300">{operationMessage}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => syncOpenClawMutation.mutate()}
              disabled={syncOpenClawMutation.isPending}
            >
              <RefreshCw className={syncOpenClawMutation.isPending ? "animate-spin" : ""} />
              Sincronizar OpenClaw
            </Button>
            <Button variant="destructive" onClick={clearDemoData} disabled={clearDemoMutation.isPending}>
              <Trash2 />
              Limpar demo data
            </Button>
            <Button variant="outline" asChild>
              <Link href="/openclaw">
                <ExternalLink /> Diagnostico
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Operação editorial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{labels.operation_mode}</label>
              <Select value={String(form.operation_mode ?? "semi-auto")} onValueChange={(value) => setValue("operation_mode", value)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="semi-auto">Semi-auto</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {["minimum_relevance_score", "minimum_validation_score", "minimum_compliance_score", "inoreader_collection_interval_minutes", "max_articles_per_day"].map((key) => (
              <div key={key}>
                <label className="text-sm font-medium">{labels[key]}</label>
                <Input className="mt-2" type="number" value={String(form[key] ?? "")} onChange={(event) => setValue(key, Number(event.target.value))} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Automação e integrações mockadas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {["auto_publish_enabled", "affiliate_enabled", "social_posts_enabled", "safe_mode"].map((key) => (
              <div key={key} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">{labels[key]}</span>
                <Switch checked={Boolean(form[key])} onCheckedChange={(value) => setValue(key, value)} />
              </div>
            ))}
            {["n8n_endpoint", "orchestrator_endpoint", "wordpress_endpoint", "mock_api_key"].map((key) => (
              <div key={key}>
                <label className="text-sm font-medium">{labels[key]}</label>
                <Input className="mt-2" value={String(form[key] ?? "")} onChange={(event) => setValue(key, event.target.value)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
