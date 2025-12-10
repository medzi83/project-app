-- AlterTable
ALTER TABLE "WebDocumentation" ADD COLUMN "domainRegisteredAt" TIMESTAMP(3),
ADD COLUMN "domainRegisteredById" TEXT,
ADD COLUMN "domainRegisteredByName" TEXT;
