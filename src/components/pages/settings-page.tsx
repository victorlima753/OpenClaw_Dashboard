"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import { PageError, PageLoading } from "./page-state";

type Setting = { id: string; key: string; value: unknown };

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
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] })
  });

  const persisted = useMemo(
    () => Object.fromEntries((data ?? []).map((setting) => [setting.key, setting.value])),
    [data]
  );
  const form = { ...persisted, ...draft };

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError error={error} />;

  const setValue = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));

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
