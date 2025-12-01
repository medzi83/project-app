-- LuckyCloud-Zuordnung für Kunden
-- Ermöglicht die Zuordnung einer Seafile-Library und eines Ordners zu einem Kunden

ALTER TABLE "Client" ADD COLUMN "luckyCloudLibraryId" TEXT;
ALTER TABLE "Client" ADD COLUMN "luckyCloudLibraryName" TEXT;
ALTER TABLE "Client" ADD COLUMN "luckyCloudFolderPath" TEXT;
