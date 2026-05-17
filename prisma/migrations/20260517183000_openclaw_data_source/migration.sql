-- Add OpenClaw identity and data origin metadata.
ALTER TABLE "Agent"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "lastOpenClawSyncAt" TIMESTAMP(3),
ADD COLUMN "openClawEnabled" BOOLEAN;

ALTER TABLE "ArticleJob"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "dataSource" TEXT NOT NULL DEFAULT 'seed';

CREATE INDEX "Agent_externalId_idx" ON "Agent"("externalId");
CREATE INDEX "ArticleJob_dataSource_idx" ON "ArticleJob"("dataSource");
CREATE INDEX "ArticleJob_externalId_idx" ON "ArticleJob"("externalId");
