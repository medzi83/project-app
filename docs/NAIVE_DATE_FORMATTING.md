# Naive Date Formatting - Zeitzonenprobleme vermeiden

## Übersicht

Diese Dokumentation beschreibt die "Naive Date Formatting"-Strategie, die in der gesamten Anwendung verwendet wird, um Zeitzonenprobleme zu vermeiden.

## Das Problem

### Ursprüngliche Situation

Dates und Timestamps wurden in der Datenbank als UTC gespeichert (z.B. `2025-11-20T14:00:00.000Z`), aber sollten als **Berlin-Zeit ohne Zeitzonenkonversion** interpretiert werden.

**Beispiel des Problems:**
- Datenbank: `2025-11-20T14:00:00.000Z` (gespeichert als Mitternacht UTC, gemeint als 14:00 Berlin-Zeit)
- Mit `Intl.DateTimeFormat` formatiert mit Timezone `Europe/Berlin`: **15:00 Uhr** ❌ (falsch!)
- Gewünschte Anzeige: **14:00 Uhr** ✅

### Ursache

JavaScript's `Intl.DateTimeFormat` mit `timeZone: "Europe/Berlin"` konvertiert UTC-Zeiten in die Berlin-Zeitzone. Das führt zu einer Verschiebung um +1 Stunde (bzw. +2 Stunden während Sommerzeit).

## Die Lösung: Naive Formatting

### Prinzip

Statt Timezone-Conversion zu verwenden, extrahieren wir die Datums- und Zeitkomponenten **direkt aus dem ISO-String** mittels Regex, ohne Zeitzonenkonversion.

### Implementierung

```typescript
// Naive date formatting - extracts date components directly from ISO string
const formatDate = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

// Naive date/time formatting
const formatDateTime = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

// Naive time formatting
const formatTime = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";
    const hours = match[4];
    const minutes = match[5];
    return `${hours}:${minutes}`;
  } catch {
    return "-";
  }
};
```

### Regex-Erklärung

```
^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})
│  │      │      │      │      │
│  │      │      │      │      └─ Minuten (Index 5)
│  │      │      │      └──────── Stunden (Index 4)
│  │      │      └─────────────── Tag (Index 3)
│  │      └────────────────────── Monat (Index 2)
│  └───────────────────────────── Jahr (Index 1)
└──────────────────────────────── Start of String
```

## Betroffene Dateien

Die Naive Formatting Funktionen wurden in folgenden Dateien implementiert:

### ✅ Implementiert in:

- **[/app/projects/page.tsx](../app/projects/page.tsx)** - Projektliste
- **[/app/projects/[id]/page.tsx](../app/projects/[id]/page.tsx)** - Projekt-Detailseite
- **[/app/film-projects/page.tsx](../app/film-projects/page.tsx)** - Filmprojekt-Liste
- **[/app/film-projects/[id]/page.tsx](../app/film-projects/[id]/page.tsx)** - Filmprojekt-Detailseite
- **[/app/appointments/page.tsx](../app/appointments/page.tsx)** - Termin-Kalender (NEU in v2.3.5)

## Vorher/Nachher Vergleich

### ❌ Vorher (mit Intl.DateTimeFormat)

```typescript
const formatDateTime = (value: Date) => {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin"  // ← Verursacht Zeitzonenverschiebung!
  }).format(value);
};

// Datenbank: 2025-11-20T14:00:00.000Z
// Ausgabe: 20.11.2025, 15:00 ❌ (1 Stunde zu viel!)
```

### ✅ Nachher (mit Naive Formatting)

```typescript
const formatDateTime = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

// Datenbank: 2025-11-20T14:00:00.000Z
// Ausgabe: 20.11.2025, 14:00 ✅ (korrekt!)
```

## Wichtige Hinweise

### ⚠️ Wann NICHT verwenden

Diese Strategie funktioniert nur, wenn:
- Dates in der Datenbank als "naive" UTC-Zeiten gespeichert werden
- Die Zeiten als lokale Zeit (Berlin) ohne Timezone-Info gemeint sind
- Keine echte Zeitzonenkonversion gewünscht ist

### ✅ Wann verwenden

Verwende Naive Formatting wenn:
- Du Termine/Daten anzeigen willst, die in der Datenbank als UTC gespeichert sind
- Die UTC-Zeit als lokale Berlin-Zeit interpretiert werden soll
- Keine Sommerzeit/Winterzeit-Konversion stattfinden soll

## Häufige Fehler

### ❌ Falsche Array-Destrukturierung

```typescript
// FALSCH - überspringt Indizes
const [, , , hours, minutes] = match;
// match[3] = day, aber wird als hours verwendet!
```

### ✅ Korrekte Verwendung

```typescript
// RICHTIG - explizite Indizierung
const hours = match[4];    // Index 4 = Stunden
const minutes = match[5];  // Index 5 = Minuten
```

### ❌ Falsches Filtering im Kalender

```typescript
// FALSCH - verwendet day als hours
const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
const [, year, month, hours] = match;  // hours ist eigentlich day!
```

### ✅ Korrektes Filtering

```typescript
// RICHTIG
const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
const [, year, month, day] = match;
return parseInt(day) === targetDay;
```

## Tests & Validierung

### Manuelle Tests

1. Öffne die Projektliste `/projects`
2. Überprüfe, dass ein Projekt mit Webtermin um 14:00 Uhr auch als **14:00** angezeigt wird
3. Öffne die Projekt-Detailseite
4. Überprüfe, dass alle Timestamps konsistent sind
5. Öffne den Termin-Kalender `/appointments`
6. Überprüfe, dass Termine am richtigen Tag mit der richtigen Uhrzeit angezeigt werden

### Beispiel-Test

```typescript
// Input: 2025-11-20T14:00:00.000Z
const result = formatDateTime("2025-11-20T14:00:00.000Z");
console.log(result); // "20.11.2025, 14:00" ✅
```

## Changelog

### Version 2.3.5 (12.11.2024)
- ✅ Implementierung der Naive Formatting-Strategie in allen relevanten Dateien
- ✅ Behebung des Zeitzonenproblems (14:00 wurde als 15:00 angezeigt)
- ✅ Neue Termin-Kalender-Seite mit korrekter Zeitanzeige
- ✅ Fix: Array-Destrukturierung in formatTime korrigiert

## Weitere Informationen

Siehe auch:
- [Deployment Guide](DEPLOYMENT.md) - Deployment-Konfiguration
- [Changelog](/app/changelog/page.tsx) - User-facing Changelog
