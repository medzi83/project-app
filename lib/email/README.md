# E-Mail-Trigger-System

Automatisches E-Mail-Versand-System basierend auf Projekt-Events.

## Funktionen

### 1. **Automatische Mailserver-Auswahl**

Das System wählt automatisch den richtigen Mailserver basierend auf der Agentur-Zuordnung:

- **Agentur-spezifisch**: Wenn der Kunde einer Agentur zugeordnet ist, wird der Mailserver dieser Agentur verwendet
- **Fallback**: Wenn kein agentur-spezifischer Server vorhanden ist, wird der Fallback-Server (ohne Agentur-Zuordnung) verwendet

```typescript
import { getMailServerForProject } from "@/lib/email/mailserver-service";

// Automatische Auswahl
const mailServer = await getMailServerForProject(projectId);
```

### 2. **Trigger-Typen**

#### **DATE_FIELD_SET** - Datumsfeld wurde gesetzt
Wird ausgelöst, wenn ein bestimmtes Datumsfeld gesetzt wird.

**Beispiel**: Demo-Termin wurde eingetragen
```json
{
  "field": "demoDate",
  "operator": "SET"
}
```

#### **DATE_REACHED** - Datum wurde erreicht
Wird ausgelöst, wenn ein bestimmtes Datum erreicht ist.

**Beispiel**: 1 Tag vor Demo-Termin
```json
{
  "field": "demoDate",
  "operator": "REACHED"
}
```
Mit `delayDays: -1` und `delayType: "BEFORE"`

#### **CONDITION_MET** - Bedingung erfüllt
Wird ausgelöst, wenn eine komplexe Bedingung erfüllt ist.

**Beispiel**: 7 Tage nach Skript-Versand keine Freigabe
```json
{
  "field": "scriptToClient",
  "checkField": "scriptApproved",
  "operator": "NOT_SET_AFTER_DAYS",
  "days": 7
}
```

#### **MANUAL** - Manuell ausgelöst
Wird nur manuell durch einen Admin ausgelöst.

### 3. **Empfänger-Konfiguration**

```json
{
  "to": "CLIENT",
  "cc": ["AGENT", "FILMER"]
}
```

Mögliche Werte:
- **to**: `CLIENT`, `AGENT`, `FILMER`, `CUTTER`
- **cc**: Array mit beliebiger Kombination

### 4. **Template-Variablen**

Templates können folgende Variablen verwenden (werden automatisch ersetzt):

- `{{projectTitle}}` - Projekttitel
- `{{clientName}}` - Kundenname
- `{{agentName}}` - Name des zuständigen Agents
- `{{demoDate}}` - Demo-Datum (formatiert)
- `{{webDate}}` - Web-Termin (formatiert)
- etc.

## Admin-Interface

### Trigger verwalten

Unter `/admin/email-triggers` können Trigger erstellt und verwaltet werden:

1. **Trigger erstellen**
   - Name und Beschreibung festlegen
   - Trigger-Typ wählen
   - Bedingungen definieren
   - Template auswählen
   - Empfänger konfigurieren

2. **Trigger aktivieren/deaktivieren**
   - Inaktive Trigger werden nicht ausgeführt
   - Gut für temporäres Deaktivieren

3. **Statistiken**
   - Anzahl Warteschlangen-Einträge
   - Anzahl versendeter E-Mails

## Queue-System

Alle E-Mails werden zunächst in eine Queue eingereiht und dann asynchron versendet.

### Manueller Versand

```bash
POST /api/process-email-queue
Authorization: Bearer <your-session>
```

### Automatischer Versand (Cron)

Füge folgendes zu deinem Cron-System hinzu (z.B. Vercel Cron oder externes Cron):

```bash
# Jede Stunde
0 * * * * curl -X POST https://your-domain.com/api/process-email-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Setze `CRON_SECRET` in deiner `.env`:
```
CRON_SECRET=your-secret-token-here
```

### Queue-Status abfragen

```bash
GET /api/process-email-queue
```

Gibt Statistiken über die Queue zurück:
```json
{
  "success": true,
  "queueStats": {
    "PENDING": 5,
    "SENT": 120,
    "FAILED": 2
  }
}
```

## Beispiel-Konfigurationen

### 1. Demo-Termin gesetzt (Website)

```json
{
  "name": "Demo-Termin gesetzt",
  "triggerType": "DATE_FIELD_SET",
  "projectType": "WEBSITE",
  "conditions": {
    "field": "demoDate",
    "operator": "SET"
  },
  "delayDays": 0,
  "delayType": "EXACT",
  "templateId": "...",
  "recipientConfig": {
    "to": "CLIENT",
    "cc": ["AGENT"]
  }
}
```

### 2. Erinnerung 1 Tag vor Demo

```json
{
  "name": "Demo-Erinnerung",
  "triggerType": "DATE_REACHED",
  "projectType": "WEBSITE",
  "conditions": {
    "field": "demoDate",
    "operator": "REACHED"
  },
  "delayDays": 1,
  "delayType": "BEFORE",
  "templateId": "...",
  "recipientConfig": {
    "to": "CLIENT",
    "cc": ["AGENT"]
  }
}
```

### 3. Skript-Freigabe überfällig (Film)

```json
{
  "name": "Skript-Freigabe überfällig",
  "triggerType": "CONDITION_MET",
  "projectType": "FILM",
  "conditions": {
    "field": "scriptToClient",
    "checkField": "scriptApproved",
    "operator": "NOT_SET_AFTER_DAYS",
    "days": 7
  },
  "delayDays": 0,
  "templateId": "...",
  "recipientConfig": {
    "to": "CLIENT",
    "cc": ["AGENT", "FILMER"]
  }
}
```

## Entwicklung

### Trigger-Evaluation

Die Trigger-Evaluation sollte implementiert werden in:
- `lib/email/trigger-evaluation.ts` (TODO)

Diese sollte:
1. Alle aktiven Trigger durchgehen
2. Prüfen, ob Bedingungen erfüllt sind
3. E-Mails in die Queue einreihen

### Testing

1. Erstelle einen Test-Trigger
2. Setze ihn auf "Inaktiv"
3. Teste die Bedingungen manuell
4. Aktiviere ihn, wenn alles funktioniert

### Monitoring

- Prüfe regelmäßig `/api/process-email-queue` (GET) für Queue-Status
- Überwache `EmailLog` Tabelle für Fehler
- Achte auf `FAILED` Status in der Queue

## Troubleshooting

### E-Mails werden nicht versendet

1. Prüfe, ob Trigger aktiv ist
2. Prüfe Queue-Status über API
3. Teste Mailserver-Konfiguration unter `/admin/server`
4. Prüfe Logs in `EmailLog` Tabelle

### Falscher Mailserver

1. Prüfe Agentur-Zuordnung des Kunden
2. Prüfe Mailserver-Konfiguration unter `/admin/server`
3. Stelle sicher, dass ein Fallback-Server (ohne Agentur) existiert

### Queue läuft nicht

1. Stelle sicher, dass Cron-Job konfiguriert ist
2. Prüfe `CRON_SECRET` in `.env`
3. Teste manuellen Versand über API
