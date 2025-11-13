/*
  Warnings:

  - The values [TYPO3,WEBFLOW,WIX] on the enum `CMS` will be removed. If these variants are still used in the database, this will fail.
  - The values [TODO,IN_PROGRESS,WITH_CUSTOMER,BLOCKED,READY_FOR_LAUNCH,DONE] on the enum `ProductionStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [NONE,QUESTIONNAIRE,ANALYSIS,DONE] on the enum `SEOStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [NONE,SENT_OUT,DONE] on the enum `TextitStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [LOW,NORMAL,HIGH,CRITICAL] on the enum `WebsitePriority` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."CMS_new" AS ENUM ('SHOPWARE', 'WORDPRESS', 'JOOMLA', 'LOGO', 'PRINT', 'CUSTOM', 'OTHER');
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "cms" DROP DEFAULT;
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "cms" TYPE "public"."CMS_new" USING ("cms"::text::"public"."CMS_new");
ALTER TYPE "public"."CMS" RENAME TO "CMS_old";
ALTER TYPE "public"."CMS_new" RENAME TO "CMS";
DROP TYPE "public"."CMS_old";
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "cms" SET DEFAULT 'JOOMLA';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ProductionStatus_new" AS ENUM ('NONE', 'BEENDET', 'MMW', 'VOLLST_A_K');
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "pStatus" DROP DEFAULT;
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "pStatus" TYPE "public"."ProductionStatus_new" USING ("pStatus"::text::"public"."ProductionStatus_new");
ALTER TYPE "public"."ProductionStatus" RENAME TO "ProductionStatus_old";
ALTER TYPE "public"."ProductionStatus_new" RENAME TO "ProductionStatus";
DROP TYPE "public"."ProductionStatus_old";
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "pStatus" SET DEFAULT 'NONE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."SEOStatus_new" AS ENUM ('NEIN', 'NEIN_NEIN', 'JA_NEIN', 'JA_JA');
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "seo" DROP DEFAULT;
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "seo" TYPE "public"."SEOStatus_new" USING ("seo"::text::"public"."SEOStatus_new");
ALTER TYPE "public"."SEOStatus" RENAME TO "SEOStatus_old";
ALTER TYPE "public"."SEOStatus_new" RENAME TO "SEOStatus";
DROP TYPE "public"."SEOStatus_old";
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "seo" SET DEFAULT 'NEIN';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TextitStatus_new" AS ENUM ('NEIN', 'NEIN_NEIN', 'JA_NEIN', 'JA_JA');
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "textit" DROP DEFAULT;
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "textit" TYPE "public"."TextitStatus_new" USING ("textit"::text::"public"."TextitStatus_new");
ALTER TYPE "public"."TextitStatus" RENAME TO "TextitStatus_old";
ALTER TYPE "public"."TextitStatus_new" RENAME TO "TextitStatus";
DROP TYPE "public"."TextitStatus_old";
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "textit" SET DEFAULT 'NEIN';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."WebsitePriority_new" AS ENUM ('NONE', 'PRIO_1', 'PRIO_2', 'PRIO_3');
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "priority" TYPE "public"."WebsitePriority_new" USING ("priority"::text::"public"."WebsitePriority_new");
ALTER TYPE "public"."WebsitePriority" RENAME TO "WebsitePriority_old";
ALTER TYPE "public"."WebsitePriority_new" RENAME TO "WebsitePriority";
DROP TYPE "public"."WebsitePriority_old";
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "priority" SET DEFAULT 'NONE';
COMMIT;

-- AlterTable
ALTER TABLE "public"."ProjectWebsite" ALTER COLUMN "priority" SET DEFAULT 'NONE',
ALTER COLUMN "cms" SET DEFAULT 'JOOMLA',
ALTER COLUMN "seo" SET DEFAULT 'NEIN',
ALTER COLUMN "textit" SET DEFAULT 'NEIN';
