-- AlterTable: Add internalNote field to WebDocumentation
ALTER TABLE "WebDocumentation" ADD COLUMN "internalNote" TEXT;

-- CreateTable: WebDocuFeedback for customer feedback on Webdokumentation
CREATE TABLE "WebDocuFeedback" (
    "id" TEXT NOT NULL,
    "webDocumentationId" TEXT NOT NULL,
    "generalComment" TEXT,
    "focusComment" TEXT,
    "structureComment" TEXT,
    "designComment" TEXT,
    "formsComment" TEXT,
    "focusAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "structureAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "designAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "formsAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByName" TEXT,

    CONSTRAINT "WebDocuFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on webDocumentationId (only one feedback per Webdoku)
CREATE UNIQUE INDEX "WebDocuFeedback_webDocumentationId_key" ON "WebDocuFeedback"("webDocumentationId");

-- AddForeignKey
ALTER TABLE "WebDocuFeedback" ADD CONSTRAINT "WebDocuFeedback_webDocumentationId_fkey" FOREIGN KEY ("webDocumentationId") REFERENCES "WebDocumentation"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
