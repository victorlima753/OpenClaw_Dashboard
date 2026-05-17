import type { AgentStatus, JobPriority, JobStatus, LogSeverity, ReviewStatus } from "../types";

export type SeedAgent = {
  name: string;
  slug: string;
  description: string;
  skillName: string;
  status: AgentStatus;
  currentTaskId?: string;
  totalTasksProcessed: number;
  successCount: number;
  failureCount: number;
  averageProcessingTimeMs: number;
};

export type SeedJob = {
  jobId: string;
  title: string;
  topic: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  clusterId?: string | null;
  currentStage: string;
  status: JobStatus;
  priority: JobPriority;
  assignedAgentSlug?: string | null;
  relevanceScore?: number | null;
  validationScore?: number | null;
  editorialScore?: number | null;
  seoScore?: number | null;
  complianceScore?: number | null;
  monetizationScore?: number | null;
  hasAffiliate: boolean;
  requiresHumanReview: boolean;
  wordpressPostId?: string | null;
  wordpressPreviewUrl?: string | null;
  errorMessage?: string | null;
  articleMarkdown?: string | null;
  createdAt: Date;
};

export type SeedLog = {
  jobId?: string | null;
  agentSlug?: string | null;
  eventType: string;
  severity: LogSeverity;
  stage?: string | null;
  decision?: string | null;
  score?: number | null;
  message: string;
  inputPayload?: unknown;
  outputPayload?: unknown;
  errorPayload?: unknown;
  createdAt: Date;
};

export type SeedPayload = {
  jobId: string;
  stage: string;
  agentSlug?: string | null;
  inputPayload: unknown;
  outputPayload: unknown;
  inputHash: string;
  outputHash: string;
  createdAt: Date;
};

export type SeedSource = {
  jobId: string;
  name: string;
  url: string;
  role: string;
  reliabilityScore: number;
  publishedAt?: Date | null;
};

export type SeedReview = {
  jobId: string;
  status: ReviewStatus;
  reason: string;
  reviewerComment?: string | null;
  decision?: string | null;
};

const baseDate = new Date("2026-05-17T12:00:00.000Z");

function minutesAgo(minutes: number) {
  return new Date(baseDate.getTime() - minutes * 60_000);
}

export const seedAgents: SeedAgent[] = [
  {
    name: "Orchestrator",
    slug: "techsouls-orchestrator",
    description: "Coordena o ciclo editorial, delega etapas e consolida decisões do workflow.",
    skillName: "techsouls-orchestrator",
    status: "busy",
    currentTaskId: "ts-2026-05-17-0008",
    totalTasksProcessed: 862,
    successCount: 821,
    failureCount: 41,
    averageProcessingTimeMs: 42000
  },
  {
    name: "Researcher",
    slug: "techsouls-researcher",
    description: "Coleta sinais, fontes e contexto para novas pautas de tecnologia.",
    skillName: "techsouls-news-researcher",
    status: "busy",
    currentTaskId: "ts-2026-05-17-0002",
    totalTasksProcessed: 742,
    successCount: 705,
    failureCount: 37,
    averageProcessingTimeMs: 210000
  },
  {
    name: "Relevance Classifier",
    slug: "techsouls-relevance-score",
    description: "Pontua relevância editorial, urgência e aderência ao público brasileiro.",
    skillName: "techsouls-relevance-score",
    status: "online",
    totalTasksProcessed: 731,
    successCount: 712,
    failureCount: 19,
    averageProcessingTimeMs: 54000
  },
  {
    name: "Dedup / Cluster",
    slug: "techsouls-news-clustering",
    description: "Agrupa pautas similares, evita duplicidade e preserva cobertura original.",
    skillName: "techsouls-news-clustering",
    status: "idle",
    totalTasksProcessed: 488,
    successCount: 474,
    failureCount: 14,
    averageProcessingTimeMs: 67000
  },
  {
    name: "Validator",
    slug: "techsouls-fact-check",
    description: "Valida fatos, fontes, riscos de alucinação e alertas de segurança editorial.",
    skillName: "techsouls-fact-check",
    status: "busy",
    currentTaskId: "ts-2026-05-17-0001",
    totalTasksProcessed: 519,
    successCount: 492,
    failureCount: 27,
    averageProcessingTimeMs: 184000
  },
  {
    name: "Writer",
    slug: "techsouls-blog-writer",
    description: "Gera artigos em português brasileiro com estrutura editorial TechSouls.",
    skillName: "techsouls-blog-writer",
    status: "online",
    totalTasksProcessed: 421,
    successCount: 397,
    failureCount: 24,
    averageProcessingTimeMs: 620000
  },
  {
    name: "SEO",
    slug: "techsouls-seo",
    description: "Otimiza título, subtítulos, meta description, entidades e intenção de busca.",
    skillName: "techsouls-seo-optimizer",
    status: "idle",
    totalTasksProcessed: 398,
    successCount: 386,
    failureCount: 12,
    averageProcessingTimeMs: 93000
  },
  {
    name: "Affiliate",
    slug: "techsouls-affiliate-router",
    description: "Decide oportunidade de monetização e roteia ofertas afiliadas quando cabível.",
    skillName: "techsouls-affiliate-router",
    status: "online",
    totalTasksProcessed: 276,
    successCount: 262,
    failureCount: 14,
    averageProcessingTimeMs: 73000
  },
  {
    name: "Copywriter",
    slug: "techsouls-copywriter",
    description: "Refina chamadas, posts sociais, CTAs e variações de headline.",
    skillName: "techsouls-copywriter",
    status: "paused",
    totalTasksProcessed: 213,
    successCount: 204,
    failureCount: 9,
    averageProcessingTimeMs: 148000
  },
  {
    name: "Editor Final",
    slug: "techsouls-final-editor",
    description: "Ajusta tom, fluidez, clareza e consistência antes de publicação.",
    skillName: "techsouls-final-editor",
    status: "online",
    totalTasksProcessed: 352,
    successCount: 334,
    failureCount: 18,
    averageProcessingTimeMs: 275000
  },
  {
    name: "Compliance",
    slug: "techsouls-compliance",
    description: "Verifica segurança, direitos autorais, política editorial e riscos legais.",
    skillName: "techsouls-compliance",
    status: "error",
    currentTaskId: "ts-2026-05-17-0019",
    totalTasksProcessed: 337,
    successCount: 316,
    failureCount: 21,
    averageProcessingTimeMs: 124000
  },
  {
    name: "Publisher",
    slug: "techsouls-wordpress-publisher",
    description: "Prepara payload WordPress, rascunhos, publicação e metadados.",
    skillName: "techsouls-wordpress-publisher",
    status: "online",
    totalTasksProcessed: 301,
    successCount: 288,
    failureCount: 13,
    averageProcessingTimeMs: 112000
  },
  {
    name: "Social",
    slug: "techsouls-social",
    description: "Gera posts sociais e pacotes de distribuição pós-publicação.",
    skillName: "techsouls-social-distribution",
    status: "offline",
    totalTasksProcessed: 188,
    successCount: 179,
    failureCount: 9,
    averageProcessingTimeMs: 96000
  },
  {
    name: "Analytics/CRO",
    slug: "techsouls-analytics-cro",
    description: "Analisa desempenho, CTR, retenção, conversão e sugestões de melhoria.",
    skillName: "techsouls-analytics-cro",
    status: "idle",
    totalTasksProcessed: 144,
    successCount: 138,
    failureCount: 6,
    averageProcessingTimeMs: 131000
  },
  {
    name: "Audit",
    slug: "techsouls-audit-log",
    description: "Registra eventos, decisões, payloads e trilha de auditoria de ponta a ponta.",
    skillName: "techsouls-audit-log",
    status: "online",
    totalTasksProcessed: 1098,
    successCount: 1090,
    failureCount: 8,
    averageProcessingTimeMs: 17000
  }
];

const topics = [
  ["Samsung anuncia novo recurso de IA para celulares Galaxy", "IA em smartphones", "Celulares", "Samsung Newsroom"],
  ["OpenAI libera melhorias para automações com agentes", "Agentes de IA", "Inteligência Artificial", "OpenAI Blog"],
  ["Google testa novo recurso de busca multimodal no Android", "Busca multimodal", "Google", "Google Keyword"],
  ["Apple prepara integração de IA local para iPhone", "IA local", "Apple", "Apple Newsroom"],
  ["Microsoft expande Copilot para fluxos empresariais", "Copilot", "Produtividade", "Microsoft Blog"],
  ["NVIDIA apresenta nova geração de chips para IA", "Chips de IA", "Hardware", "NVIDIA Newsroom"],
  ["Meta anuncia ferramentas de criação com IA generativa", "IA generativa", "Redes Sociais", "Meta Newsroom"],
  ["Amazon atualiza Alexa com automações conversacionais", "Assistentes", "Casa Inteligente", "Amazon Devices"],
  ["WhatsApp testa resumo automático de conversas", "Mensageria", "Apps", "WABetaInfo"],
  ["Anatel discute novas regras para celulares importados", "Regulação", "Brasil", "Anatel"],
  ["Notebook gamer com RTX entra em promoção no Brasil", "Ofertas", "Hardware", "Kabum"],
  ["Novo SSD NVMe promete mais desempenho para criadores", "SSD", "Componentes", "Kingston Blog"],
  ["Chrome recebe proteção contra golpes com IA", "Segurança", "Navegadores", "Chrome Blog"],
  ["Pix por aproximação ganha nova fase de testes", "Pagamentos", "Fintech", "Banco Central"],
  ["Android Auto recebe atualização com novos apps", "Mobilidade", "Android", "Android Developers"],
  ["WordPress lança melhorias no editor de blocos", "WordPress", "CMS", "WordPress.org"],
  ["Vazamento sugere novas câmeras para Galaxy Fold", "Rumores", "Celulares", "SamMobile"],
  ["Relatório aponta alta no uso de IA em pequenas empresas", "Mercado", "Negócios", "Sebrae"],
  ["Falha crítica atinge plugin popular de WordPress", "Segurança", "WordPress", "WPScan"],
  ["Novo roteador Wi-Fi 7 chega ao varejo nacional", "Redes", "Casa Conectada", "TP-Link"],
  ["YouTube testa dublagem automática para criadores", "Vídeo", "Criadores", "YouTube Blog"],
  ["Pesquisa mostra avanço de notebooks ARM no mercado", "PCs", "Hardware", "IDC"],
  ["Threads prepara painel de métricas para marcas", "Social", "Marketing", "Meta Newsroom"],
  ["Nova versão do PostgreSQL melhora consultas analíticas", "Banco de Dados", "Dev", "PostgreSQL.org"]
] as const;

const statuses: JobStatus[] = [
  "validating",
  "researching",
  "relevance_scoring",
  "clustering",
  "writing",
  "seo_optimizing",
  "affiliate_routing",
  "editing",
  "compliance_checking",
  "publishing",
  "human_review",
  "drafted",
  "published",
  "failed",
  "discarded",
  "new",
  "published",
  "human_review",
  "failed",
  "published",
  "human_review",
  "failed",
  "published",
  "published"
];

const statusAgent: Partial<Record<JobStatus, string>> = {
  researching: "techsouls-researcher",
  relevance_scoring: "techsouls-relevance-score",
  clustering: "techsouls-news-clustering",
  validating: "techsouls-fact-check",
  writing: "techsouls-blog-writer",
  seo_optimizing: "techsouls-seo",
  affiliate_routing: "techsouls-affiliate-router",
  editing: "techsouls-final-editor",
  compliance_checking: "techsouls-compliance",
  publishing: "techsouls-wordpress-publisher",
  human_review: "techsouls-orchestrator",
  failed: "techsouls-audit-log",
  drafted: "techsouls-wordpress-publisher",
  published: "techsouls-wordpress-publisher"
};

export const seedJobs: SeedJob[] = topics.map((topic, index) => {
  const status = statuses[index];
  const jobNumber = `${index + 1}`.padStart(4, "0");
  const isPublished = status === "published";
  const isFailed = status === "failed";
  const isReview = status === "human_review";
  const relevanceScore = Math.min(98, 62 + ((index * 7) % 36));
  const validationScore = index % 4 === 0 ? null : Math.min(96, 58 + ((index * 9) % 38));
  const complianceScore =
    status === "compliance_checking" || isPublished || status === "drafted" || isReview
      ? Math.min(99, 67 + ((index * 11) % 31))
      : null;

  return {
    jobId: `ts-2026-05-17-${jobNumber}`,
    title: topic[0],
    topic: topic[1],
    category: topic[2],
    sourceName: topic[3],
    sourceUrl: `https://example.com/techsouls/source-${jobNumber}`,
    clusterId: index % 3 === 0 ? `cluster-2026-05-${Math.ceil((index + 1) / 3)}` : null,
    currentStage: status,
    status,
    priority: (index % 9 === 0 ? "urgent" : index % 4 === 0 ? "high" : index % 5 === 0 ? "low" : "normal") as JobPriority,
    assignedAgentSlug: statusAgent[status] ?? null,
    relevanceScore,
    validationScore,
    editorialScore: status === "writing" || status === "editing" || isPublished ? 72 + (index % 22) : null,
    seoScore: status === "seo_optimizing" || isPublished || status === "drafted" ? 70 + (index % 24) : null,
    complianceScore,
    monetizationScore: index % 2 === 0 ? 61 + (index % 33) : null,
    hasAffiliate: index % 2 === 0,
    requiresHumanReview: isReview || index % 11 === 0,
    wordpressPostId: isPublished ? `wp-${4300 + index}` : null,
    wordpressPreviewUrl:
      isPublished || status === "drafted" ? `https://techsouls.com.br/?p=${4300 + index}&preview=true` : null,
    errorMessage: isFailed
      ? index % 2 === 0
        ? "Compliance retornou alerta crítico para fonte sem confirmação independente."
        : "Timeout ao preparar payload de publicação WordPress."
      : null,
    articleMarkdown:
      isPublished || status === "drafted" || isReview
        ? `# ${topic[0]}\n\nResumo editorial gerado para a pauta sobre ${topic[1]}.\n\n## O que muda\n\nO sinal indica impacto direto para leitores brasileiros e merece acompanhamento nos próximos ciclos.\n\n## Pontos de atenção\n\n- Confirmar fonte primária.\n- Checar disponibilidade no Brasil.\n- Validar claims técnicos antes da publicação.`
        : null,
    createdAt: minutesAgo(38 + index * 23)
  };
});

const eventSequence = [
  "job_created",
  "relevance_scored",
  "validation_completed",
  "article_written",
  "seo_completed",
  "affiliate_decided",
  "compliance_completed",
  "wordpress_payload_created",
  "published",
  "drafted",
  "human_review_requested"
];

export const seedLogs: SeedLog[] = Array.from({ length: 120 }, (_, index) => {
  const job = seedJobs[index % seedJobs.length];
  const agentSlug = job.assignedAgentSlug ?? seedAgents[index % seedAgents.length].slug;
  const eventType =
    job.status === "failed" && index % 8 === 0
      ? "failed"
      : index % 37 === 0
        ? "prompt_injection_detected"
        : eventSequence[index % eventSequence.length];
  const severity: LogSeverity =
    eventType === "failed" ? "error" : eventType === "prompt_injection_detected" ? "critical" : index % 13 === 0 ? "warning" : "info";

  return {
    jobId: job.jobId,
    agentSlug,
    eventType,
    severity,
    stage: job.currentStage,
    decision: severity === "critical" ? "bloqueado" : job.status === "discarded" ? "descartado" : "continuar",
    score: job.relevanceScore ? Math.max(30, job.relevanceScore - (index % 10)) : null,
    message:
      severity === "critical"
        ? "Possível tentativa de prompt injection detectada em fonte externa."
        : eventType === "failed"
          ? job.errorMessage ?? "Falha operacional registrada."
          : `Evento ${eventType} processado para ${job.jobId}.`,
    inputPayload: {
      job_id: job.jobId,
      topic: job.topic,
      source: job.sourceName,
      status_before: job.status
    },
    outputPayload: {
      decision: severity === "critical" ? "send_to_human_review" : "continue",
      score: job.relevanceScore,
      next_stage: job.currentStage
    },
    errorPayload: severity === "error" || severity === "critical" ? { code: eventType, retryable: severity !== "critical" } : null,
    createdAt: minutesAgo(index * 7 + 2)
  };
});

export const seedPayloads: SeedPayload[] = seedJobs.flatMap((job, index) => {
  const stages = ["research", "validation", "editorial"];
  return stages.slice(0, job.status === "new" ? 1 : 3).map((stage, stageIndex) => ({
    jobId: job.jobId,
    stage,
    agentSlug: job.assignedAgentSlug,
    inputPayload: {
      job_id: job.jobId,
      title: job.title,
      source_url: job.sourceUrl,
      stage
    },
    outputPayload: {
      summary: `Payload mockado de ${stage} para ${job.topic}.`,
      confidence: Math.min(98, 70 + ((index + stageIndex) % 26)),
      flags: job.requiresHumanReview ? ["human_review"] : []
    },
    inputHash: `in_${job.jobId}_${stageIndex}`.replaceAll("-", ""),
    outputHash: `out_${job.jobId}_${stageIndex}`.replaceAll("-", ""),
    createdAt: minutesAgo(index * 19 + stageIndex * 4)
  }));
});

export const seedSources: SeedSource[] = seedJobs.flatMap((job, index) => [
  {
    jobId: job.jobId,
    name: job.sourceName,
    url: job.sourceUrl,
    role: "primary",
    reliabilityScore: Math.min(99, 72 + (index % 26)),
    publishedAt: minutesAgo(240 + index * 17)
  },
  {
    jobId: job.jobId,
    name: index % 2 === 0 ? "The Verge" : "Tecnoblog",
    url: `https://example.com/techsouls/reference-${index + 1}`,
    role: "reference",
    reliabilityScore: Math.min(96, 68 + (index % 22)),
    publishedAt: minutesAgo(310 + index * 11)
  }
]);

export const seedReviews: SeedReview[] = seedJobs
  .filter((job) => job.status === "human_review" || job.requiresHumanReview)
  .slice(0, 5)
  .map((job, index) => ({
    jobId: job.jobId,
    status: "pending",
    reason:
      index % 2 === 0
        ? "A pauta possui alerta de compliance ou fonte secundária divergente."
        : "O score editorial é bom, mas a publicação automática está bloqueada pelo modo seguro.",
    reviewerComment: null,
    decision: null
  }));

export const seedSettings = [
  { key: "operation_mode", value: "semi-auto" },
  { key: "auto_publish_enabled", value: false },
  { key: "minimum_relevance_score", value: 75 },
  { key: "minimum_validation_score", value: 80 },
  { key: "minimum_compliance_score", value: 85 },
  { key: "affiliate_enabled", value: true },
  { key: "social_posts_enabled", value: true },
  { key: "n8n_endpoint", value: "http://localhost:5678/webhook/techsouls" },
  { key: "orchestrator_endpoint", value: "http://localhost:4111" },
  { key: "wordpress_endpoint", value: "https://techsouls.com.br/wp-json/wp/v2" },
  { key: "mock_api_key", value: "mock-ts-command-center-key" },
  { key: "inoreader_collection_interval_minutes", value: 20 },
  { key: "max_articles_per_day", value: 8 },
  { key: "safe_mode", value: true }
];
