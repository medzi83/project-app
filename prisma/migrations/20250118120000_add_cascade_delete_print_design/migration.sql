-- Add CASCADE delete to ProjectPrintDesign foreign key
-- This allows print design projects to be deleted without constraint violations

-- AlterTable: Drop existing foreign key constraint and recreate with CASCADE
ALTER TABLE "ProjectPrintDesign" DROP CONSTRAINT "ProjectPrintDesign_projectId_fkey";

ALTER TABLE "ProjectPrintDesign"
  ADD CONSTRAINT "ProjectPrintDesign_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "Project"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
