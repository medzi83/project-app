-- AlterTable: Add new fields to WebDocumentation for general material requirements
ALTER TABLE "WebDocumentation" ADD COLUMN "materialNotesNeedsImages" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "materialNotesNeedsTexts" BOOLEAN;

-- CreateTable
CREATE TABLE "MaterialGeneralSubmission" (
    "id" TEXT NOT NULL,
    "webDocumentationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialGeneralSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialGeneralSubmission_webDocumentationId_key" ON "MaterialGeneralSubmission"("webDocumentationId");

-- AddForeignKey
ALTER TABLE "MaterialGeneralSubmission" ADD CONSTRAINT "MaterialGeneralSubmission_webDocumentationId_fkey" FOREIGN KEY ("webDocumentationId") REFERENCES "WebDocumentation"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
