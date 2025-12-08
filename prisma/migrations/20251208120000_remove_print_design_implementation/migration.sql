-- Remove implementation column from ProjectPrintDesign table
-- This field is no longer needed as the "Umsetzung" status is now derived from webtermin being in the past

ALTER TABLE "ProjectPrintDesign" DROP COLUMN IF EXISTS "implementation";
