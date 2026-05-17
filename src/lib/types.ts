export type AgentStatus = "online" | "idle" | "busy" | "paused" | "offline" | "error";

export type JobStatus =
  | "new"
  | "researching"
  | "relevance_scoring"
  | "clustering"
  | "validating"
  | "writing"
  | "seo_optimizing"
  | "affiliate_routing"
  | "copywriting"
  | "editing"
  | "compliance_checking"
  | "publishing"
  | "drafted"
  | "published"
  | "human_review"
  | "discarded"
  | "failed";

export type JobPriority = "low" | "normal" | "high" | "urgent";
export type LogSeverity = "info" | "warning" | "error" | "critical";
export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "returned_to_writer"
  | "returned_to_validator";

export type AgentDto = {
  id: string;
  name: string;
  slug: string;
  externalId: string | null;
  description: string;
  skillName: string;
  status: AgentStatus;
  currentTaskId: string | null;
  lastHeartbeatAt: string | null;
  lastActivityAt: string | null;
  lastOpenClawSyncAt: string | null;
  openClawEnabled: boolean | null;
  totalTasksProcessed: number;
  successCount: number;
  failureCount: number;
  averageProcessingTimeMs: number;
  createdAt: string;
  updatedAt: string;
  currentTask?: ArticleJobDto | null;
  logs?: AgentLogDto[];
  payloadSnapshots?: PayloadSnapshotDto[];
  assignedJobs?: ArticleJobDto[];
};

export type ArticleJobDto = {
  id: string;
  jobId: string;
  externalId: string | null;
  dataSource: string;
  title: string;
  topic: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  clusterId: string | null;
  currentStage: string;
  status: JobStatus;
  priority: JobPriority;
  assignedAgentId: string | null;
  assignedAgent?: AgentDto | null;
  relevanceScore: number | null;
  validationScore: number | null;
  editorialScore: number | null;
  seoScore: number | null;
  complianceScore: number | null;
  monetizationScore: number | null;
  hasAffiliate: boolean;
  requiresHumanReview: boolean;
  wordpressPostId: string | null;
  wordpressPreviewUrl: string | null;
  errorMessage: string | null;
  articleMarkdown: string | null;
  createdAt: string;
  updatedAt: string;
  logs?: AgentLogDto[];
  payloadSnapshots?: PayloadSnapshotDto[];
  sources?: SourceDto[];
  humanReviews?: HumanReviewDto[];
};

export type AgentLogDto = {
  id: string;
  jobId: string | null;
  agentId: string | null;
  eventType: string;
  severity: LogSeverity;
  stage: string | null;
  decision: string | null;
  score: number | null;
  message: string;
  inputPayload: unknown;
  outputPayload: unknown;
  errorPayload: unknown;
  createdAt: string;
  agent?: Pick<AgentDto, "id" | "name" | "slug"> | null;
  job?: Pick<ArticleJobDto, "jobId" | "title" | "status"> | null;
};

export type PayloadSnapshotDto = {
  id: string;
  jobId: string;
  stage: string;
  agentId: string | null;
  inputPayload: unknown;
  outputPayload: unknown;
  inputHash: string;
  outputHash: string;
  createdAt: string;
};

export type SourceDto = {
  id: string;
  jobId: string;
  name: string;
  url: string;
  role: string;
  reliabilityScore: number;
  publishedAt: string | null;
  createdAt: string;
};

export type HumanReviewDto = {
  id: string;
  jobId: string;
  status: ReviewStatus;
  reason: string;
  reviewerComment: string | null;
  decision: string | null;
  createdAt: string;
  updatedAt: string;
  job?: ArticleJobDto;
};

export type DashboardStats = {
  totalAgents: number;
  agentsOnline: number;
  agentsBusy: number;
  agentsOffline: number;
  agentsError: number;
  queuedTasks: number;
  runningTasks: number;
  humanReviewTasks: number;
  publishedToday: number;
  draftedTasks: number;
  failedTasks: number;
  successRate: number;
  averageProcessingTimeMs: number;
  tasksByStatus: { status: JobStatus; total: number; label: string }[];
  tasksByAgent: { agent: string; total: number }[];
  recentLogs: AgentLogDto[];
  criticalAlerts: AgentLogDto[];
  openClaw?: {
    realEnabled: boolean;
    connected: boolean;
    status: "connected" | "stale" | "disabled";
    label: string;
    lastSeenAt: string | null;
    lastMessage: string | null;
  };
};

export type OpenClawOverview = {
  gateway: {
    realEnabled: boolean;
    connected: boolean;
    label: string;
    lastSeenAt: string | null;
    lastMessage: string | null;
  };
  worker: {
    connected: boolean;
    lastSeenAt: string | null;
    lastMessage: string | null;
  };
  agents: {
    mapped: number;
    unmappedExternalIds: string[];
    rows: {
      id: string;
      name: string;
      slug: string;
      externalId: string | null;
      openClawEnabled: boolean | null;
      status: AgentStatus;
      lastOpenClawSyncAt: string | null;
      lastActivityAt: string | null;
    }[];
  };
  jobs: {
    openClaw: number;
    seed: number;
    manual: number;
    latest: ArticleJobDto[];
  };
  recentLogs: AgentLogDto[];
};

export type RealtimeEvent = {
  type: "agent_status" | "task_update" | "audit_log" | "task_completed" | "critical_error";
  message: string;
  payload: unknown;
  createdAt: string;
};
