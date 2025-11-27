-- Migration: Schritt 5 - Formulare für WebDocumentation

-- Enum für Formularfeld-Typen erstellen
CREATE TYPE "WebDocuFormFieldType" AS ENUM (
    'ANREDE',
    'VORNAME',
    'NACHNAME',
    'EMAIL',
    'TELEFON',
    'STRASSE',
    'PLZ',
    'ORT',
    'NACHRICHT',
    'DATENSCHUTZ',
    'CUSTOM_TEXT',
    'CUSTOM_TEXTAREA',
    'CUSTOM_CHECKBOX',
    'CUSTOM_SELECT'
);

-- Tabelle für Formulare erstellen
CREATE TABLE "WebDocuForm" (
    "id" TEXT NOT NULL,
    "webDocumentationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebDocuForm_pkey" PRIMARY KEY ("id")
);

-- Tabelle für Formularfelder erstellen
CREATE TABLE "WebDocuFormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldType" "WebDocuFormFieldType" NOT NULL,
    "label" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebDocuFormField_pkey" PRIMARY KEY ("id")
);

-- Indizes erstellen
CREATE INDEX "WebDocuForm_webDocumentationId_idx" ON "WebDocuForm"("webDocumentationId");
CREATE INDEX "WebDocuFormField_formId_idx" ON "WebDocuFormField"("formId");

-- Foreign Keys erstellen
ALTER TABLE "WebDocuForm" ADD CONSTRAINT "WebDocuForm_webDocumentationId_fkey"
    FOREIGN KEY ("webDocumentationId") REFERENCES "WebDocumentation"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebDocuFormField" ADD CONSTRAINT "WebDocuFormField_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "WebDocuForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
