import type { AgentStatus, JobPriority, JobStatus, LogSeverity } from "./types";

export const AGENT_STATUS_META: Record<AgentStatus, { label: string; className: string; dot: string }> = {
  online: {
    label: "Online",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400"
  },
  idle: {
    label: "Disponível",
    className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
    dot: "bg-zinc-400"
  },
  busy: {
    label: "Ocupado",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400"
  },
  paused: {
    label: "Pausado",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400"
  },
  offline: {
    label: "Offline",
    className: "border-zinc-600/40 bg-zinc-700/20 text-zinc-400",
    dot: "bg-zinc-500"
  },
  error: {
    label: "Erro",
    className: "border-red-500/40 bg-red-500/10 text-red-300",
    dot: "bg-red-400"
  }
};

export const JOB_STATUS_META: Record<JobStatus, { label: string; className: string; stage: string }> = {
  new: { label: "Novo", className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300", stage: "Entrada" },
  researching: { label: "Pesquisa", className: "border-sky-500/40 bg-sky-500/10 text-sky-300", stage: "Researcher" },
  relevance_scoring: {
    label: "Relevância",
    className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    stage: "Classifier"
  },
  clustering: { label: "Cluster", className: "border-teal-500/40 bg-teal-500/10 text-teal-300", stage: "Dedup" },
  validating: {
    label: "Validação",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    stage: "Validator"
  },
  writing: { label: "Redação", className: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300", stage: "Writer" },
  seo_optimizing: {
    label: "SEO",
    className: "border-violet-500/40 bg-violet-500/10 text-violet-300",
    stage: "SEO"
  },
  affiliate_routing: {
    label: "Afiliados",
    className: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
    stage: "Affiliate"
  },
  copywriting: {
    label: "Copy",
    className: "border-pink-500/40 bg-pink-500/10 text-pink-300",
    stage: "Copywriter"
  },
  editing: {
    label: "Edição",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-300",
    stage: "Editor"
  },
  compliance_checking: {
    label: "Compliance",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    stage: "Compliance"
  },
  publishing: {
    label: "Publicando",
    className: "border-lime-500/40 bg-lime-500/10 text-lime-300",
    stage: "Publisher"
  },
  drafted: {
    label: "Rascunho",
    className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
    stage: "WordPress"
  },
  published: {
    label: "Publicado",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    stage: "Publicado"
  },
  human_review: {
    label: "Revisão humana",
    className: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    stage: "Human Review"
  },
  discarded: {
    label: "Descartado",
    className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
    stage: "Encerrado"
  },
  failed: { label: "Falhou", className: "border-red-500/40 bg-red-500/10 text-red-300", stage: "Erro" }
};

export const KANBAN_COLUMNS: { status: JobStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "researching", label: "Researching" },
  { status: "relevance_scoring", label: "Relevance Scoring" },
  { status: "clustering", label: "Clustering" },
  { status: "validating", label: "Validating" },
  { status: "writing", label: "Writing" },
  { status: "seo_optimizing", label: "SEO Optimizing" },
  { status: "affiliate_routing", label: "Affiliate Routing" },
  { status: "editing", label: "Editing" },
  { status: "compliance_checking", label: "Compliance Checking" },
  { status: "publishing", label: "Publishing" },
  { status: "human_review", label: "Human Review" },
  { status: "drafted", label: "Drafted" },
  { status: "published", label: "Published" },
  { status: "failed", label: "Failed" },
  { status: "discarded", label: "Discarded" }
];

export const PRIORITY_META: Record<JobPriority, { label: string; className: string; weight: number }> = {
  low: { label: "Baixa", className: "text-zinc-400", weight: 1 },
  normal: { label: "Normal", className: "text-sky-300", weight: 2 },
  high: { label: "Alta", className: "text-amber-300", weight: 3 },
  urgent: { label: "Urgente", className: "text-red-300", weight: 4 }
};

export const SEVERITY_META: Record<LogSeverity, { label: string; className: string }> = {
  info: { label: "Info", className: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  warning: { label: "Aviso", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  error: { label: "Erro", className: "border-red-500/30 bg-red-500/10 text-red-300" },
  critical: { label: "Crítico", className: "border-rose-500/30 bg-rose-500/10 text-rose-300" }
};

export const RUNNING_STATUSES: JobStatus[] = [
  "researching",
  "relevance_scoring",
  "clustering",
  "validating",
  "writing",
  "seo_optimizing",
  "affiliate_routing",
  "copywriting",
  "editing",
  "compliance_checking",
  "publishing"
];
