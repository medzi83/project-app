-- AlterTable
ALTER TABLE "WebDocumentation" ADD COLUMN "dnsConfirmedAt" TIMESTAMP(3),
ADD COLUMN "dnsConfirmedById" TEXT,
ADD COLUMN "dnsConfirmedByName" TEXT;
