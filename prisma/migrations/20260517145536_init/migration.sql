-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('online', 'idle', 'busy', 'paused', 'offline', 'error');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('new', 'researching', 'relevance_scoring', 'clustering', 'validating', 'writing', 'seo_optimizing', 'affiliate_routing', 'copywriting', 'editing', 'compliance_checking', 'publishing', 'drafted', 'published', 'human_review', 'discarded', 'failed');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "LogSeverity" AS ENUM ('info', 'warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'returned_to_writer', 'returned_to_validator');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('job_created', 'relevance_scored', 'validation_completed', 'article_written', 'seo_completed', 'affiliate_decided', 'compliance_completed', 'wordpress_payload_created', 'published', 'drafted', 'failed', 'human_review_requested', 'prompt_injection_detected', 'task_status_changed', 'task_retried', 'task_cancelled', 'task_assigned', 'priority_changed', 'agent_paused', 'agent_resumed', 'agent_heartbeat', 'review_approved', 'review_rejected', 'returned_to_writer', 'returned_to_validator', 'webhook_received', 'errors_cleared', 'agent_restarted');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'idle',
    "currentTaskId" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "totalTasksProcessed" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "averageProcessingTimeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleJob" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "clusterId" TEXT,
    "currentStage" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'new',
    "priority" "JobPriority" NOT NULL DEFAULT 'normal',
    "assignedAgentId" TEXT,
    "relevanceScore" INTEGER,
    "validationScore" INTEGER,
    "editorialScore" INTEGER,
    "seoScore" INTEGER,
    "complianceScore" INTEGER,
    "monetizationScore" INTEGER,
    "hasAffiliate" BOOLEAN NOT NULL DEFAULT false,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "wordpressPostId" TEXT,
    "wordpressPreviewUrl" TEXT,
    "errorMessage" TEXT,
    "articleMarkdown" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "agentId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "severity" "LogSeverity" NOT NULL DEFAULT 'info',
    "stage" TEXT,
    "decision" TEXT,
    "score" INTEGER,
    "message" TEXT NOT NULL,
    "inputPayload" JSONB,
    "outputPayload" JSONB,
    "errorPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayloadSnapshot" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "agentId" TEXT,
    "inputPayload" JSONB NOT NULL,
    "outputPayload" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayloadSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "reliabilityScore" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanReview" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "reviewerComment" TEXT,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HumanReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_slug_idx" ON "Agent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleJob_jobId_key" ON "ArticleJob"("jobId");

-- CreateIndex
CREATE INDEX "ArticleJob_status_idx" ON "ArticleJob"("status");

-- CreateIndex
CREATE INDEX "ArticleJob_priority_idx" ON "ArticleJob"("priority");

-- CreateIndex
CREATE INDEX "ArticleJob_assignedAgentId_idx" ON "ArticleJob"("assignedAgentId");

-- CreateIndex
CREATE INDEX "ArticleJob_createdAt_idx" ON "ArticleJob"("createdAt");

-- CreateIndex
CREATE INDEX "AgentLog_jobId_idx" ON "AgentLog"("jobId");

-- CreateIndex
CREATE INDEX "AgentLog_agentId_idx" ON "AgentLog"("agentId");

-- CreateIndex
CREATE INDEX "AgentLog_eventType_idx" ON "AgentLog"("eventType");

-- CreateIndex
CREATE INDEX "AgentLog_severity_idx" ON "AgentLog"("severity");

-- CreateIndex
CREATE INDEX "AgentLog_createdAt_idx" ON "AgentLog"("createdAt");

-- CreateIndex
CREATE INDEX "PayloadSnapshot_jobId_idx" ON "PayloadSnapshot"("jobId");

-- CreateIndex
CREATE INDEX "PayloadSnapshot_stage_idx" ON "PayloadSnapshot"("stage");

-- CreateIndex
CREATE INDEX "PayloadSnapshot_agentId_idx" ON "PayloadSnapshot"("agentId");

-- CreateIndex
CREATE INDEX "Source_jobId_idx" ON "Source"("jobId");

-- CreateIndex
CREATE INDEX "Source_role_idx" ON "Source"("role");

-- CreateIndex
CREATE INDEX "HumanReview_jobId_idx" ON "HumanReview"("jobId");

-- CreateIndex
CREATE INDEX "HumanReview_status_idx" ON "HumanReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "ArticleJob" ADD CONSTRAINT "ArticleJob_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ArticleJob"("jobId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayloadSnapshot" ADD CONSTRAINT "PayloadSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ArticleJob"("jobId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayloadSnapshot" ADD CONSTRAINT "PayloadSnapshot_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ArticleJob"("jobId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ArticleJob"("jobId") ON DELETE CASCADE ON UPDATE CASCADE;
