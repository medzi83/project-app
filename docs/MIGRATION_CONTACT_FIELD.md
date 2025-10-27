# Migration: Deprecated Contact Field Entfernung

**Datum:** 26. Januar 2025
**Status:** ✅ Abgeschlossen
**Betroffenes Feld:** `Client.contact`

## Zusammenfassung

Das deprecated `contact` Feld wurde erfolgreich aus dem Schema entfernt. Alle Daten wurden in die neuen `firstname` und `lastname` Felder migriert.

## Durchgeführte Schritte

### 1. Analyse (✅ Abgeschlossen)

Script: `scripts/analyze-contact-field.ts`

**Ergebnis:**
- **Gesamt Clients:** 1750
- **Clients mit contact only:** 3
- **Clients mit firstname/lastname:** 6
- **Clients mit beiden Feldern:** 1
- **Clients ohne Kontaktinfo:** 1741

### 2. Datenmigration (✅ Abgeschlossen)

Script: `scripts/migrate-contact-field.ts`

**Migrierte Clients:**

1. **Gartendesign Strecker**
   - Alt: `"Herr Strecker"`
   - Neu: `firstname: ""`, `lastname: "Strecker"`

2. **Bestattungen Nancy Miks**
   - Alt: `"Nancy Miks"`
   - Neu: `firstname: "Nancy"`, `lastname: "Miks"`

3. **Studio Chevyteddy**
   - Alt: `"Ralph Jensen"`
   - Neu: `firstname: "Ralph"`, `lastname: "Jensen"`

**Splitting-Logik:**
- Entfernt Anreden (Herr, Frau, Hr., Fr.)
- Splittet beim ersten Leerzeichen
- Erster Teil → firstname
- Rest → lastname

### 3. Code-Anpassungen (✅ Abgeschlossen)

**Entfernte `contact` Feld-Verwendungen:**

| Datei | Änderung |
|-------|----------|
| `lib/email/trigger-service.ts` | Template-Variable `{{client.contact}}` nutzt jetzt nur firstname/lastname |
| `components/ClientDetailHeader.tsx` | Prop `contact` entfernt, Validierung angepasst |
| `components/ClientDataDialog.tsx` | Prop `currentContact` entfernt, UI bereinigt |
| `components/ClientEmailDialog.tsx` | Prop `clientContact` entfernt, nur firstname/lastname |
| `components/EmailConfirmationHandler.tsx` | Type `MissingClientData` angepasst |
| `app/api/clients/update-contact/route.ts` | Parameter `contact` entfernt |
| `app/clients/[id]/page.tsx` | Prop `contact` nicht mehr weitergegeben |

**Template-Variable Abwärtskompatibilität:**

Die Template-Variable `{{client.contact}}` existiert weiterhin und kombiniert automatisch firstname + lastname:

```typescript
"{{client.contact}}":
  project.client?.firstname || project.client?.lastname
    ? `${project.client.firstname || ""} ${project.client.lastname || ""}`.trim()
    : "",
```

### 4. Schema-Migration (✅ Vorbereitet)

**Migration:** `prisma/migrations/20250126000000_remove_deprecated_contact_field/migration.sql`

```sql
-- Remove deprecated contact field from Client table
-- Data has been migrated to firstname/lastname fields via migrate-contact-field.ts script

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "contact";
```

**Status:** Migration ist vorbereitet und wird beim nächsten Deploy angewendet.

## Vorteile

✅ **Datenqualität:** Strukturierte Kontaktdaten (getrennte Vor-/Nachnamen)
✅ **Flexibilität:** Bessere Unterstützung für Anreden und personalisierte E-Mails
✅ **Konsistenz:** Einheitliche Datenerfassung in der UI
✅ **Zukunftssicherheit:** Deprecated Field entfernt, keine Legacy-Daten mehr
✅ **Abwärtskompatibilität:** Existierende Email-Templates funktionieren weiterhin

## Testing

**TypeScript-Build:** ✅ Erfolgreich (keine Errors)

```bash
npx tsc --noEmit
# Result: No errors
```

**Migrations-Scripts:**
- ✅ Dry-Run erfolgreich
- ✅ Live-Migration erfolgreich (3 Clients migriert)
- ✅ Keine Fehler

## Nächste Schritte

1. ✅ **Code deployed:** Änderungen sind im Repository
2. ⏳ **Migration anwenden:** Beim nächsten Deploy wird die Prisma-Migration automatisch ausgeführt
3. ⏳ **Monitoring:** Nach Deploy prüfen, ob alle Clients korrekt angezeigt werden

## Rollback (falls nötig)

Falls die Migration rückgängig gemacht werden muss:

```sql
-- Rollback: Re-add contact field
ALTER TABLE "Client" ADD COLUMN "contact" TEXT;

-- Optional: Populate from firstname/lastname
UPDATE "Client"
SET "contact" = CONCAT(firstname, ' ', lastname)
WHERE firstname IS NOT NULL OR lastname IS NOT NULL;
```

**Hinweis:** Rollback sollte nicht nötig sein, da:
1. Alle Daten wurden erfolgreich migriert
2. Template-Variable ist abwärtskompatibel
3. UI nutzt nur noch firstname/lastname

## Verantwortlich

- **Durchgeführt von:** Claude Code Analysis Agent
- **Datum:** 26. Januar 2025
- **Review:** Pending
