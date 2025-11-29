# Naive Date Handling - Anleitung für Entwickler

## TL;DR - Schnellreferenz

**Problem:** Benutzer gibt 16:00 ein → wird als 15:00 oder 17:00 angezeigt
**Lösung:** Zentrale Bibliothek verwenden

```typescript
// SPEICHERN (in Server Actions)
import { toNaiveDate } from "@/lib/naive-date";
const toDate = toNaiveDate;

// ANZEIGEN (in React-Komponenten)
// Entweder aus Bibliothek:
import { formatNaiveDateTime } from "@/lib/naive-date";

// Oder lokale Funktion:
function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "";
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "";
  }
}
```

---

## Wann tritt das Problem auf?

Das Zeitzonenproblem tritt auf, wenn:
1. Ein `datetime-local` Input verwendet wird (liefert z.B. `"2025-11-28T16:00"`)
2. Dieser String mit `new Date(s)` geparst wird
3. Das Datum später mit `Intl.DateTimeFormat` oder `toLocaleString` angezeigt wird

## Warum passiert das?

```typescript
// Input vom datetime-local: "2025-11-28T16:00"
const date = new Date("2025-11-28T16:00");
// JavaScript interpretiert das als LOKALE Zeit (Berlin = UTC+1)
// Intern speichert es: 2025-11-28T15:00:00.000Z (UTC)

// Beim Anzeigen auf dem Server (der evtl. in UTC läuft):
date.toLocaleString("de-DE"); // Kann 15:00, 16:00 oder 17:00 sein!
```

## Die Lösung

### 1. Beim Speichern: `toNaiveDate` verwenden

Die Funktion hängt ein `Z` an den String an, bevor `new Date()` aufgerufen wird. Dadurch wird der String als UTC interpretiert und **nicht** als lokale Zeit konvertiert.

```typescript
// In: app/projects/new/actions.ts, app/projects/[id]/edit/actions.ts, etc.
import { toNaiveDate } from "@/lib/naive-date";
const toDate = toNaiveDate;

// Im Zod-Schema:
webDate: z.string().optional().transform(toDate),
```

**Was passiert:**
- Input: `"2025-11-28T16:00"`
- `toNaiveDate` macht daraus: `"2025-11-28T16:00:00.000Z"`
- Gespeichert wird: `2025-11-28T16:00:00.000Z` ✅

### 2. Beim Anzeigen: Regex-Extraktion verwenden

Statt `Intl.DateTimeFormat` zu verwenden, extrahieren wir die Komponenten direkt aus dem ISO-String:

```typescript
function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    // Date-Objekt zu ISO-String konvertieren
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    // Regex extrahiert: Jahr, Monat, Tag, Stunden, Minuten
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "";
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "";
  }
}
```

**Was passiert:**
- DB liefert: `2025-11-28T16:00:00.000Z`
- Regex extrahiert: Jahr=2025, Monat=11, Tag=28, Stunden=16, Minuten=00
- Ausgabe: `28.11.2025, 16:00` ✅

---

## Zentrale Bibliothek: `lib/naive-date.ts`

### Verfügbare Funktionen

| Funktion | Verwendung | Beispiel |
|----------|------------|----------|
| `toNaiveDate(s)` | Speichern | `"16:00"` → `Date` mit 16:00:00.000Z |
| `formatNaiveDate(d)` | Anzeige | `28.11.2025` |
| `formatNaiveDateShort(d)` | Anzeige kurz | `28.11.25` |
| `formatNaiveDateTime(d)` | Anzeige mit Zeit | `28.11.2025, 16:00` |
| `formatNaiveDateTimeShort(d)` | Anzeige kurz mit Zeit | `28.11.25 um 16:00 Uhr` |
| `formatNaiveTime(d)` | Nur Uhrzeit | `16:00` |

### Wann die Bibliothek importieren?

**Für Server Actions (Speichern):**
```typescript
import { toNaiveDate } from "@/lib/naive-date";
```

**Für React-Komponenten (Anzeigen):**
- Bibliothek importieren wenn mehrere Formate benötigt werden
- Lokale Funktion wenn nur ein spezifisches Format benötigt wird

---

## Checkliste für neue Dateien

### Neue Server Action mit Datumsfeldern

1. ✅ `import { toNaiveDate } from "@/lib/naive-date";`
2. ✅ `const toDate = toNaiveDate;` (für Kompatibilität)
3. ✅ Im Zod-Schema: `.transform(toDate)` für alle Datumsfelder

### Neue React-Seite mit Datumsanzeige

1. ✅ Lokale `formatDate`/`formatDateTime` Funktion erstellen
2. ✅ Regex-basierte Extraktion verwenden (NICHT `Intl.DateTimeFormat`)
3. ✅ `typeof date === 'string' ? date : date.toISOString()` für beide Typen

---

## Häufige Fehler

### ❌ FALSCH: `new Date(s)` ohne Z

```typescript
const toDate = (s?: string | null) => (s && s.trim() ? new Date(s) : null);
// "16:00" wird als lokale Zeit interpretiert → speichert 15:00 UTC
```

### ✅ RICHTIG: Z anhängen

```typescript
const toDate = (s?: string | null) => {
  if (!s || !s.trim()) return null;
  const trimmed = s.trim();
  if (!trimmed.includes('T')) {
    return new Date(trimmed + 'T00:00:00.000Z');
  }
  return new Date(trimmed + ':00.000Z');
};
```

### ❌ FALSCH: `Intl.DateTimeFormat` mit Timezone

```typescript
new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin" }).format(date);
// Konvertiert UTC zurück zu lokaler Zeit!
```

### ✅ RICHTIG: Regex-Extraktion

```typescript
const dateStr = date.toISOString();
const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
const [, year, month, day, hours, minutes] = match;
```

### ❌ FALSCH: Falsche Array-Destrukturierung

```typescript
const [, , , hours, minutes] = match;
// match[3] ist der TAG, nicht die Stunden!
```

### ✅ RICHTIG: Alle Positionen benennen

```typescript
const [, year, month, day, hours, minutes] = match;
// Index: 0=full, 1=year, 2=month, 3=day, 4=hours, 5=minutes
```

---

## Betroffene Dateien (Stand: November 2025)

### Projektverwaltung - Speichern

- `lib/naive-date.ts` - Zentrale Bibliothek
- `app/projects/new/actions.ts` - Projekt erstellen
- `app/projects/[id]/edit/actions.ts` - Projekt bearbeiten
- `app/film-projects/[id]/edit/actions.ts` - Filmprojekt bearbeiten
- `app/api/projects/create/route.ts` - API Route

### Projektverwaltung - Anzeigen

- `app/projects/page.tsx`
- `app/projects/[id]/page.tsx`
- `app/film-projects/page.tsx`
- `app/film-projects/[id]/page.tsx`
- `app/appointments/page.tsx`
- `app/clients/[id]/page.tsx`

### Kundenportal - Anzeigen

- `app/(authenticated)/projekte/page.tsx`
- `app/(authenticated)/projekte/[id]/page.tsx`

---

## Debugging

### Symptom: Zeit ist um 1-2 Stunden verschoben

1. **Prüfe die Datenbank:** Welche Zeit steht dort? (z.B. mit Prisma Studio)
   - Erwartet: `16:00:00.000Z` für Eingabe 16:00
   - Problem: `15:00:00.000Z` → Speichern verwendet nicht `toNaiveDate`

2. **Prüfe die Anzeige:** Wird Regex oder Intl verwendet?
   - Suche nach `Intl.DateTimeFormat` oder `toLocaleString` → ersetzen mit Regex

### Symptom: Datum funktioniert, Zeit nicht

Prüfe ob das Regex-Match die Zeit-Komponenten enthält:
```typescript
// Nur Datum:
dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);

// Mit Zeit:
dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
```

---

## Warum keine externe Library?

- `date-fns`, `dayjs`, `luxon` etc. lösen das Problem nicht automatisch
- Die Kernursache ist JavaScript's Interpretation von Datetime-Strings
- Unsere Lösung ist minimal und verständlich
- Keine zusätzliche Dependency nötig
