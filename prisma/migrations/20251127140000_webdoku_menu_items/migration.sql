-- Migration: WebDocuMenuItem Tabelle für Websiteaufbau (Schritt 3)

-- Tabelle für Menüpunkte erstellen
CREATE TABLE "WebDocuMenuItem" (
    "id" TEXT NOT NULL,
    "webDocumentationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isFooterMenu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebDocuMenuItem_pkey" PRIMARY KEY ("id")
);

-- Indexes für Performance
CREATE INDEX "WebDocuMenuItem_webDocumentationId_idx" ON "WebDocuMenuItem"("webDocumentationId");
CREATE INDEX "WebDocuMenuItem_parentId_idx" ON "WebDocuMenuItem"("parentId");

-- Foreign Keys
ALTER TABLE "WebDocuMenuItem" ADD CONSTRAINT "WebDocuMenuItem_webDocumentationId_fkey" FOREIGN KEY ("webDocumentationId") REFERENCES "WebDocumentation"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebDocuMenuItem" ADD CONSTRAINT "WebDocuMenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WebDocuMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
