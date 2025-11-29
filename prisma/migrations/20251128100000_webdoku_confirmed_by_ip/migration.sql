-- Migration: IP-Adresse bei Kundenbestätigung der WebDocumentation speichern
-- Dieses Feld speichert die IP-Adresse des Kunden, der die Webdokumentation bestätigt hat

ALTER TABLE "WebDocumentation" ADD COLUMN "confirmedByIp" TEXT;
