-- Migration: Kundenbestätigung für WebDocumentation
-- Felder um zu tracken, wann und von wem (welche AuthorizedPerson) die Webdoku bestätigt wurde

ALTER TABLE "WebDocumentation" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "WebDocumentation" ADD COLUMN "confirmedByPersonId" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "confirmedByName" TEXT;
