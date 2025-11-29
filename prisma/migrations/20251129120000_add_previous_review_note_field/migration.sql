-- Add previousReviewNote field to preserve the rejection reason for documentation
-- When a text is resubmitted after rejection, the old reviewNote is moved here before being reset

ALTER TABLE "public"."MaterialTextSubmission" ADD COLUMN "previousReviewNote" TEXT;

ALTER TABLE "public"."MaterialGeneralSubmission" ADD COLUMN "previousReviewNote" TEXT;
