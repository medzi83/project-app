-- Bewertungsfelder für MaterialTextSubmission hinzufügen
ALTER TABLE "MaterialTextSubmission" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "MaterialTextSubmission" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "MaterialTextSubmission" ADD COLUMN "reviewedByName" TEXT;
ALTER TABLE "MaterialTextSubmission" ADD COLUMN "suitable" BOOLEAN;
ALTER TABLE "MaterialTextSubmission" ADD COLUMN "reviewNote" TEXT;

-- Bewertungsfelder für MaterialGeneralSubmission hinzufügen
ALTER TABLE "MaterialGeneralSubmission" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "MaterialGeneralSubmission" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "MaterialGeneralSubmission" ADD COLUMN "reviewedByName" TEXT;
ALTER TABLE "MaterialGeneralSubmission" ADD COLUMN "suitable" BOOLEAN;
ALTER TABLE "MaterialGeneralSubmission" ADD COLUMN "reviewNote" TEXT;
