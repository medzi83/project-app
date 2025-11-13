-- CreateEnum
CREATE TYPE "public"."EmailTriggerType" AS ENUM ('DATE_FIELD_SET', 'DATE_REACHED', 'CONDITION_MET', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."DelayType" AS ENUM ('BEFORE', 'AFTER', 'EXACT');

-- CreateEnum
CREATE TYPE "public"."QueueStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."Agency" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."EmailSignature" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."EmailTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."MailServer" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."EmailTrigger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" "public"."EmailTriggerType" NOT NULL,
    "projectType" "public"."ProjectType",
    "conditions" JSONB NOT NULL,
    "delayDays" INTEGER,
    "delayType" "public"."DelayType",
    "templateId" TEXT NOT NULL,
    "recipientConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailQueue" (
    "id" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "public"."QueueStatus" NOT NULL DEFAULT 'PENDING',
    "toEmail" TEXT NOT NULL,
    "ccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mailServerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailLog" (
    "id" TEXT NOT NULL,
    "triggerId" TEXT,
    "projectId" TEXT,
    "toEmail" TEXT NOT NULL,
    "ccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "mailServerId" TEXT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTrigger_active_triggerType_idx" ON "public"."EmailTrigger"("active", "triggerType");

-- CreateIndex
CREATE INDEX "EmailTrigger_templateId_idx" ON "public"."EmailTrigger"("templateId");

-- CreateIndex
CREATE INDEX "EmailQueue_status_scheduledFor_idx" ON "public"."EmailQueue"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "EmailQueue_projectId_idx" ON "public"."EmailQueue"("projectId");

-- CreateIndex
CREATE INDEX "EmailQueue_triggerId_idx" ON "public"."EmailQueue"("triggerId");

-- CreateIndex
CREATE INDEX "EmailLog_sentAt_idx" ON "public"."EmailLog"("sentAt");

-- CreateIndex
CREATE INDEX "EmailLog_projectId_idx" ON "public"."EmailLog"("projectId");

-- CreateIndex
CREATE INDEX "EmailLog_triggerId_idx" ON "public"."EmailLog"("triggerId");

-- AddForeignKey
ALTER TABLE "public"."EmailTrigger" ADD CONSTRAINT "EmailTrigger_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailQueue" ADD CONSTRAINT "EmailQueue_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "public"."EmailTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailQueue" ADD CONSTRAINT "EmailQueue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailQueue" ADD CONSTRAINT "EmailQueue_mailServerId_fkey" FOREIGN KEY ("mailServerId") REFERENCES "public"."MailServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "public"."EmailTrigger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_mailServerId_fkey" FOREIGN KEY ("mailServerId") REFERENCES "public"."MailServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
