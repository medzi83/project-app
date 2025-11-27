-- Migration: Notes-Feld für WebDocuMenuItem hinzufügen

-- Spalte für Notizen hinzufügen
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "notes" TEXT;
