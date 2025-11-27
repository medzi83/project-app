-- Migration: Neues Feld materialNotes für WebDocuMenuItem (Schritt 7)
-- Dieses Feld speichert konkrete Material-Hinweise pro Menüpunkt (z.B. welche Bilder/Texte benötigt werden)

ALTER TABLE "WebDocuMenuItem" ADD COLUMN "materialNotes" TEXT;
