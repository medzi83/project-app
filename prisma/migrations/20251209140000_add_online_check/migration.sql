-- Migration: QM Check Schema-Änderung
-- Entfernt type-Feld und benennt textValue in note um

-- OnlineCheckTemplateItem: type-Spalte entfernen
ALTER TABLE "OnlineCheckTemplateItem" DROP COLUMN IF EXISTS "type";

-- OnlineCheckItem: type-Spalte entfernen
ALTER TABLE "OnlineCheckItem" DROP COLUMN IF EXISTS "type";

-- OnlineCheckItem: textValue in note umbenennen
ALTER TABLE "OnlineCheckItem" RENAME COLUMN "textValue" TO "note";

-- Enum löschen (wird nicht mehr benötigt)
DROP TYPE IF EXISTS "OnlineCheckItemType";
