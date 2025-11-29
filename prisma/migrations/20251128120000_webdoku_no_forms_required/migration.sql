-- AlterTable: Add noFormsRequired field to WebDocumentation (Schritt 5)
ALTER TABLE "WebDocumentation" ADD COLUMN "noFormsRequired" BOOLEAN NOT NULL DEFAULT false;
