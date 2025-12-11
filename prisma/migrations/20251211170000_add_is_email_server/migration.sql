-- AlterTable: Add isEmailServer to Server
-- Ein Server kann als reiner E-Mail-Server markiert werden.
-- Solche Server erscheinen nicht in der Server-Daten Tab bei Clients,
-- sondern nur in der E-Mail-Konten Sektion.

ALTER TABLE "Server" ADD COLUMN "isEmailServer" BOOLEAN NOT NULL DEFAULT false;
