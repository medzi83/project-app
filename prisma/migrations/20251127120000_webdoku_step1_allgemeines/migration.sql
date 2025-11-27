-- Migration: WebDocumentation Schritt 1 - Allgemeines
-- Neue Felder für Schritt 1: Ansprechpartner, Email, Dringend zu beachten, Domain mit Status

-- Neue Spalten für WebDocumentation hinzufügen
ALTER TABLE "WebDocumentation" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "urgentNotes" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "websiteDomain" TEXT;
ALTER TABLE "WebDocumentation" ADD COLUMN "domainStatus" TEXT;

-- Enum-Typ für Domain-Status erstellen
-- Prisma verwendet TEXT-Spalten für Enums mit Constraint-Validierung

-- Verknüpfungstabelle für Ansprechpartner in der Webdokumentation
CREATE TABLE "WebDocumentationContact" (
    "id" TEXT NOT NULL,
    "webDocumentationId" TEXT NOT NULL,
    "authorizedPersonId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebDocumentationContact_pkey" PRIMARY KEY ("id")
);

-- Unique Constraint: Ein Ansprechpartner kann nur einmal pro Webdoku verknüpft sein
CREATE UNIQUE INDEX "WebDocumentationContact_webDocumentationId_authorizedPersonId_key" ON "WebDocumentationContact"("webDocumentationId", "authorizedPersonId");

-- Indexes für Performance
CREATE INDEX "WebDocumentationContact_webDocumentationId_idx" ON "WebDocumentationContact"("webDocumentationId");
CREATE INDEX "WebDocumentationContact_authorizedPersonId_idx" ON "WebDocumentationContact"("authorizedPersonId");

-- Foreign Keys
ALTER TABLE "WebDocumentationContact" ADD CONSTRAINT "WebDocumentationContact_webDocumentationId_fkey" FOREIGN KEY ("webDocumentationId") REFERENCES "WebDocumentation"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebDocumentationContact" ADD CONSTRAINT "WebDocumentationContact_authorizedPersonId_fkey" FOREIGN KEY ("authorizedPersonId") REFERENCES "AuthorizedPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
