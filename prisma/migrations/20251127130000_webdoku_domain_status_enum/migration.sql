-- Migration: WebDocuDomainStatus Enum erstellen und Domain-Status-Optionen aktualisieren

-- Enum-Typ für Domain-Status erstellen
CREATE TYPE "WebDocuDomainStatus" AS ENUM ('NEW', 'EXISTS_STAYS', 'EXISTS_TRANSFER', 'AT_AGENCY');

-- domainStatus-Spalte von TEXT auf Enum umstellen
-- Erst die alte Spalte umbenennen, dann neue Spalte erstellen, Daten migrieren, alte löschen
ALTER TABLE "WebDocumentation" RENAME COLUMN "domainStatus" TO "domainStatus_old";
ALTER TABLE "WebDocumentation" ADD COLUMN "domainStatus" "WebDocuDomainStatus";

-- Alte Daten migrieren (falls vorhanden)
-- EXISTS -> EXISTS_STAYS (da es das Konzept "bleibt bei Kunden" am besten abbildet)
UPDATE "WebDocumentation" SET "domainStatus" = 'NEW'::"WebDocuDomainStatus" WHERE "domainStatus_old" = 'NEW';
UPDATE "WebDocumentation" SET "domainStatus" = 'EXISTS_STAYS'::"WebDocuDomainStatus" WHERE "domainStatus_old" = 'EXISTS';
UPDATE "WebDocumentation" SET "domainStatus" = 'AT_AGENCY'::"WebDocuDomainStatus" WHERE "domainStatus_old" = 'AT_AGENCY';

-- Alte Spalte entfernen
ALTER TABLE "WebDocumentation" DROP COLUMN "domainStatus_old";
