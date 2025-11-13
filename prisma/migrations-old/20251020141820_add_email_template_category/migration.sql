-- CreateEnum
CREATE TYPE "public"."EmailTemplateCategory" AS ENUM ('GENERAL', 'WEBSITE', 'FILM', 'SOCIAL_MEDIA');

-- AlterTable
ALTER TABLE "public"."EmailTemplate" ADD COLUMN     "category" "public"."EmailTemplateCategory" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "EmailTemplate_category_idx" ON "public"."EmailTemplate"("category");
