/*
  Warnings:

  - A unique constraint covering the columns `[customerNo]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
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

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "customerNo" TEXT;

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
    "materialAvailable" BOOLEAN,
    "seo" "public"."SEOStatus" NOT NULL DEFAULT 'NONE',
    "textit" "public"."TextitStatus" NOT NULL DEFAULT 'NONE',
    "accessible" BOOLEAN,
    "note" TEXT,
    "demoLink" TEXT,

    CONSTRAINT "ProjectWebsite_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_customerNo_key" ON "public"."Client"("customerNo");

-- AddForeignKey
ALTER TABLE "public"."ProjectWebsite" ADD CONSTRAINT "ProjectWebsite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
