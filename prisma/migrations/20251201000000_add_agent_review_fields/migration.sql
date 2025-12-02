-- Felder für Agenten-Review auf WebDocuMenuItem
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "imagesReviewedAt" TIMESTAMP(3);
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "imagesReviewedById" TEXT;
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "imagesReviewedByName" TEXT;
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "imagesComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "imagesAgentComment" TEXT;

-- Felder für Logo-Review auf WebDocumentation
ALTER TABLE "WebDocumentation" ADD COLUMN "logoImagesReviewedAt" TIMESTAMP(3);
ALTER TABLE "WebDocumentation" ADD COLUMN "logoImagesReviewedById" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "logoImagesReviewedByName" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "logoImagesComplete" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "logoImagesAgentComment" TEXT;

-- Felder für General/Sonstiges-Review auf WebDocumentation
ALTER TABLE "WebDocumentation" ADD COLUMN "generalImagesReviewedAt" TIMESTAMP(3);
ALTER TABLE "WebDocumentation" ADD COLUMN "generalImagesReviewedById" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "generalImagesReviewedByName" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "generalImagesComplete" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "generalImagesAgentComment" TEXT;
