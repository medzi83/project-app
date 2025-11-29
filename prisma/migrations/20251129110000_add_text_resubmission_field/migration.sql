-- Add isResubmission field to track if a text was resubmitted after rejection
-- This allows showing "Erneut eingereicht am" instead of "Eingereicht am" in the UI

ALTER TABLE "public"."MaterialTextSubmission" ADD COLUMN "isResubmission" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."MaterialGeneralSubmission" ADD COLUMN "isResubmission" BOOLEAN NOT NULL DEFAULT false;
