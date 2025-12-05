-- Demo-Freigabe durch Kunden
-- Speichert Zeitpunkt, Name und IP des Kunden der die Demo freigegeben hat

ALTER TABLE "ProjectWebsite" ADD COLUMN "demoApprovedAt" TIMESTAMP(3);
ALTER TABLE "ProjectWebsite" ADD COLUMN "demoApprovedByName" TEXT;
ALTER TABLE "ProjectWebsite" ADD COLUMN "demoApprovedByIp" TEXT;
