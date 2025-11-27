-- Migration: WebDocuStartArea Enum-Wert von HEADER zu HEADER_VIDEO ändern

-- Neuen Enum-Typ mit korrektem Wert erstellen
CREATE TYPE "WebDocuStartArea_new" AS ENUM ('HEADER_VIDEO', 'SLIDER', 'HEADER_IMAGE');

-- Spalte auf neuen Typ umstellen (mit Konvertierung alter Werte)
ALTER TABLE "WebDocumentation"
ALTER COLUMN "startArea" TYPE "WebDocuStartArea_new"
USING (
    CASE "startArea"::TEXT
        WHEN 'HEADER' THEN 'HEADER_VIDEO'::TEXT
        ELSE "startArea"::TEXT
    END
)::"WebDocuStartArea_new";

-- Alten Enum-Typ löschen
DROP TYPE "WebDocuStartArea";

-- Neuen Enum-Typ umbenennen
ALTER TYPE "WebDocuStartArea_new" RENAME TO "WebDocuStartArea";
