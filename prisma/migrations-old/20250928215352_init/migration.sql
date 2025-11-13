-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'AGENT', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "public"."ProjectType" AS ENUM ('WEBSITE', 'FILM', 'SOCIAL');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('WEBTERMIN', 'MATERIAL', 'UMSETZUNG', 'DEMO', 'ONLINE');

-- CreateEnum
CREATE TYPE "public"."WebsitePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."CMS" AS ENUM ('SHOPWARE', 'WORDPRESS', 'TYPO3', 'JOOMLA', 'WEBFLOW', 'WIX', 'CUSTOM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ProductionStatus" AS ENUM ('NONE', 'TODO', 'IN_PROGRESS', 'WITH_CUSTOMER', 'BLOCKED', 'READY_FOR_LAUNCH', 'DONE');

-- CreateEnum
CREATE TYPE "public"."SEOStatus" AS ENUM ('NONE', 'QUESTIONNAIRE', 'ANALYSIS', 'DONE');

-- CreateEnum
CREATE TYPE "public"."TextitStatus" AS ENUM ('NONE', 'SENT_OUT', 'DONE');

-- CreateEnum
CREATE TYPE "public"."MaterialStatus" AS ENUM ('ANGEFORDERT', 'TEILWEISE', 'VOLLSTAENDIG', 'NV');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'CUSTOMER',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerNo" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
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
    "priority" "public"."WebsitePriority" NOT NULL DEFAULT 'NORMAL',
    "pStatus" "public"."ProductionStatus" NOT NULL DEFAULT 'NONE',
    "cms" "public"."CMS" NOT NULL DEFAULT 'SHOPWARE',
    "cmsOther" TEXT,
    "webDate" TIMESTAMP(3),
    "demoDate" TIMESTAMP(3),
    "onlineDate" TIMESTAMP(3),
    "lastMaterialAt" TIMESTAMP(3),
    "effortBuildMin" INTEGER,
    "effortDemoMin" INTEGER,
    "seo" "public"."SEOStatus" NOT NULL DEFAULT 'NONE',
    "textit" "public"."TextitStatus" NOT NULL DEFAULT 'NONE',
    "accessible" BOOLEAN,
    "note" TEXT,
    "demoLink" TEXT,
    "materialStatus" "public"."MaterialStatus" NOT NULL DEFAULT 'ANGEFORDERT',

    CONSTRAINT "ProjectWebsite_pkey" PRIMARY KEY ("projectId")
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

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "public"."User"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_customerNo_key" ON "public"."Client"("customerNo");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "public"."Client"("name");

-- CreateIndex
CREATE INDEX "Project_clientId_status_idx" ON "public"."Project"("clientId", "status");

-- CreateIndex
CREATE INDEX "Project_agentId_idx" ON "public"."Project"("agentId");

-- CreateIndex
CREATE INDEX "ProjectNote_projectId_createdAt_idx" ON "public"."ProjectNote"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectWebsite" ADD CONSTRAINT "ProjectWebsite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectNote" ADD CONSTRAINT "ProjectNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
