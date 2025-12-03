-- AlterTable: Add rejection fields to WebDocumentation
ALTER TABLE "WebDocumentation" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "WebDocumentation" ADD COLUMN "rejectedByName" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "rejectedByIp" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "rejectedSteps" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
