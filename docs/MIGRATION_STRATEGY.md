# Migrationsstrategie und Best Practices

> ## 🚨 ACHTUNG: MIGRATION-ANLEITUNG VERALTET!
>
> **Die technischen Anleitungen in diesem Dokument (z.B. `npx prisma migrate dev`) funktionieren NICHT mit unserem pgBouncer-Setup!**
>
> ### ✅ AKTUELLE MIGRATIONS-ANLEITUNG:
> **→ [PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)** ← **NUR DIESE VERWENDEN!**
>
> ### ⚠️ Was ist noch gültig in diesem Dokument?
> - ✅ **Konzepte**: Multi-Phasen-Migrationen, additive changes, Data Migration Scripts
> - ✅ **Best Practices**: Dokumentation, Testing, Rollback-Strategien
> - ❌ **NICHT GÜLTIG**: Alle `npx prisma migrate dev` Befehle
> - ❌ **NICHT GÜLTIG**: Workflow mit automatischen Prisma Migrations
>
> **Für korrekte Befehle siehe:** [PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)
>
> **Warum veraltet?** Siehe [DATABASE_MIGRATIONS_AKTUELL.md](./DATABASE_MIGRATIONS_AKTUELL.md)

---

**Erstellt:** 01. November 2024
**Letzte Aktualisierung:** 18. Januar 2025
**Status:** ⚠️ TEILWEISE VERALTET - Konzepte gültig, Befehle NICHT
**Kategorie:** Development Guidelines

---

## Problemstellung

Bei der Entwicklung dieser Anwendung ist eine wiederkehrende Problematik im Umgang mit Datenbank-Migrationen aufgetreten:

### Typische Szenarien

1. **Schema-Änderungen während der Entwicklung**
   - Neue Felder werden zum Schema hinzugefügt
   - Bestehende Felder werden umbenannt oder entfernt
   - Relationen zwischen Tabellen ändern sich

2. **Migrationskonflikte**
   - Migrations-Dateien werden manuell erstellt und später durch `prisma migrate dev` überschrieben
   - Die Reihenfolge von Migrationen stimmt nicht mit der tatsächlichen Entwicklung überein
   - Produktionsdaten müssen berücksichtigt werden, aber Entwicklungsmigrationen sind bereits angewendet

3. **Datenverlust-Risiko**
   - Beim Löschen von Feldern ohne vorherige Datenmigration
   - Beim Umbenennen von Feldern ohne Übergangsstrategie
   - Bei Breaking Changes ohne Rollback-Möglichkeit

## Bisherige Probleme

### Beispiel: Contact-Feld Migration

Das `Client.contact` Feld musste durch `firstname` und `lastname` ersetzt werden:

- ❌ **Problem 1:** Migration wurde manuell erstellt, aber Prisma hat sie später überschrieben
- ❌ **Problem 2:** Daten mussten erst migriert werden, bevor das Feld entfernt werden konnte
- ❌ **Problem 3:** Code-Änderungen und Schema-Änderungen mussten synchron erfolgen

### Beispiel: SALES-Rolle

Neue `SALES` Rolle für Vertriebsmitarbeiter:

- ✅ **Lösung:** Separate Migration für Enum-Erweiterung
- ✅ **Lösung:** Code-Änderungen erst nach Schema-Update
- ⚠️ **Herausforderung:** Middleware und Auth-Logik mussten angepasst werden

## Lösung: Multi-Phasen-Migrationsstrategie

### Phase 1: Erweitern (Additive Changes)

**Ziel:** Neue Felder hinzufügen, ohne alte zu entfernen

```typescript
// 1. Schema erweitern
model Client {
  // Alt (bleibt erstmal)
  contact    String?

  // Neu (hinzufügen)
  salutation String?
  firstname  String?
  lastname   String?
}
```

**Migration erstellen:**
```bash
npx prisma migrate dev --name add_structured_contact_fields
```

**Vorteile:**
- ✅ Keine Breaking Changes
- ✅ Alte Daten bleiben erhalten
- ✅ Code kann graduell angepasst werden

### Phase 2: Migrieren (Data Migration)

**Ziel:** Daten vom alten Format ins neue Format übertragen

```typescript
// Script: scripts/migrate-contact-field.ts
async function migrateContactData() {
  const clients = await prisma.client.findMany({
    where: {
      contact: { not: null },
      OR: [
        { firstname: null },
        { lastname: null }
      ]
    }
  });

  for (const client of clients) {
    const [firstname, ...lastnameParts] = client.contact!.split(' ');
    await prisma.client.update({
      where: { id: client.id },
      data: {
        firstname,
        lastname: lastnameParts.join(' ')
      }
    });
  }
}
```

**Ausführen:**
```bash
# 1. Dry-Run (Test)
npx tsx scripts/migrate-contact-field.ts --dry-run

# 2. Live-Migration
npx tsx scripts/migrate-contact-field.ts
```

**Vorteile:**
- ✅ Kontrollierte Datenübertragung
- ✅ Rollback möglich (Daten in beiden Feldern)
- ✅ Kann schrittweise erfolgen

### Phase 3: Umstellen (Code Migration)

**Ziel:** Code auf neue Felder umstellen

```typescript
// components/ClientForm.tsx

// Vorher:
<input name="contact" value={client.contact} />

// Nachher:
<select name="salutation">
  <option value="Herr">Herr</option>
  <option value="Frau">Frau</option>
</select>
<input name="firstname" value={client.firstname} />
<input name="lastname" value={client.lastname} />
```

**Wichtig:**
- ✅ Template-Variablen abwärtskompatibel halten
- ✅ API-Endpoints graduell anpassen
- ✅ TypeScript-Errors beheben

### Phase 4: Bereinigen (Cleanup)

**Ziel:** Alte Felder aus Schema entfernen

```typescript
// Schema bereinigen
model Client {
  // contact String? <- ENTFERNEN
  salutation String?
  firstname  String?
  lastname   String?
}
```

**Migration erstellen:**
```bash
npx prisma migrate dev --name remove_deprecated_contact_field
```

**Vorher prüfen:**
```sql
-- Prüfen, ob noch Daten im alten Feld sind
SELECT id, name, contact, firstname, lastname
FROM "Client"
WHERE contact IS NOT NULL
  AND (firstname IS NULL OR lastname IS NULL);
```

**Vorteile:**
- ✅ Schema ist bereinigt
- ✅ Keine deprecated Felder mehr
- ✅ Daten wurden sicher migriert

## Best Practices für zukünftige Migrationen

> **💡 Für Vercel-Deployments:** Diese Best Practices gelten zusätzlich zu den [Vercel-spezifischen Workflows](./PRISMA_MIGRATIONS_VERCEL.md).

### 1. Niemals manuell Migrations-Dateien erstellen

❌ **Falsch:**
```bash
# Manuelle Datei erstellen
touch prisma/migrations/20240101_add_field/migration.sql
```

✅ **Richtig:**
```bash
# Prisma-CLI verwenden
npx prisma migrate dev --name add_field
```

### 2. Immer additive Changes bevorzugen

❌ **Falsch:**
```typescript
// Feld direkt umbenennen
model Client {
  // contact String? <- GELÖSCHT
  fullName String? // <- NEU
}
```

✅ **Richtig:**
```typescript
// Beide Felder temporär behalten
model Client {
  contact  String? // @deprecated
  fullName String?
}
```

### 3. Data Migration Scripts schreiben

✅ **Template für Data Migration:**

```typescript
// scripts/migrate-xyz.ts
import { prisma } from '../lib/db';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`🚀 Starting migration (${isDryRun ? 'DRY RUN' : 'LIVE'})`);

  const items = await prisma.model.findMany({
    where: { /* conditions */ }
  });

  console.log(`📊 Found ${items.length} items to migrate`);

  for (const item of items) {
    if (isDryRun) {
      console.log(`Would update: ${item.id}`);
    } else {
      await prisma.model.update({
        where: { id: item.id },
        data: { /* new data */ }
      });
      console.log(`✅ Updated: ${item.id}`);
    }
  }

  console.log('✨ Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 4. Migrations dokumentieren

✅ **Dokumentations-Template:**

Erstelle für jede größere Migration ein Markdown-Dokument in `docs/`:

```markdown
# Migration: [Name]

**Datum:** [Datum]
**Status:** [Geplant/In Arbeit/Abgeschlossen]

## Zusammenfassung
[Was wird geändert und warum?]

## Betroffene Komponenten
- Tabellen: [Liste]
- Code-Dateien: [Liste]
- API-Endpoints: [Liste]

## Durchführung
### Phase 1: Schema erweitern
[SQL/Prisma Schema]

### Phase 2: Daten migrieren
[Script-Beschreibung]

### Phase 3: Code anpassen
[Code-Änderungen]

### Phase 4: Bereinigung
[Cleanup-Steps]

## Testing
[Test-Strategie]

## Rollback
[Rollback-Anleitung]
```

### 5. Produktionsdaten schützen

✅ **Backup vor Migration:**
```bash
# 1. Datenbank-Backup erstellen
pg_dump -h localhost -U user -d projektverwaltung > backup_$(date +%Y%m%d).sql

# 2. Migration anwenden
npx prisma migrate deploy

# 3. Verification
npm run verify-migration
```

✅ **Rollback-Strategie definieren:**
```sql
-- Immer Rollback-SQL vorbereiten
-- rollback.sql
ALTER TABLE "Client" ADD COLUMN "contact" TEXT;
UPDATE "Client" SET "contact" = CONCAT(firstname, ' ', lastname);
```

## Checkliste für neue Migrationen

Verwende diese Checkliste bei jeder Schema-Änderung:

- [ ] Schema-Änderung ist additiv (alte Felder bleiben)
- [ ] Migration mit `prisma migrate dev` erstellt
- [ ] Data-Migration-Script geschrieben
- [ ] Dry-Run durchgeführt
- [ ] Code-Änderungen schrittweise umgesetzt
- [ ] TypeScript-Build erfolgreich
- [ ] Template-Variablen abwärtskompatibel
- [ ] Dokumentation erstellt (`docs/MIGRATION_*.md`)
- [ ] Backup-Strategie definiert
- [ ] Rollback-SQL vorbereitet
- [ ] Testing abgeschlossen
- [ ] Cleanup-Migration vorbereitet (für später)

## Häufige Fehler vermeiden

### ❌ Fehler 1: Feld direkt löschen

```typescript
// NIEMALS so:
model Client {
  // contact String? <- einfach entfernt
  name String
}
```

### ✅ Lösung: Multi-Phasen-Ansatz

```typescript
// Phase 1: Deprecate
model Client {
  contact String? /// @deprecated Use firstname/lastname
  firstname String?
  lastname String?
}

// Phase 2: Data Migration (Script)
// Phase 3: Code Migration
// Phase 4: Cleanup (separate Migration)
```

### ❌ Fehler 2: Manuelle Migrations-Dateien

```bash
# NIEMALS manuell erstellen
echo "ALTER TABLE..." > prisma/migrations/xyz/migration.sql
```

### ✅ Lösung: Prisma CLI verwenden

```bash
# Schema anpassen
# Dann:
npx prisma migrate dev --name descriptive_name
```

### ❌ Fehler 3: Breaking Changes ohne Transition

```typescript
// Sofort alles ändern
- contact: string
+ fullName: string
```

### ✅ Lösung: Transition Period

```typescript
// 1. Beide Felder
contact: string | null      // deprecated
fullName: string | null     // new

// 2. Code graduell umstellen
// 3. Wenn 100% umgestellt: contact entfernen
```

## Zusammenfassung

### Die 4 goldenen Regeln

1. **Niemals direkt löschen** - Immer erst neue Felder hinzufügen
2. **Immer Daten migrieren** - Script schreiben, Dry-Run durchführen
3. **Code graduell umstellen** - Keine Big-Bang-Changes
4. **Dokumentieren** - Jede Migration in `docs/` beschreiben

### Workflow-Übersicht

```
1. Schema erweitern (additive)
   ↓
2. Migration erstellen (prisma migrate dev)
   ↓
3. Data Migration Script schreiben
   ↓
4. Dry-Run durchführen
   ↓
5. Live-Migration ausführen
   ↓
6. Code schrittweise anpassen
   ↓
7. TypeScript/Build prüfen
   ↓
8. Testing
   ↓
9. Deployment
   ↓
10. Monitoring
   ↓
11. Cleanup-Migration (später)
```

## Weitere Ressourcen

- **[PRISMA_MIGRATIONS_VERCEL.md](./PRISMA_MIGRATIONS_VERCEL.md)** - Vercel-spezifischer Workflow (Solo-Entwickler)
- [Prisma Migrate Dokumentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [MIGRATION_CONTACT_FIELD.md](./MIGRATION_CONTACT_FIELD.md) - Beispiel einer erfolgreichen Migration
- [FROXLOR_2X_MIGRATION.md](./FROXLOR_2X_MIGRATION.md) - Froxlor API Änderungen

## Dokumenten-Übersicht

### Wann welches Dokument verwenden?

**[MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md)** (dieses Dokument)
- ✅ Multi-Phasen-Migrationen (additive changes)
- ✅ Data Migration Scripts
- ✅ Komplexe Schema-Änderungen
- ✅ Team-Entwicklung Best Practices

**[PRISMA_MIGRATIONS_VERCEL.md](./PRISMA_MIGRATIONS_VERCEL.md)**
- ✅ Vercel Deployment Workflow
- ✅ Solo-Entwickler Setup
- ✅ Automatische Deployments
- ✅ Gemeinsame DB (Lokal + Vercel)

**[FROXLOR_2X_MIGRATION.md](./FROXLOR_2X_MIGRATION.md)**
- ✅ Froxlor API Parameter-Änderungen
- ✅ FTP Password Management
- ✅ MySQL Server Selection

---

**Letzte Aktualisierung:** 13. November 2024
**Verantwortlich:** Development Team
