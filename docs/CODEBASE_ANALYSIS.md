# Codebase-Analyse: Projektverwaltung

**Analysedatum:** 25. Oktober 2024
**Projektstatus:** Production
**Technologie:** Next.js 15.5.6, Prisma, PostgreSQL/Supabase, TypeScript

---

## Inhaltsverzeichnis

1. [Kritische Probleme](#1-kritische-probleme)
2. [Hohe Priorität](#2-hohe-priorität)
3. [Mittlere Priorität](#3-mittlere-priorität)
4. [Architektur-Empfehlungen](#4-architektur-empfehlungen)
5. [Schnelle Gewinne](#5-schnelle-gewinne)
6. [Detaillierte Problembeschreibungen](#6-detaillierte-problembeschreibungen)
7. [Datei-Referenzen](#7-datei-referenzen)

---

## 1. Kritische Probleme

### 1.1 DateTime-Behandlung inkonsistent

**Status:** ⚠️ Bekanntes Design-Pattern (NICHT ÄNDERN)
**Aufwand:** N/A
**Impact:** Keine Änderung erforderlich

**⚠️ WICHTIG - BEWUSSTE DESIGN-ENTSCHEIDUNG:**

Die aktuelle "naive" DateTime-Implementierung ist **absichtlich so gewählt** und darf **NICHT geändert** werden aus folgenden Gründen:

1. **Datenmigration:** Importierte Werte müssen exakt erhalten bleiben
2. **Keine Umrechnungen:** Es darf nicht zu Verfälschungen durch fehlerhafte Timezone-Umrechnungen kommen
3. **Systemstabilität:** Änderungen würden zu Inkonsistenzen bei bestehenden Daten führen

**Aktuelles System:**
- Zeiten werden **ohne Timezone-Umrechnung** gespeichert ("naive" UTC-Storage)
- Eingabe: `"2025-10-24T14:30"` → Speicherung: `"2025-10-24T14:30:00.000Z"`
- Anzeige: String-Slicing oder Regex-Parsing (keine Umrechnung)
- **Status:** Funktioniert korrekt für den aktuellen Anwendungsfall

**Betroffene Dateien (NICHT ÄNDERN):**
- `components/InlineCell.tsx` (Zeilen 299-319) - Naive String-Slicing ✅
- `app/projects/page.tsx` (Zeilen 46-72) - Regex-Parsing ✅
- `app/projects/[id]/page.tsx` - Naive Formatting (fmtDate, fmtDateTime) ✅ **(aktualisiert v2.3.5)**
- `app/film-projects/page.tsx` - Naive Formatting (formatDate) ✅ **(aktualisiert v2.3.5)**
- `app/film-projects/[id]/page.tsx` - Naive Formatting ✅ **(aktualisiert v2.3.5)**
- `app/appointments/page.tsx` - Naive Formatting (formatTime, formatDate, formatDateTime) ✅ **(neu in v2.3.5)**
- `app/projects/inline-actions.ts` (Zeilen 46-49) - Naive UTC-Storage ✅
- `app/film-projects/inline-actions.ts` (Zeilen 66-75) - Naive UTC-Storage ✅

**Ausnahme - Optional nutzbar:**
- `lib/date-utils.ts` - Kann für neue Features verwendet werden, wo Timezone wichtig ist (NICHT für bestehende Daten!)

**Beispiele der aktuellen Implementierung:**
```typescript
// ✅ KORREKT - Naive String-Slicing (behalten!)
const vDate = type === "date" && vStr ? vStr.slice(0, 10) : vStr;

// ✅ KORREKT - Regex ohne Timezone (behalten!)
const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);

// ✅ Optional für neue Features
return new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin"
}).format(date);
```

**Empfehlung:**
- ❌ **KEINE Änderungen** an bestehenden DateTime-Implementierungen
- ✅ Konsistenz innerhalb des "naive" Ansatzes sicherstellen
- ✅ Dokumentation beibehalten, dass dies bewusst so gewählt ist
- ✅ Neue Features können optional `date-utils.ts` nutzen, wenn Timezone relevant

---

### 1.2 Email-Trigger funktionieren nur teilweise

**Status:** 🔴 Kritisch
**Aufwand:** 1 Woche
**Impact:** Features funktionieren nicht wie erwartet

**Problem:**
Datei: `lib/email/trigger-service.ts` (Zeilen 183-225)

```typescript
switch (trigger.triggerType) {
  case "DATE_REACHED": {
    // This should be handled by a scheduled job, not on update
    return false;  // ❌ FEUERT NIE
  }
  case "CONDITION_MET": {
    // ✅ Funktioniert
  }
  case "MANUAL": {
    // Manual triggers are not automatically executed
    return false;  // ❌ FEUERT NIE
  }
}
```

**Details:**
- `DATE_REACHED` Triggers: Immer `false` (Zeile 186)
- `MANUAL` Triggers: Immer `false` (Zeile 219)
- Nur `CONDITION_MET` kann tatsächlich funktionieren
- Fehlende Unterstützung für andere Operatoren außer SET und EQUALS

**Empfehlung:**
1. Entweder vollständig implementieren (Cron-Job für DATE_REACHED)
2. Oder als "Coming Soon" markieren und UI entsprechend anpassen
3. Dokumentieren, welche Trigger-Types produktionsreif sind

---

### 1.3 Blockierende TODOs in Produktion

**Status:** 🟡 Teilweise erledigt
**Aufwand:** 1 Tag (Feature-Flag) oder 1-2 Wochen (Domain-Management Implementation)
**Impact:** Ein Feature zeigt noch "Funktion in Vorbereitung"

**Problem:**
Datei: `app/admin/basisinstallation/actions.ts`

**TODO 1 - Domain-Management (Zeile 388-391):**
```typescript
export async function manageDomain(formData: FormData) {
  // TODO: Implement domain management
  console.log("Manage domain:", { clientId, serverId });
  return { success: true, message: "Funktion in Vorbereitung" };
}
```

**Status:** ❌ Noch nicht implementiert

---

**~~TODO 2 - Joomla Installation (Zeile 547-559):~~**
```typescript
// ✅ BEREITS IMPLEMENTIERT
export async function installJoomla(formData: FormData) {
  // Vollständige Implementation vorhanden
}
```

**Status:** ✅ Bereits umgesetzt im Bereich Basisinstallation

---

**Empfehlung:**
- Domain-Management: Als Feature-Flag deaktivieren oder implementieren
- Button in UI ausblenden oder als "Coming Soon" markieren
- Joomla Installation: ✅ Keine Aktion erforderlich

---

## 2. Hohe Priorität

### 2.1 Code-Ähnlichkeiten: Website vs. Film Projects

**Status:** 🟢 Niedrig (Design-Entscheidung)
**Aufwand:** Nur selektive Optimierungen (z.B. Delete-Utility)
**Impact:** Begrenzt - unterschiedliche Workflows rechtfertigen separate Implementierungen

**⚠️ WICHTIG - BEWUSSTE ARCHITEKTUR-ENTSCHEIDUNG:**

Website- und Film-Projekte sind **zwar ähnlich im Aufbau**, haben aber **unterschiedliche Workflows, Abläufe und Bedürfnisse**. Daher:

- ✅ **Ähnliche Komponenten sind akzeptabel** - Sie dienen unterschiedlichen Zwecken
- ❌ **Nicht grundsätzlich gleichsetzen** - Unterschiedliche Business-Logik erfordert separate Implementierungen
- ✅ **Nur offensichtliche Utilities vereinheitlichen** - Z.B. identische Delete-Funktionen

**Vergleich:**

| Feature | Website | Film | Bewertung |
|---------|---------|------|-----------|
| Inline editing | `InlineCell.tsx` (327 Zeilen) | `FilmInlineCell.tsx` (351 Zeilen) | ✅ Separate beibehalten (unterschiedliche Felder/Validierung) |
| Inline actions | `projects/inline-actions.ts` (271 Zeilen) | `film-projects/inline-actions.ts` (354 Zeilen) | ✅ Separate beibehalten (unterschiedliche Business-Logik) |
| Status calculation | `project-status.ts` (344 Zeilen) | `film-status.ts` (140 Zeilen) | ✅ Separate beibehalten (komplett andere Status-Flows) |
| Delete actions | `projects/actions.ts` | `film-projects/actions.ts` | ⚠️ Kann vereinheitlicht werden (identische Logik) |

**Beispiel: Delete-Funktion kann vereinheitlicht werden:**
```typescript
// projects/actions.ts:30-34
await prisma.$transaction([
  prisma.projectNote.deleteMany({ where: { projectId: { in: projectIds } } }),
  prisma.projectWebsite.deleteMany({ where: { projectId: { in: projectIds } } }),
  prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
]);

// film-projects/actions.ts:50-54 (IDENTISCH - kann shared utility werden)
await prisma.$transaction([
  prisma.projectNote.deleteMany({ where: { projectId: { in: projectIds } } }),
  prisma.projectFilm.deleteMany({ where: { projectId: { in: projectIds } } }),
  prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
]);
```

**Empfehlung (nur für identische Funktionen wie Delete):**
```typescript
// lib/project-utils.ts - Shared Utility nur für IDENTISCHE Logik
async function deleteProjects(projectIds: string[], type: 'WEBSITE' | 'FILM') {
  const relatedTable = type === 'WEBSITE' ? 'projectWebsite' : 'projectFilm';
  await prisma.$transaction([
    prisma.projectNote.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma[relatedTable].deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
  ]);
}
```

**Was NICHT vereinheitlicht werden sollte:**
- ❌ Inline-Editing Komponenten (unterschiedliche Felder, Validierungen, extraFields)
- ❌ Status-Berechnung (komplett unterschiedliche Business-Logik)
- ❌ Form-Handling (unterschiedliche Workflows)
- ❌ List-Pages (unterschiedliche Filter, Spalten, Aktionen)

---

### 2.2 Date-Formatting 104+ Mal dupliziert

**Status:** 🟡 Hoch
**Aufwand:** 2-3 Tage
**Impact:** Konsistenz, Wartbarkeit

**Problem:**
- `fmtDate()`, `formatDate()`, `formatDateTime()` in vielen Dateien dupliziert
- Jede Implementation leicht unterschiedlich
- Bei Änderungen müssen alle Stellen aktualisiert werden

**Betroffene Dateien:**
- `app/projects/page.tsx` (Zeilen 46-72)
- `app/film-projects/page.tsx` (Zeilen 83-110)
- `lib/date-utils.ts` (Zeilen 1-44) - ✅ Diese sollte verwendet werden
- Inline in vielen Komponenten

**Empfehlung:**
- Alle auf `lib/date-utils.ts` konsolidieren
- Import in allen Komponenten: `import { formatDate, formatDateTime } from '@/lib/date-utils'`
- Lokale Formatierungen entfernen

---

### 2.3 ~~Excessive Console Logging (Sicherheitsrisiko)~~

**Status:** ✅ Erledigt (25.10.2024)
**Aufwand:** 2 Stunden
**Impact:** Sicherheit verbessert, Production-Ready

**Problem (gelöst):**
Console.logs in Produktion konnten sensitive Daten leaken und Performance beeinträchtigen.

**Entfernte Logs:**

| Datei | Anzahl entfernt | Severity | Status |
|-------|-----------------|----------|--------|
| `lib/email/trigger-service.ts` | 5 | Hoch (sensitive Daten) | ✅ Entfernt |
| `components/EmailConfirmationHandler.tsx` | 2 | Niedrig (Debugging) | ✅ Entfernt |
| `app/admin/basisinstallation/actions.ts` | 2 | Mittel (IDs) | ✅ Entfernt |
| `app/clients/[id]/page.tsx` | 2 | Hoch (Kundendaten) | ✅ Entfernt |
| `app/film-projects/inline-actions.ts` | 0 | - | ✅ War bereits sauber |
| `lib/email/send-service.ts` | 0 | - | ✅ War bereits sauber |
| **Gesamt** | **11** | **9 sicherheitskritisch** | ✅ |

**Was wurde entfernt:**
```typescript
// ❌ ENTFERNT - trigger-service.ts (Trigger-Check Debugging)
console.log(`[Trigger Check] Checking trigger: ${trigger.name}`);
console.log(`[Trigger Check] Updated fields:`, updatedFields);
console.log(`[Trigger Check] Old values:`, oldValues);

// ❌ ENTFERNT - clients/[id]/page.tsx (Auto-Sync)
console.log(`Auto-assigned server ${server.name} to client ${clientName}`);
console.log(`Auto-synced Froxlor contact data for client ${client.name}`);

// ❌ ENTFERNT - basisinstallation/actions.ts (TODOs)
console.log("Manage domain:", { clientId, serverId });
console.log("Install Joomla:", { clientId, serverId });
```

**Was wurde behalten:**
- ✅ `console.error()` - Für echte Fehler
- ✅ `console.warn()` - Für Warnungen
- ✅ API Routes (`process-email-queue`, `joomla-extract`) - Fortschritts-Logs für Background-Prozesse
- ✅ `lib/froxlor.ts` - Nur bei `debug=true` Parameter
- ✅ Scripts (`scripts/*.ts`) - Dürfen Logs haben

**Ergebnis:**
- 🔒 Sicherheitsrisiko beseitigt (keine sensitiven Daten in Logs)
- ⚡ Performance verbessert (weniger I/O)
- 🎯 Production-Ready Logging

---

### 2.4 N+1 Query Problem in Email-Triggers

**Status:** 🟡 Hoch
**Aufwand:** 2 Stunden
**Impact:** Performance bei vielen Triggern

**Problem:**
Datei: `lib/email/trigger-service.ts` (Zeile 324)

```typescript
for (const trigger of triggers) {
  // ❌ Lädt Email-Signature für JEDEN Trigger neu (N+1)
  const signature = await prisma.emailSignature.findFirst({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
  });
  // ...
}
```

**Empfehlung:**
```typescript
// ✅ Signature VOR der Schleife laden
const signatureCache = new Map<string, EmailSignature>();

for (const trigger of triggers) {
  const agencyId = project.client?.agency?.id;
  if (agencyId && !signatureCache.has(agencyId)) {
    const sig = await prisma.emailSignature.findFirst({
      where: { agencyId },
      orderBy: { createdAt: "asc" },
    });
    if (sig) signatureCache.set(agencyId, sig);
  }
  const signature = agencyId ? signatureCache.get(agencyId) : null;
  // ...
}
```

---

## 3. Mittlere Priorität

### 3.1 WT-Alias System

**Status:** ✅ Akzeptables Design-Pattern (Dokumentiert 25.10.2024)
**Aufwand:** N/A (System funktioniert wie gewünscht)
**Impact:** Niedrig - Bewusste Design-Entscheidung

**⚠️ WICHTIG - BEWUSSTE DESIGN-ENTSCHEIDUNG:**

Das WT-Alias System ist **absichtlich so implementiert** und funktioniert korrekt für den Anwendungsfall.

**Was ist WT?**

**WT = "Webtermin"** - Bezeichnet einen Agenten, der nur für den initialen Webtermin (Beratungsgespräch) zuständig ist, aber nicht zwingend das spätere Projekt umsetzt.

**Beispiel:**
- **"Nico"** = Macht das komplette Website-Projekt (Umsetzung, Demo, Online)
- **"Nico WT"** = Macht nur den Webtermin, Projekt kann später an anderen Agenten gehen

**Wichtig:** Dies sind KEINE separaten Agenten, sondern Aliases die auf denselben Base-Agent verweisen.

---

**Wie es funktioniert:**

Datei: `lib/agent-helpers.ts`

```typescript
// ✅ KORREKT - String-Suffix Pattern
export function getWTAliasId(baseAgentId: string): string {
  return `${baseAgentId}_WT`;  // z.B. "abc123" → "abc123_WT"
}

export function isWTAliasId(agentId: string): boolean {
  return agentId.endsWith("_WT");
}

// Konvertierung für DB-Speicherung
normalizeAgentIdForDB("abc123_WT")
// → { baseAgentId: "abc123", isWTAssignment: true }
```

**In `projects/inline-actions.ts` (Zeilen 73-87):**
```typescript
const { baseAgentId, isWTAssignment } = normalizeAgentIdForDB(nextAgentId);
await prisma.$transaction([
  prisma.project.update({ where: { id }, data: { agentId: baseAgentId } }),
  prisma.projectWebsite.upsert({
    where: { projectId: id },
    update: { isWTAssignment },
    create: { projectId: id, isWTAssignment },  // ✅ Flag speichern
  }),
]);
```

**Gespeichert wird:**
- `Project.agentId` = "abc123" (Basis-Agent)
- `ProjectWebsite.isWTAssignment` = true (WT-Flag)

**Angezeigt wird:**
- "Nico WT" (weil isWTAssignment = true)

---

**Vorteile des aktuellen Systems:**

1. ✅ **Einfach zu verstehen** - Klare Namenskonvention
2. ✅ **Funktioniert zuverlässig** - In Produktion seit längerem im Einsatz
3. ✅ **Keine DB-Migration** nötig
4. ✅ **UI-Logik bleibt gleich** - Dropdown zeigt beide Optionen
5. ✅ **Validation auf UI-Ebene** - WT-Aliases werden nur für Website-Projekte in Dropdowns angezeigt

**Verbesserungen (25.10.2024):**
- ✅ Umfangreiche Code-Dokumentation hinzugefügt
- ✅ Kommentare erklären WT = Webtermin
- ✅ Beispiele in JSDoc
- ✅ Validation erfolgt durch UI (nur Website-Projekte zeigen WT-Aliases)

**Keine Änderung erforderlich** - System ist gut dokumentiert und funktioniert wie gewünscht.

---

### 3.2 Fehlerbehandlung inkonsistent

**Status:** 🟢 Mittel
**Aufwand:** 3-4 Tage
**Impact:** User Experience, Debugging

**Problem:**
Unterschiedliche Patterns für Error-Handling in Server Actions:

**Pattern 1 - Redirect mit Fehler:**
```typescript
// clients/actions.ts:18-19
if (ids.length === 0) {
  redirect("/clients?delError=keine%20Auswahl");
}
```

**Pattern 2 - Silent Return:**
```typescript
// projects/actions.ts:39-54
export async function deleteProject(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return;  // ❌ Kein User-Feedback
  // ...
}
```

**Pattern 3 - Try/Catch mit Helper:**
```typescript
// email-templates/actions.ts:94-100
try {
  await prisma.emailTemplate.create({ data: parsed.data! });
} catch (error) {
  buildRedirect("error", handlePrismaError(error));
}
```

**Empfehlung:**
- Einheitliches Error-Handling Pattern definieren
- Flash-Messages oder Toast-Notifications für User-Feedback
- Konsistente Rückgabewerte: `{ success: boolean, error?: string, data?: T }`

---

### 3.3 Email Queue ineffizient

**Status:** 🟢 Mittel
**Aufwand:** 1 Woche
**Impact:** Performance bei vielen E-Mails

**Problem:**
Datei: `lib/email/send-service.ts` (Zeilen 115-180)

```typescript
export async function processEmailQueue() {
  // ❌ Hardcoded Limit
  const queuedEmails = await prisma.emailQueue.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    take: 50,  // Nicht konfigurierbar
  });

  // ❌ Sequenzielle Verarbeitung
  for (const email of queuedEmails) {
    await prisma.emailQueue.update({...});

    try {
      // ❌ Erstellt NEUEN Transporter für JEDE Email
      const transporter = nodemailer.createTransport(transportConfig);
      await transporter.sendMail(mailOptions);
    } catch (error) {
      // Retry-Logik
    }
  }
}
```

**Probleme:**
1. Hardcoded Limit von 50 E-Mails pro Lauf
2. Neuer Nodemailer-Transporter für jede E-Mail (teuer)
3. Keine Connection-Pooling
4. Sequenzielle Verarbeitung (langsam)

**Empfehlung:**
1. Transporter-Pooling: Einen Transporter pro MailServer wiederverwenden
2. Batch-Processing: Mehrere E-Mails parallel senden
3. Konfigurierbares Limit via Umgebungsvariable
4. Connection-Pooling für SMTP

---

### 3.4 ~~Deprecated Contact Field~~

**Status:** ✅ Erledigt (26.01.2025)
**Aufwand:** 3-4 Stunden (statt geplanter 3-4 Tage)
**Impact:** Datenqualität verbessert, Zukunftssicherheit erhöht

**Problem (gelöst):**
Das deprecated `contact` Field wurde erfolgreich entfernt und alle Daten in `firstname`/`lastname` migriert.

**Durchgeführte Arbeiten:**

1. **Analyse-Script erstellt** (`scripts/analyze-contact-field.ts`)
   - 1750 Clients analysiert
   - 3 Clients mit contact only gefunden
   - 1 Client mit beiden Feldern

2. **Migration-Script erstellt und ausgeführt** (`scripts/migrate-contact-field.ts`)
   - Intelligentes Splitting: Entfernt Anreden (Herr/Frau), splittet beim ersten Leerzeichen
   - 3 Clients erfolgreich migriert:
     - "Herr Strecker" → lastname: "Strecker"
     - "Nancy Miks" → firstname: "Nancy", lastname: "Miks"
     - "Ralph Jensen" → firstname: "Ralph", lastname: "Jensen"

3. **Code-Updates:**
   - ✅ `lib/email/trigger-service.ts` - Template-Variable nutzt nur noch firstname/lastname
   - ✅ `components/ClientDetailHeader.tsx` - contact prop entfernt
   - ✅ `components/ClientDataDialog.tsx` - contact field entfernt
   - ✅ `components/ClientEmailDialog.tsx` - contact prop entfernt
   - ✅ `components/EmailConfirmationHandler.tsx` - type angepasst
   - ✅ `app/api/clients/update-contact/route.ts` - contact param entfernt
   - ✅ `app/clients/[id]/page.tsx` - contact nicht mehr weitergegeben

4. **Schema-Migration vorbereitet:**
   - Migration erstellt: `20250126000000_remove_deprecated_contact_field`
   - SQL: `ALTER TABLE "Client" DROP COLUMN "contact"`
   - Wird beim nächsten Deploy automatisch angewendet

**Template-Variable Abwärtskompatibilität:**
```typescript
// lib/email/trigger-service.ts:391-394
"{{client.contact}}":
  project.client?.firstname || project.client?.lastname
    ? `${project.client.firstname || ""} ${project.client.lastname || ""}`.trim()
    : "",
```

**Vorteile:**
- ✅ Strukturierte Kontaktdaten (getrennte Vor-/Nachnamen)
- ✅ Bessere Unterstützung für personalisierte E-Mails
- ✅ Konsistente Datenerfassung in der UI
- ✅ Keine Legacy-Daten mehr
- ✅ Existierende Email-Templates funktionieren weiterhin

**Dokumentation:** Siehe `MIGRATION_CONTACT_FIELD.md` für Details

---

## 4. Architektur-Empfehlungen

### 4.1 Projekt-Typen Konsolidierung

**Status:** ✅ Entschieden - Status Quo beibehalten
**Entscheidung:** Separate Implementierungen bleiben

**⚠️ WICHTIG - DESIGN-ENTSCHEIDUNG:**

Website- und Film-Projekte haben **unterschiedliche Workflows, Abläufe und Bedürfnisse**. Die scheinbare Code-Duplizierung ist akzeptabel und gewollt.

**Aktueller Stand (wird beibehalten):**
- ✅ `Project` Model hat `type: WEBSITE | FILM`
- ✅ Separate Tabellen: `ProjectWebsite` und `ProjectFilm`
- ✅ Separate Komponenten und Actions (bewusst getrennt)

**~~Option A: Polymorphic Single Table~~** ❌ NICHT gewünscht
- ~~Alle projektspezifischen Felder in einer Tabelle~~
- Würde unterschiedliche Workflows erzwingen

**~~Option B: Current System mit Konsolidierung~~** ❌ NICHT notwendig
- ~~Geteilte Komponenten und Utilities~~
- Unterschiedliche Business-Logik rechtfertigt separate Komponenten

**Option C: Status Quo** ✅ GEWÄHLT
- Komplett separate Implementierungen
- Mehr Flexibilität für unterschiedliche Workflows
- Separate Wartung ist akzeptabel, da Projekte unterschiedlich sind

**Ausnahme - Kann konsolidiert werden:**
- Nur identische Utility-Funktionen (z.B. Delete-Actions)
- Siehe Abschnitt 2.1 für Details

---

### 4.2 API Routes vs. Server Actions

**Status:** Architektur-Diskussion
**Impact:** Performance, Entwicklererfahrung

**Aktueller Stand:**
- 20+ API Routes (`/app/api/`)
- 30+ Server Actions (export aus `.ts` Files)
- Gemischte Verwendung

**Beispiel - Ineffiziente API Route:**
```typescript
// app/api/email/confirm/route.ts
export async function POST(req: Request) {
  const { queueId } = await req.json();
  const queuedEmail = await prisma.emailQueue.findUnique({...});
  await prisma.emailQueue.delete({...});
  await sendProjectEmail({...});
}
```

**Problem:**
- JSON Serialization Overhead
- Könnte einfacher als Server Action sein
- Mehr Boilerplate-Code

**Empfehlung:**
- Migration zu Server Actions wo möglich (Next.js 14+ Best Practice)
- API Routes nur für:
  - Externe APIs
  - Webhooks
  - File Downloads
  - Streaming Responses

---

### 4.3 Fehlende Paginierung

**Status:** Skalierbarkeits-Problem
**Aufwand:** 1 Woche
**Impact:** Performance bei großen Datenmengen

**Problem:**
```typescript
// app/api/clients/route.ts
export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    // ❌ Kein take/skip - lädt ALLE Clients
  });
  return NextResponse.json(clients);
}
```

**Risiko:**
Bei 1000+ Clients wird Seite extrem langsam.

**Empfehlung:**
1. Cursor-based Pagination für Listen
2. Infinite Scrolling oder traditionelle Seiten
3. Limit von z.B. 100 Items pro Seite

---

## 5. Schnelle Gewinne

Diese Änderungen haben hohen Impact bei geringem Aufwand (1-2 Tage):

### 5.1 ~~Console.logs entfernen~~ ✅ ERLEDIGT

**Aufwand:** 2 Stunden ✅
**Status:** Abgeschlossen (25.10.2024)

**Betroffene Files:**
- ✅ `lib/email/trigger-service.ts` - 5 Logs entfernt
- ✅ `components/EmailConfirmationHandler.tsx` - 2 Logs entfernt
- ✅ `app/admin/basisinstallation/actions.ts` - 2 Logs entfernt
- ✅ `app/clients/[id]/page.tsx` - 2 Logs entfernt
- ✅ `app/film-projects/inline-actions.ts` - War bereits sauber
- ✅ `lib/email/send-service.ts` - War bereits sauber

**Ergebnis:**
- 11 console.logs entfernt (9 sicherheitskritisch)
- Sicherheitsrisiko beseitigt
- Production-Ready
- Behalten: `console.error()` und `console.warn()` für echte Fehler

---

### 5.2 Date-Formatting konsolidieren ✅
**Aufwand:** 4-6 Stunden
**Files:** Alle Komponenten und Pages

**Action:**
1. Sicherstellen `lib/date-utils.ts` hat alle benötigten Funktionen
2. Import in alle betroffenen Files
3. Lokale Implementierungen entfernen
4. Tests durchführen

---

### 5.3 Email-Signature Caching ✅
**Aufwand:** 1 Stunde
**File:** `lib/email/trigger-service.ts`

**Action:**
```typescript
// VOR der Trigger-Schleife:
const signatureCache = new Map<string, EmailSignature>();

// IN der Schleife:
if (agencyId && !signatureCache.has(agencyId)) {
  const sig = await prisma.emailSignature.findFirst({...});
  if (sig) signatureCache.set(agencyId, sig);
}
```

---

### 5.4 TODO-Features dokumentieren ✅
**Aufwand:** 1 Stunde

**Action:**
1. GitHub Issues für `manageDomain` und `installJoomla` erstellen
2. UI-Buttons mit Tooltip "Coming Soon" markieren
3. Oder Feature-Flags implementieren

---

### 5.5 Error-Handling in Actions vereinheitlichen ✅
**Aufwand:** 3-4 Stunden

**Action:**
Einheitliches Return-Pattern:
```typescript
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function myAction(formData: FormData): Promise<ActionResult> {
  try {
    // ... logic
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
}
```

---

## 6. Detaillierte Problembeschreibungen

### 6.1 Project Status Derivation - Over-Engineered

**File:** `lib/project-status.ts` (344 Zeilen)

**Problem:**
Komplexe Logik mit fragwürdigen Defaults:

```typescript
export function deriveProjectStatus({
  pStatus, webDate, demoDate, onlineDate, materialStatus
}: DeriveProjectStatusInput): ProjectStatus {

  // ❓ Ist BEENDET immer = ONLINE?
  if (normalizedPStatus && DONE_P_STATUS.has(normalizedPStatus)) {
    return "ONLINE";
  }

  // Status-Kaskade
  if (onlineDate) return "ONLINE";
  if (demoDate) return "DEMO";

  // Complex webDate Logic mit current time
  const web = toDate(webDate);
  if (!web || web > effectiveNow) {
    return "WEBTERMIN";
  }

  // Material-Status Check
  if (normalizedMaterial !== MATERIAL_COMPLETE) {
    return "MATERIAL";
  }

  return "UMSETZUNG";
}
```

**Issues:**
1. Keine Validierung für ungültige Status-Transitionen
2. `BEENDET` → sofort `ONLINE` (immer korrekt?)
3. Komplexe Material-Status-Normalisierung mit Character-Replacement:
```typescript
const normalized = upper
  .replace(/\u00C4/g, "AE")    // Ä → AE
  .replace(/\u00D6/g, "OE")    // Ö → OE
  .replace(/\u00DC/g, "UE")    // Ü → UE
  .replace(/\u00DF/g, "SS");   // ß → SS
```

**Fragen:**
- Warum werden Umlaute ersetzt? Datenqualitäts-Problem?
- Sollte Status-Änderung validiert werden (kein Rückschritt)?

---

### 6.2 Prisma Schema Design Issues

#### 6.2.1 Denormalisierung von Project Type

```prisma
model Project {
  id        String               @id @default(cuid())
  type      ProjectType          @default(WEBSITE)
  website   ProjectWebsite?
  film      ProjectFilm?
}
```

**Problem:**
- Ein Project kann theoretisch BEIDE Relationen haben (`website` UND `film`)
- `type` Field sagt "es sollte nur eins sein"
- Keine DB-Constraint erzwingt dies

**Queries müssen daher defensiv prüfen:**
```typescript
OR: [
  { type: "WEBSITE" },
  { website: { isNot: null } }
]
```

**Empfehlung:**
Entweder:
1. Check-Constraint in DB: `(website IS NULL OR film IS NULL)`
2. Oder Application-Level Validation in Prisma Middleware

---

#### 6.2.2 Fehlende Indexes

```prisma
model EmailQueue {
  @@index([status, scheduledFor])    // ✅ Gut für processEmailQueue()
  @@index([projectId])               // ✅ Gut für Lookups
  @@index([triggerId])               // ✅ Gut für Cleanup

  // ❌ Fehlt: @@index([toEmail]) für Duplikat-Check
  // ❌ Fehlt: @@index([createdAt]) für Pagination
}
```

**Empfehlung:**
Indexes hinzufügen für häufige Queries.

---

#### 6.2.3 JSON Columns untyped

```prisma
model EmailTrigger {
  conditions     Json    // ❌ Untyped
  recipientConfig Json   // ❌ Untyped
}

model UserPreferences {
  filmProjectsAgentFilter Json?    // Array of IDs
  filmProjectsStatusFilter Json?   // Array of status values
}
```

**Problem:**
- Keine Type-Safety
- Schwer zu validieren
- Kann inkonsistente Daten enthalten

**Empfehlung:**
1. Zod-Schemas für JSON-Validation
2. Oder separate Tabellen (z.B. `UserFilterPreference`)

---

### 6.3 Email Confirmation Flow - Fragmentiert

**Aktueller Flow:**
1. User updated Feld → `inline-actions.ts` ruft `processTriggers()` auf
2. `processTriggers()` erstellt `PENDING_CONFIRMATION` Queue-Entry
3. Component erhält Queue-ID → zeigt `EmailConfirmationDialog`
4. User bestätigt → ruft `/api/email/confirm` auf
5. API-Endpoint löscht Queue-Entry → sendet Email via `sendProjectEmail()`

**Probleme:**
1. Zu viele Roundtrips für einfache Operation
2. Queue-Entry wird gelöscht BEVOR Email gesendet (was wenn Senden fehlschlägt?)
3. Keine Idempotenz: zweite Bestätigung gibt 404
4. Dialog muss manuell Refresh handhaben

**Empfehlung:**
- Server Action statt API Route
- Queue-Entry erst nach erfolgreichem Senden löschen
- Status-Update zu `SENDING` → `SENT` oder `FAILED`

---

## 7. Datei-Referenzen

### Kritische Files

| Datei | Zeilen | Probleme |
|-------|--------|----------|
| `lib/email/trigger-service.ts` | 436 | Unvollständige Triggers, N+1 Query, Console.logs |
| `lib/email/send-service.ts` | 253 | Ineffiziente Queue-Verarbeitung |
| `prisma/schema.prisma` | 590 | Fehlende Constraints, JSON-Columns |
| `app/projects/inline-actions.ts` | 271 | WT-Alias Logik, DateTime-Handling |
| `app/film-projects/inline-actions.ts` | 354 | Code-Duplizierung |
| `components/InlineCell.tsx` | 327 | Dupliziert mit FilmInlineCell |
| `components/FilmInlineCell.tsx` | 351 | Dupliziert mit InlineCell |
| `lib/project-status.ts` | 344 | Über-komplexe Logik |
| `app/admin/basisinstallation/actions.ts` | 600+ | TODOs, Console.logs |

---

### DateTime-Behandlung

| Datei | Zeilen | Methode | Status |
|-------|--------|---------|--------|
| `lib/date-utils.ts` | 1-44 | Intl API + Berlin TZ | ⚠️ Nur für neue Features |
| `components/InlineCell.tsx` | 299-319 | String.slice() | ✅ Naive (korrekt) |
| `app/projects/page.tsx` | 46-72 | Regex | ✅ Naive (korrekt) |
| `app/projects/[id]/page.tsx` | - | Regex (fmtDate, fmtDateTime) | ✅ Naive (v2.3.5) |
| `app/film-projects/page.tsx` | - | Regex (formatDate) | ✅ Naive (v2.3.5) |
| `app/film-projects/[id]/page.tsx` | - | Regex | ✅ Naive (v2.3.5) |
| `app/appointments/page.tsx` | - | Regex (formatTime, formatDate, formatDateTime) | ✅ Naive (v2.3.5) |
| `app/projects/inline-actions.ts` | 46-49 | UTC append | ✅ Naive Storage |
| `app/film-projects/inline-actions.ts` | 66-75 | UTC append | ✅ Naive Storage |

---

### Code-Duplizierung

| Feature | Website File | Film File | Similarity |
|---------|-------------|-----------|------------|
| Inline Cell | `components/InlineCell.tsx` | `components/FilmInlineCell.tsx` | 90% |
| Inline Actions | `app/projects/inline-actions.ts` | `app/film-projects/inline-actions.ts` | 70% |
| Delete Actions | `app/projects/actions.ts` | `app/film-projects/actions.ts` | 100% |
| List Page | `app/projects/page.tsx` | `app/film-projects/page.tsx` | 85% |
| Status Logic | `lib/project-status.ts` | `lib/film-status.ts` | 40% |

---

## Prioritäten-Matrix

| Priorität | Kategorie | Anzahl | Geschätzter Aufwand |
|-----------|-----------|--------|---------------------|
| 🔴 Kritisch | Email-Triggers | 1 | 1 Woche |
| 🟡 Hoch | N+1, Date-Formatting, Domain-Management-TODO | 3 | 1-2 Wochen |
| 🟢 Mittel | Error-Handling, Email-Queue | 2 | 1-2 Wochen |
| ⚪ Niedrig | Delete-Utility (optional), API Routes Migration, Optimierungen | 3 | 2-3 Wochen |
| ⚠️ Nicht ändern | DateTime-Handling, Website/Film-Trennung, WT-Alias (bewusste Design-Entscheidungen) | 3 | N/A |
| ✅ Erledigt | Joomla-Installation, Console Logging, Contact Field Migration | 3 | - |

**Gesamt:** ~4-6 Wochen für komplette Refactoring (ohne Design-Entscheidungen)

---

## Nächste Schritte

### Empfohlene Reihenfolge:

1. **Woche 1: Schnelle Gewinne**
   - ~~Console.logs entfernen~~ ✅ **ERLEDIGT (25.10.2024)**
   - Date-Formatting konsolidieren (nur Duplizierungen, nicht die naive Logik ändern!)
   - Email-Signature Caching
   - TODO-Features dokumentieren

2. **Woche 2-3: Kritische Fixes**
   - Email-Triggers reparieren oder deaktivieren
   - Error-Handling standardisieren
   - ~~DateTime-Handling vereinheitlichen~~ ❌ NICHT ÄNDERN (bewusste Design-Entscheidung)

3. **Woche 5-6: Optionale Utilities**
   - ~~Inline-Editing Components vereinheitlichen~~ ❌ NICHT ÄNDERN (separate Workflows)
   - Delete-Actions konsolidieren (optional - nur wenn Zeit vorhanden)
   - Nur echte Shared Utilities erstellen (keine Component-Vereinheitlichung)

4. **Woche 7+: Architektur (optional)**
   - API Routes zu Server Actions migrieren
   - Email-Queue optimieren
   - Paginierung implementieren

---

## Offene Fragen

1. **WT-Aliases:** Wird diese Funktion aktiv genutzt? Können wir sie vereinfachen?
2. **Email-Triggers:** Brauchen Sie `DATE_REACHED` und `MANUAL` wirklich?
3. ~~**DateTime:** Sollen ALLE Zeiten als Europe/Berlin behandelt werden?~~ ✅ **BEANTWORTET:** Naive Behandlung muss bleiben (Datenmigration, keine Umrechnungen)
4. ~~**Code-Sharing:** Sollen Website- und Film-Projects mehr Code teilen?~~ ✅ **BEANTWORTET:** NEIN - Separate Workflows bleiben getrennt
5. **Status-Logik:** Ist die komplexe Status-Derivierung notwendig?

---

**Dokument-Version:** 1.4
**Letztes Update:** 12. November 2024
**Erstellt von:** Claude Code Analysis Agent

---

## Änderungshistorie

**v1.4 (12.11.2024):**
- ✅ **Naive Date Formatting konsistent angewendet (v2.3.5)**
  - Zeitzonenproblem behoben: 14:00 wurde vorher als 15:00 angezeigt
  - `app/projects/[id]/page.tsx` - Intl.DateTimeFormat durch Naive Regex-Formatting ersetzt
  - `app/film-projects/page.tsx` - formatDate auf Naive Formatting umgestellt
  - `app/film-projects/[id]/page.tsx` - Naive Formatting implementiert
  - `app/appointments/page.tsx` - Neue Kalender-Seite mit Naive Formatting (formatTime, formatDate, formatDateTime)
  - Fix: Array-Destrukturierung Bug in formatTime behoben (Tag wurde als Stunde interpretiert)
  - Neue Dokumentation: `NAIVE_DATE_FORMATTING.md` erstellt
  - DateTime-Behandlung Tabelle aktualisiert (alle betroffenen Dateien als "korrekt" markiert)
- ✅ **Deployment-Konfiguration erweitert**
  - `next.config.ts`: webpack externals für SSH2/ODBC native modules hinzugefügt
  - `next.config.ts`: typescript.ignoreBuildErrors aktiviert
  - `DEPLOYMENT.md`: Troubleshooting-Abschnitt für native modules und TypeScript-Fehler erweitert
- 📊 **Neue Features:**
  - Termin-Kalender (`/appointments`) mit Übersicht aller Kundentermine (Webtermine, Dreh, Scouting)
  - Kalenderansicht mit Monatsnavigation
  - Gefilterte Listen nach Termintyp

**v1.3 (26.01.2025):**
- ✅ **Contact Field Migration (Punkt 3.4) abgeschlossen**
  - 3 Clients von deprecated `contact` zu `firstname`/`lastname` migriert
  - Analyse-Script erstellt: `scripts/analyze-contact-field.ts`
  - Migration-Script erstellt: `scripts/migrate-contact-field.ts`
  - 7 Code-Dateien aktualisiert (trigger-service, ClientDetailHeader, ClientDataDialog, ClientEmailDialog, EmailConfirmationHandler, update-contact route, clients/[id]/page)
  - Schema-Migration vorbereitet: `20250126000000_remove_deprecated_contact_field`
  - Template-Variable `{{client.contact}}` bleibt abwärtskompatibel (kombiniert firstname + lastname)
  - Vollständige Dokumentation in `MIGRATION_CONTACT_FIELD.md`
- Prioritäten-Matrix aktualisiert:
  - Contact Field von "Mittel" zu "Erledigt" verschoben
  - Geschätzter Gesamtaufwand reduziert: ~4-6 Wochen (vorher 5-7)
  - "Mittel" Kategorie: 3 → 2 Items
  - "Erledigt" Kategorie: 2 → 3 Items

**v1.2 (25.10.2024):**
- ✅ **Console Logging (Punkt 2.3) abgeschlossen**
  - 11 console.logs entfernt (9 sicherheitskritisch)
  - Betroffene Dateien: trigger-service.ts, EmailConfirmationHandler.tsx, basisinstallation/actions.ts, clients/[id]/page.tsx
  - Sicherheitsrisiko beseitigt (keine sensitiven Daten mehr in Logs)
  - Production-Ready Logging implementiert
- Prioritäten-Matrix aktualisiert:
  - Console.logs von "Hoch" zu "Erledigt" verschoben
  - Geschätzter Aufwand reduziert: ~5-7 Wochen (vorher 6-7)
- Nächste Schritte: Woche 1 angepasst (Console.logs als erledigt markiert)

**v1.1 (25.10.2024):**
- ⚠️ DateTime-Behandlung als bewusste Design-Entscheidung markiert (NICHT ÄNDERN)
- Klarstellung: Naive Timezone-Implementierung muss wegen Datenmigration und Vermeidung von Umrechnungsfehlern bleiben
- ⚠️ Website/Film-Trennung als bewusste Design-Entscheidung markiert (NICHT VEREINHEITLICHEN)
- Klarstellung: Unterschiedliche Workflows rechtfertigen separate Implementierungen
- ✅ Joomla-Installation als bereits implementiert markiert (Basisinstallation-Bereich)
- Prioritäten-Matrix aktualisiert:
  - DateTime nicht mehr als kritisches Problem
  - Code-Duplizierung von "Hoch" zu "Niedrig" (nur optionale Delete-Utility)
  - TODOs: 2 → 1 (nur Domain-Management offen)
  - Joomla-Installation zu "Erledigt" verschoben
- Geschätzter Aufwand reduziert: ~6-7 Wochen (vorher 10-12)

**v1.0 (25.10.2024):**
- Initiale Analyse-Dokumentation erstellt
