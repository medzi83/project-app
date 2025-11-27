-- Migration: styleType zu styleTypes Array umwandeln
-- Diese Migration ist nur notwendig, falls die vorherige Migration mit styleType als Enum bereits ausgeführt wurde

-- Falls styleType existiert, Daten migrieren und Spalte umbenennen
DO $$
BEGIN
    -- Prüfen ob die alte styleType Spalte existiert
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'WebDocumentation' AND column_name = 'styleType'
    ) THEN
        -- Neue Array-Spalte hinzufügen falls nicht vorhanden
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'WebDocumentation' AND column_name = 'styleTypes'
        ) THEN
            ALTER TABLE "WebDocumentation" ADD COLUMN "styleTypes" TEXT[] DEFAULT '{}';
        END IF;

        -- Daten von styleType nach styleTypes migrieren (falls vorhanden)
        UPDATE "WebDocumentation"
        SET "styleTypes" = ARRAY["styleType"::TEXT]
        WHERE "styleType" IS NOT NULL;

        -- Alte Spalte löschen
        ALTER TABLE "WebDocumentation" DROP COLUMN "styleType";

        -- Alten Enum-Typ löschen falls vorhanden
        DROP TYPE IF EXISTS "WebDocuStyleType";
    END IF;

    -- Falls styleTypes noch nicht existiert, erstellen
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'WebDocumentation' AND column_name = 'styleTypes'
    ) THEN
        ALTER TABLE "WebDocumentation" ADD COLUMN "styleTypes" TEXT[] DEFAULT '{}';
    END IF;
END $$;
