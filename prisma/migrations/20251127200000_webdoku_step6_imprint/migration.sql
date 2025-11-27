-- Migration: Schritt 6 - Impressum & Datenschutz für WebDocumentation

-- Enum für Registerart erstellen
CREATE TYPE "WebDocuRegisterType" AS ENUM (
    'HANDELSREGISTER',
    'CUSTOM'
);

-- Enum für AGB-Status erstellen
CREATE TYPE "WebDocuTermsStatus" AS ENUM (
    'AVAILABLE',
    'NOT_AVAILABLE',
    'NOT_NECESSARY'
);

-- Neue Spalten für Schritt 6 hinzufügen
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintFromWebsite" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintAddress" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintLegalForm" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintOwner" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintCeo" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintPhone" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintFax" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintEmail" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintRegisterType" "WebDocuRegisterType";
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintRegisterCustom" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintRegisterLocation" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintRegisterNumber" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintChamber" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintProfession" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintCountry" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintVatId" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintTermsStatus" "WebDocuTermsStatus";
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintPrivacyOfficer" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "imprintHasPrivacyOfficer" BOOLEAN;
