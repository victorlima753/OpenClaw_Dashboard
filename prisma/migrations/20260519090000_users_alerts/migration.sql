CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'viewer');

CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

CREATE TYPE "AlertStatus" AS ENUM ('active', 'acknowledged', 'resolved');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "LogSeverity" NOT NULL DEFAULT 'warning',
    "status" "AlertStatus" NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "relatedJobId" TEXT,
    "relatedAgentId" TEXT,
    "metadata" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");

CREATE UNIQUE INDEX "SystemAlert_dedupeKey_key" ON "SystemAlert"("dedupeKey");
CREATE INDEX "SystemAlert_status_idx" ON "SystemAlert"("status");
CREATE INDEX "SystemAlert_severity_idx" ON "SystemAlert"("severity");
CREATE INDEX "SystemAlert_source_idx" ON "SystemAlert"("source");
CREATE INDEX "SystemAlert_createdAt_idx" ON "SystemAlert"("createdAt");
