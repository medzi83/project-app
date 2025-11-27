-- Migration: Kundenfreigabe für WebDocumentation
-- Felder um zu tracken, wann und von wem die Webdoku für den Kunden freigegeben wurde

ALTER TABLE "WebDocumentation" ADD COLUMN "releasedAt" TIMESTAMP(3);
ALTER TABLE "WebDocumentation" ADD COLUMN "releasedByUserId" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "releasedByName" TEXT;
