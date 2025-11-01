-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."EmailTemplateCategory" AS ENUM ('GENERAL', 'WEBSITE', 'FILM', 'SOCIAL_MEDIA');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'AGENT', 'CUSTOMER', 'SALES');

-- CreateEnum
CREATE TYPE "public"."ProjectType" AS ENUM ('WEBSITE', 'FILM', 'SOCIAL');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('WEBTERMIN', 'MATERIAL', 'UMSETZUNG', 'DEMO', 'ONLINE');

-- CreateEnum
CREATE TYPE "public"."WebsitePriority" AS ENUM ('NONE', 'PRIO_1', 'PRIO_2', 'PRIO_3');

-- CreateEnum
CREATE TYPE "public"."FilmScope" AS ENUM ('FILM', 'DROHNE', 'NACHDREH', 'FILM_UND_DROHNE', 'FOTO', 'GRAD_360', 'K_A');

-- CreateEnum
CREATE TYPE "public"."FilmPriority" AS ENUM ('NONE', 'FILM_SOLO', 'PRIO_1', 'PRIO_2');

-- CreateEnum
CREATE TYPE "public"."FilmProjectStatus" AS ENUM ('AKTIV', 'BEENDET', 'WARTEN', 'VERZICHT', 'MMW');

-- CreateEnum
CREATE TYPE "public"."CMS" AS ENUM ('SHOPWARE', 'WORDPRESS', 'JOOMLA', 'LOGO', 'PRINT', 'CUSTOM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ProductionStatus" AS ENUM ('NONE', 'BEENDET', 'MMW', 'VOLLST_A_K');

-- CreateEnum
CREATE TYPE "public"."SEOStatus" AS ENUM ('NEIN', 'NEIN_NEIN', 'JA_NEIN', 'JA_JA');

-- CreateEnum
CREATE TYPE "public"."TextitStatus" AS ENUM ('NEIN', 'NEIN_NEIN', 'JA_NEIN', 'JA_JA');

-- CreateEnum
CREATE TYPE "public"."MaterialStatus" AS ENUM ('ANGEFORDERT', 'TEILWEISE', 'VOLLSTAENDIG', 'NV');

-- CreateEnum
CREATE TYPE "public"."WebterminType" AS ENUM ('TELEFONISCH', 'BEIM_KUNDEN', 'IN_DER_AGENTUR');

-- CreateEnum
CREATE TYPE "public"."AgentCategory" AS ENUM ('WEBSEITE', 'FILM', 'SOCIALMEDIA');

-- CreateEnum
CREATE TYPE "public"."EmailTriggerType" AS ENUM ('DATE_FIELD_SET', 'DATE_REACHED', 'CONDITION_MET', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."DelayType" AS ENUM ('BEFORE', 'AFTER', 'EXACT');

-- CreateEnum
CREATE TYPE "public"."QueueStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED', 'PENDING_CONFIRMATION');

-- CreateEnum
CREATE TYPE "public"."NoticeVisibility" AS ENUM ('GLOBAL', 'TARGETED');

-- CreateEnum
CREATE TYPE "public"."FeedbackType" AS ENUM ('BUG', 'SUGGESTION', 'IMPROVEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FeedbackStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'CUSTOMER',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "categories" "public"."AgentCategory"[],
    "fullName" TEXT,
    "roleTitle" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectsSort" TEXT,
    "projectsSortDir" TEXT,
    "filmProjectsSort" TEXT,
    "filmProjectsSortDir" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filmProjectsAgentFilter" JSONB,
    "filmProjectsPStatusFilter" JSONB,
    "filmProjectsScopeFilter" JSONB,
    "filmProjectsStatusFilter" JSONB,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerNo" TEXT,
    "serverId" TEXT,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "workStopped" BOOLEAN NOT NULL DEFAULT false,
    "agencyId" TEXT,
    "email" TEXT,
    "firstname" TEXT,
    "lastname" TEXT,
    "salutation" TEXT,
    "uploadLinks" JSONB,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "logoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "logoIconPath" TEXT,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "type" "public"."ProjectType" NOT NULL DEFAULT 'WEBSITE',
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'WEBTERMIN',
    "important" TEXT,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectWebsite" (
    "projectId" TEXT NOT NULL,
    "domain" TEXT,
    "priority" "public"."WebsitePriority" NOT NULL DEFAULT 'NONE',
    "pStatus" "public"."ProductionStatus" NOT NULL DEFAULT 'NONE',
    "cms" "public"."CMS" NOT NULL DEFAULT 'JOOMLA',
    "cmsOther" TEXT,
    "webDate" TIMESTAMP(3),
    "demoDate" TIMESTAMP(3),
    "onlineDate" TIMESTAMP(3),
    "lastMaterialAt" TIMESTAMP(3),
    "effortBuildMin" INTEGER,
    "effortDemoMin" INTEGER,
    "seo" "public"."SEOStatus" NOT NULL DEFAULT 'NEIN',
    "textit" "public"."TextitStatus" NOT NULL DEFAULT 'NEIN',
    "accessible" BOOLEAN,
    "note" TEXT,
    "demoLink" TEXT,
    "materialStatus" "public"."MaterialStatus" NOT NULL DEFAULT 'ANGEFORDERT',
    "isWTAssignment" BOOLEAN NOT NULL DEFAULT false,
    "webterminType" "public"."WebterminType",
    "isRelaunch" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectWebsite_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "public"."ProjectDomainHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDomainHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectFilm" (
    "projectId" TEXT NOT NULL,
    "scope" "public"."FilmScope",
    "priority" "public"."FilmPriority" NOT NULL DEFAULT 'NONE',
    "filmerId" TEXT,
    "cutterId" TEXT,
    "contractStart" TIMESTAMP(3),
    "scouting" TIMESTAMP(3),
    "scriptToClient" TIMESTAMP(3),
    "scriptApproved" TIMESTAMP(3),
    "shootDate" TIMESTAMP(3),
    "firstCutToClient" TIMESTAMP(3),
    "finalToClient" TIMESTAMP(3),
    "onlineDate" TIMESTAMP(3),
    "lastContact" TIMESTAMP(3),
    "status" "public"."FilmProjectStatus" NOT NULL DEFAULT 'AKTIV',
    "reminderAt" TIMESTAMP(3),
    "note" TEXT,
    "finalLink" TEXT,
    "onlineLink" TEXT,

    CONSTRAINT "ProjectFilm_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "public"."FilmPreviewVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "link" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FilmPreviewVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "froxlorUrl" TEXT,
    "mysqlUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "froxlorApiKey" TEXT,
    "froxlorApiSecret" TEXT,
    "hostname" TEXT,
    "sshHost" TEXT,
    "sshPassword" TEXT,
    "sshPort" INTEGER DEFAULT 22,
    "sshUsername" TEXT,
    "froxlorVersion" TEXT DEFAULT '2.0+',

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DatabaseServer" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER DEFAULT 3306,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MailServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "username" TEXT,
    "password" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "useTls" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "public"."EmailTemplateCategory" NOT NULL DEFAULT 'GENERAL',

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailSignature" (
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agencyId" TEXT,

    CONSTRAINT "EmailSignature_pkey" PRIMARY KEY ("key")
);

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
    "clientId" TEXT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "visibility" "public"."NoticeVisibility" NOT NULL DEFAULT 'GLOBAL',
    "requireAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NoticeRecipient" (
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("noticeId","userId")
);

-- CreateTable
CREATE TABLE "public"."NoticeAcknowledgement" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "public"."FeedbackType" NOT NULL DEFAULT 'SUGGESTION',
    "status" "public"."FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "viewedByAuthor" BOOLEAN NOT NULL DEFAULT false,
    "adminResponse" TEXT,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JoomlaInstallation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "installPath" TEXT NOT NULL,
    "installUrl" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databasePassword" TEXT NOT NULL,
    "standardDomain" TEXT NOT NULL,
    "filesExtracted" INTEGER,
    "bytesProcessed" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "projectAssignmentDismissed" BOOLEAN NOT NULL DEFAULT false,
    "databaseServerId" TEXT,
    "databaseHost" TEXT,
    "databasePort" INTEGER,

    CONSTRAINT "JoomlaInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "public"."User"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "public"."UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_customerNo_key" ON "public"."Client"("customerNo");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "public"."Client"("name");

-- CreateIndex
CREATE INDEX "Client_agencyId_idx" ON "public"."Client"("agencyId");

-- CreateIndex
CREATE INDEX "Client_serverId_idx" ON "public"."Client"("serverId");

-- CreateIndex
CREATE INDEX "Project_clientId_status_idx" ON "public"."Project"("clientId", "status");

-- CreateIndex
CREATE INDEX "Project_agentId_idx" ON "public"."Project"("agentId");

-- CreateIndex
CREATE INDEX "ProjectDomainHistory_projectId_idx" ON "public"."ProjectDomainHistory"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDomainHistory_domain_idx" ON "public"."ProjectDomainHistory"("domain");

-- CreateIndex
CREATE INDEX "ProjectFilm_status_idx" ON "public"."ProjectFilm"("status");

-- CreateIndex
CREATE INDEX "ProjectFilm_filmerId_idx" ON "public"."ProjectFilm"("filmerId");

-- CreateIndex
CREATE INDEX "ProjectFilm_cutterId_idx" ON "public"."ProjectFilm"("cutterId");

-- CreateIndex
CREATE INDEX "ProjectFilm_reminderAt_idx" ON "public"."ProjectFilm"("reminderAt");

-- CreateIndex
CREATE INDEX "FilmPreviewVersion_projectId_sentDate_idx" ON "public"."FilmPreviewVersion"("projectId", "sentDate");

-- CreateIndex
CREATE UNIQUE INDEX "FilmPreviewVersion_projectId_version_key" ON "public"."FilmPreviewVersion"("projectId", "version");

-- CreateIndex
CREATE INDEX "ProjectNote_projectId_createdAt_idx" ON "public"."ProjectNote"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "DatabaseServer_serverId_idx" ON "public"."DatabaseServer"("serverId");

-- CreateIndex
CREATE INDEX "MailServer_agencyId_idx" ON "public"."MailServer"("agencyId");

-- CreateIndex
CREATE INDEX "MailServer_name_idx" ON "public"."MailServer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_title_key" ON "public"."EmailTemplate"("title");

-- CreateIndex
CREATE INDEX "EmailTemplate_createdAt_idx" ON "public"."EmailTemplate"("createdAt");

-- CreateIndex
CREATE INDEX "EmailTemplate_category_idx" ON "public"."EmailTemplate"("category");

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

-- CreateIndex
CREATE INDEX "EmailLog_clientId_idx" ON "public"."EmailLog"("clientId");

-- CreateIndex
CREATE INDEX "Notice_isActive_visibility_idx" ON "public"."Notice"("isActive", "visibility");

-- CreateIndex
CREATE INDEX "Notice_createdById_idx" ON "public"."Notice"("createdById");

-- CreateIndex
CREATE INDEX "NoticeRecipient_userId_idx" ON "public"."NoticeRecipient"("userId");

-- CreateIndex
CREATE INDEX "NoticeAcknowledgement_userId_idx" ON "public"."NoticeAcknowledgement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeAcknowledgement_noticeId_userId_key" ON "public"."NoticeAcknowledgement"("noticeId", "userId");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "public"."Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_authorId_idx" ON "public"."Feedback"("authorId");

-- CreateIndex
CREATE INDEX "Feedback_authorId_viewedByAuthor_idx" ON "public"."Feedback"("authorId", "viewedByAuthor");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_clientId_idx" ON "public"."JoomlaInstallation"("clientId");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_serverId_idx" ON "public"."JoomlaInstallation"("serverId");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_projectId_idx" ON "public"."JoomlaInstallation"("projectId");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_customerNo_idx" ON "public"."JoomlaInstallation"("customerNo");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_createdAt_idx" ON "public"."JoomlaInstallation"("createdAt");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_projectAssignmentDismissed_idx" ON "public"."JoomlaInstallation"("projectAssignmentDismissed");

-- CreateIndex
CREATE INDEX "JoomlaInstallation_databaseServerId_idx" ON "public"."JoomlaInstallation"("databaseServerId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "public"."Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "public"."Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectWebsite" ADD CONSTRAINT "ProjectWebsite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectDomainHistory" ADD CONSTRAINT "ProjectDomainHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."ProjectWebsite"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectFilm" ADD CONSTRAINT "ProjectFilm_cutterId_fkey" FOREIGN KEY ("cutterId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectFilm" ADD CONSTRAINT "ProjectFilm_filmerId_fkey" FOREIGN KEY ("filmerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectFilm" ADD CONSTRAINT "ProjectFilm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FilmPreviewVersion" ADD CONSTRAINT "FilmPreviewVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."ProjectFilm"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectNote" ADD CONSTRAINT "ProjectNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DatabaseServer" ADD CONSTRAINT "DatabaseServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "public"."Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MailServer" ADD CONSTRAINT "MailServer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "public"."Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailSignature" ADD CONSTRAINT "EmailSignature_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "public"."Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailTrigger" ADD CONSTRAINT "EmailTrigger_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailQueue" ADD CONSTRAINT "EmailQueue_mailServerId_fkey" FOREIGN KEY ("mailServerId") REFERENCES "public"."MailServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailQueue" ADD CONSTRAINT "EmailQueue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailQueue" ADD CONSTRAINT "EmailQueue_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "public"."EmailTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_mailServerId_fkey" FOREIGN KEY ("mailServerId") REFERENCES "public"."MailServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "public"."EmailTrigger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "public"."Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "public"."Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_databaseServerId_fkey" FOREIGN KEY ("databaseServerId") REFERENCES "public"."DatabaseServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoomlaInstallation" ADD CONSTRAINT "JoomlaInstallation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "public"."Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

