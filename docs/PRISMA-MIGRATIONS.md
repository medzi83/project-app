# Prisma Datenbank-Migrationen

## ⚠️ WICHTIG: Korrekte Vorgehensweise für Datenbankmigrationen

Da die Projektverwaltung **Supabase mit pgBouncer (Connection Pooler)** verwendet, funktioniert `npx prisma migrate dev` **NICHT** direkt. Migrationen benötigen eine direkte Datenbankverbindung.

## Warum `migrate dev` nicht funktioniert

- `DATABASE_URL` verwendet den **pgBouncer Pooler** (Port 5432 oder 6543)
- `migrate dev` benötigt eine **direkte Verbindung** ohne Pooler
- `DIRECT_URL` in der `.env` verwendet die direkte Verbindung

## ✅ Korrekte Vorgehensweise

### Schritt 1: Prisma Schema anpassen

Nehmen Sie Ihre Änderungen am `prisma/schema.prisma` vor:
- Neue Models hinzufügen
- Felder zu bestehenden Models hinzufügen
- Enums erweitern
- Relationen definieren

### Schritt 2: Migrations-Ordner erstellen

```bash
mkdir prisma/migrations/YYYYMMDDHHMMSS_beschreibung
```

Beispiel:
```bash
mkdir prisma/migrations/20250118000000_add_print_design_projects
```

### Schritt 3: SQL-Migrationsdatei erstellen

Erstellen Sie eine Datei `migration.sql` im neuen Migrationsordner mit den notwendigen SQL-Befehlen.

**Beispiel für eine vollständige Migration:**

```sql
-- CreateEnum (wenn neue Enums hinzugefügt werden)
CREATE TYPE "PrintDesignType" AS ENUM ('LOGO', 'VISITENKARTE', 'FLYER', 'PLAKAT', 'BROSCHÜRE', 'SONSTIGES');

-- AlterEnum (bestehende Enums erweitern)
ALTER TYPE "ProjectType" ADD VALUE 'PRINT_DESIGN';
ALTER TYPE "AgentCategory" ADD VALUE 'PRINT_DESIGN';
ALTER TYPE "EmailTemplateCategory" ADD VALUE 'PRINT_DESIGN';

-- AlterTable (Spalten zu bestehenden Tabellen hinzufügen)
ALTER TABLE "UserPreferences"
ADD COLUMN "printDesignAgentFilter" JSONB,
ADD COLUMN "printDesignStatusFilter" JSONB,
ADD COLUMN "printDesignProjectTypeFilter" JSONB;

-- CreateTable (neue Tabellen erstellen)
CREATE TABLE "ProjectPrintDesign" (
    "projectId" TEXT NOT NULL,
    "projectType" "PrintDesignType",
    "pStatus" "ProductionStatus" NOT NULL DEFAULT 'NONE',
    "webtermin" TIMESTAMP(3),
    "implementation" TIMESTAMP(3),
    "designToClient" TIMESTAMP(3),
    "designApproval" TIMESTAMP(3),
    "finalVersionToClient" TIMESTAMP(3),
    "printRequired" BOOLEAN NOT NULL DEFAULT false,
    "printOrderPlaced" TIMESTAMP(3),
    "printProvider" TEXT,
    "note" TEXT,

    CONSTRAINT "ProjectPrintDesign_pkey" PRIMARY KEY ("projectId")
);

-- AddForeignKey (Foreign Key Constraints hinzufügen)
ALTER TABLE "ProjectPrintDesign"
ADD CONSTRAINT "ProjectPrintDesign_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (Indizes hinzufügen, falls benötigt)
-- CREATE INDEX "ProjectPrintDesign_projectType_idx" ON "ProjectPrintDesign"("projectType");
```

### Schritt 4: Migration ausführen

**NICHT `npx prisma migrate dev` verwenden!**

Stattdessen:

```bash
npx prisma migrate deploy
```

✅ Dieser Befehl verwendet automatisch die `DIRECT_URL` aus der `.env`-Datei.

### Schritt 5: Prisma Client neu generieren

```bash
npx prisma generate
```

## Häufige Fehler vermeiden

### ❌ FALSCH
```bash
npx prisma migrate dev --name my_migration
```
→ Fehler: `Can't reach database server` (pgBouncer unterstützt keine Migrationen)

### ✅ RICHTIG
```bash
# 1. Migrationsordner erstellen
mkdir prisma/migrations/20250118120000_my_migration

# 2. migration.sql erstellen (siehe Beispiel oben)

# 3. Migration ausführen
npx prisma migrate deploy

# 4. Prisma Client generieren
npx prisma generate
```

## Wichtige SQL-Befehle

### Neue Tabelle erstellen
```sql
CREATE TABLE "TableName" (
    "id" TEXT NOT NULL,
    "field" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableName_pkey" PRIMARY KEY ("id")
);
```

### Enum erstellen
```sql
CREATE TYPE "EnumName" AS ENUM ('VALUE1', 'VALUE2', 'VALUE3');
```

### Enum erweitern
```sql
ALTER TYPE "ExistingEnum" ADD VALUE 'NEW_VALUE';
```

### Spalte hinzufügen
```sql
ALTER TABLE "TableName"
ADD COLUMN "columnName" TEXT,
ADD COLUMN "anotherColumn" BOOLEAN NOT NULL DEFAULT false;
```

### Foreign Key hinzufügen
```sql
ALTER TABLE "ChildTable"
ADD CONSTRAINT "ChildTable_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "ParentTable"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
```

### Index erstellen
```sql
CREATE INDEX "TableName_field_idx" ON "TableName"("field");
CREATE UNIQUE INDEX "TableName_field_key" ON "TableName"("field");
```

## Troubleshooting

### Problem: `db pull` überschreibt das Schema

Wenn Sie `npx prisma db pull` ausführen, wird Ihr lokales Schema mit der Datenbank überschrieben und alle lokalen Änderungen gehen verloren.

**Lösung:**
- Vermeiden Sie `db pull` während der Entwicklung
- Falls versehentlich ausgeführt: Schema aus Git wiederherstellen und Änderungen erneut vornehmen

### Problem: Migration schlägt fehl

**Mögliche Ursachen:**
1. Syntax-Fehler in der `migration.sql`
2. Enum-Wert existiert bereits
3. Tabelle/Spalte existiert bereits

**Lösung:**
- SQL-Syntax überprüfen
- Datenbank-Status mit einem SQL-Client überprüfen
- Bei Bedarf manuelle SQL-Befehle ausführen, um die Datenbank zu bereinigen

### Problem: TypeScript-Fehler nach Migration

Nach einer erfolgreichen Migration können TypeScript-Fehler auftreten, wenn der Prisma Client nicht neu generiert wurde.

**Lösung:**
```bash
npx prisma generate
```

## Checkliste für Migrationen

- [ ] Prisma Schema angepasst
- [ ] Migrationsordner mit Zeitstempel erstellt
- [ ] `migration.sql` mit korrekten SQL-Befehlen erstellt
- [ ] `npx prisma migrate deploy` ausgeführt
- [ ] `npx prisma generate` ausgeführt
- [ ] Anwendung neu gestartet (falls Dev-Server läuft)
- [ ] Funktionalität getestet

## Weitere Ressourcen

- [Prisma Migrations Dokumentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
