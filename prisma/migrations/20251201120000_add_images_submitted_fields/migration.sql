-- Migration: add_images_submitted_fields
-- Fügt Felder für "Bilder vollständig" Status pro Menüpunkt und für allgemeines Material hinzu

-- Bilder-Status für WebDocuMenuItem (pro Menüpunkt)
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "imagesSubmittedAt" TIMESTAMP(3);
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "imagesSubmittedByName" TEXT;

-- Bilder-Status für WebDocumentation (Logo und Sonstiges/Allgemeines Material)
ALTER TABLE "WebDocumentation" ADD COLUMN "logoImagesSubmittedAt" TIMESTAMP(3);
ALTER TABLE "WebDocumentation" ADD COLUMN "logoImagesSubmittedByName" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "generalImagesSubmittedAt" TIMESTAMP(3);
ALTER TABLE "WebDocumentation" ADD COLUMN "generalImagesSubmittedByName" TEXT;
