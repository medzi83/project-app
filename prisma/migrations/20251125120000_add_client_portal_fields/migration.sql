-- AlterTable: Add portal fields to Client table
ALTER TABLE "Client"
ADD COLUMN "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "portalPasswordHash" TEXT,
ADD COLUMN "portalLastLogin" TIMESTAMP(3),
ADD COLUMN "portalInvitedAt" TIMESTAMP(3);
