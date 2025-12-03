-- ============================================================================
-- Migration: add_texterstellung
-- Beschreibung: Fügt die Texterstellung-Tabellen für den Textit-Workflow hinzu
-- Datum: 2025-12-03
-- ============================================================================

-- Enum: TexterstellungStatus
CREATE TYPE "TexterstellungStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_REVIEW',
  'REVISION_IN_PROGRESS',
  'COMPLETED'
);

-- Enum: TexterstellungItemStatus
CREATE TYPE "TexterstellungItemStatus" AS ENUM (
  'PENDING',
  'DRAFT',
  'SUBMITTED',
  'REVISION_REQUESTED',
  'APPROVED'
);

-- Enum: TexterstellungDecision
CREATE TYPE "TexterstellungDecision" AS ENUM (
  'APPROVED',
  'REVISION_REQUESTED'
);

-- Tabelle: Texterstellung (Haupt-Container pro Projekt)
CREATE TABLE "Texterstellung" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "status" "TexterstellungStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "startedByUserId" TEXT,
  "startedByName" TEXT,
  "completedAt" TIMESTAMP(3),
  "internalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Texterstellung_pkey" PRIMARY KEY ("id")
);

-- Tabelle: TexterstellungItem (Einzelne Text-Items pro Menüpunkt)
CREATE TABLE "TexterstellungItem" (
  "id" TEXT NOT NULL,
  "texterstellungId" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "menuItemName" TEXT NOT NULL,
  "bulletPoints" TEXT NOT NULL,
  "bulletPointsCopiedAt" TIMESTAMP(3) NOT NULL,
  "status" "TexterstellungItemStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TexterstellungItem_pkey" PRIMARY KEY ("id")
);

-- Tabelle: TexterstellungVersion (Versionen eines Textes)
CREATE TABLE "TexterstellungVersion" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "customerDecision" "TexterstellungDecision",
  "customerDecisionAt" TIMESTAMP(3),
  "customerDecisionByName" TEXT,
  "customerDecisionByIp" TEXT,
  "revisionNote" TEXT,

  CONSTRAINT "TexterstellungVersion_pkey" PRIMARY KEY ("id")
);

-- Unique Constraints
CREATE UNIQUE INDEX "Texterstellung_projectId_key" ON "Texterstellung"("projectId");
CREATE UNIQUE INDEX "TexterstellungItem_menuItemId_key" ON "TexterstellungItem"("menuItemId");
CREATE UNIQUE INDEX "TexterstellungVersion_itemId_versionNumber_key" ON "TexterstellungVersion"("itemId", "versionNumber");

-- Indexes
CREATE INDEX "TexterstellungItem_texterstellungId_idx" ON "TexterstellungItem"("texterstellungId");
CREATE INDEX "TexterstellungItem_menuItemId_idx" ON "TexterstellungItem"("menuItemId");
CREATE INDEX "TexterstellungVersion_itemId_idx" ON "TexterstellungVersion"("itemId");

-- Foreign Keys
ALTER TABLE "Texterstellung" ADD CONSTRAINT "Texterstellung_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectWebsite"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TexterstellungItem" ADD CONSTRAINT "TexterstellungItem_texterstellungId_fkey"
  FOREIGN KEY ("texterstellungId") REFERENCES "Texterstellung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TexterstellungVersion" ADD CONSTRAINT "TexterstellungVersion_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "TexterstellungItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
