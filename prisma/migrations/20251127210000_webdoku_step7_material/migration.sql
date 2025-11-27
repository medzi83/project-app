-- Migration: Schritt 7 - Material für WebDocumentation

-- Neue Spalten für Schritt 7 in WebDocumentation hinzufügen
ALTER TABLE "WebDocumentation" ADD COLUMN "materialLogoNeeded" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "materialAuthcodeNeeded" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "materialNotes" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "materialDeadline" TIMESTAMP(3);

-- Neue Spalten für Material-Checkboxen pro Menüpunkt
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "needsImages" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebDocuMenuItem" ADD COLUMN "needsTexts" BOOLEAN NOT NULL DEFAULT false;
