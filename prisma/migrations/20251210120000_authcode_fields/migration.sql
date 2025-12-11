-- AlterTable
ALTER TABLE "WebDocumentation" ADD COLUMN "authcode" TEXT,
ADD COLUMN "authcodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "authcodeNeverExpires" BOOLEAN,
ADD COLUMN "authcodeSubmittedAt" TIMESTAMP(3),
ADD COLUMN "authcodeSubmittedById" TEXT,
ADD COLUMN "authcodeSubmittedByName" TEXT;
