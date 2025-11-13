-- AlterTable
ALTER TABLE "public"."UserPreferences" ADD COLUMN     "filmProjectsAgentFilter" JSONB,
ADD COLUMN     "filmProjectsPStatusFilter" JSONB,
ADD COLUMN     "filmProjectsScopeFilter" JSONB,
ADD COLUMN     "filmProjectsStatusFilter" JSONB;
