-- Migration: Schritt 4 - Design & Vorgaben für WebDocumentation

-- Enums für Schritt 4 erstellen
CREATE TYPE "WebDocuColorOrientation" AS ENUM ('LOGO', 'PRINT', 'CI_SHEET', 'WEBSITE');
CREATE TYPE "WebDocuWebsiteType" AS ENUM ('STANDARD', 'ONEPAGE');
CREATE TYPE "WebDocuStartArea" AS ENUM ('HEADER_VIDEO', 'SLIDER', 'HEADER_IMAGE');
CREATE TYPE "WebDocuMapIntegration" AS ENUM ('YES', 'MULTIPLE', 'NO');

-- Bereich Design
ALTER TABLE "WebDocumentation" ADD COLUMN "hasLogo" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "hasCIDefined" BOOLEAN;
ALTER TABLE "WebDocumentation" ADD COLUMN "colorOrientation" "WebDocuColorOrientation";
ALTER TABLE "WebDocumentation" ADD COLUMN "colorCodes" TEXT;

-- Bereich Umsetzungsvorgaben
ALTER TABLE "WebDocumentation" ADD COLUMN "topWebsite" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "flopWebsite" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "websiteType" "WebDocuWebsiteType";
ALTER TABLE "WebDocumentation" ADD COLUMN "styleTypes" TEXT[] DEFAULT '{}';
ALTER TABLE "WebDocumentation" ADD COLUMN "styleCustom" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "startArea" "WebDocuStartArea";
ALTER TABLE "WebDocumentation" ADD COLUMN "slogan" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "teaserSpecs" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "disruptorSpecs" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "otherSpecs" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "mapIntegration" "WebDocuMapIntegration";
