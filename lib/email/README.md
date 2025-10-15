# E-Mail-Trigger-System

Automatisches E-Mail-Versand-System basierend auf Projekt-Events.

## Funktionen

### 1. **Sofortversand mit Bestätigung vs. Queue**

Das System unterscheidet zwischen sofortigem Versand (mit Bestätigung) und verzögertem Versand:

- **Sofortversand mit Bestätigung**: Trigger ohne Verzögerung (`delayDays` = 0 oder null) zeigen einen **Bestätigungsdialog**
  - Beispiel: Wenn ein Datum gerade eingetragen wird
  - Dialog zeigt: E-Mail-Adresse (editierbar), Betreff, E-Mail-Text
  - E-Mail-Adresse kann im Dialog angepasst und beim Kunden gespeichert werden
  - Optionen: "Jetzt senden" oder "Abbrechen"
  - Status in Queue: `PENDING_CONFIRMATION`
- **Verzögerter Versand**: Trigger mit `delayDays` > 0 werden in die Queue geschrieben
  - Beispiel: 1 Tag vor einem Termin
  - Versand über Cron-Job oder manuell
  - Status in Queue: `PENDING`

### 2. **Automatische Mailserver-Auswahl**

Das System wählt automatisch den richtigen Mailserver basierend auf der Agentur-Zuordnung:

- **Agentur-spezifisch**: Wenn der Kunde einer Agentur zugeordnet ist, wird der Mailserver dieser Agentur verwendet
- **Fallback**: Wenn kein agentur-spezifischer Server vorhanden ist, wird der Fallback-Server (ohne Agentur-Zuordnung) verwendet

```typescript
import { getMailServerForProject } from "@/lib/email/mailserver-service";

// Automatische Auswahl
const mailServer = await getMailServerForProject(projectId);
```

### 3. **Trigger-Typen**

#### **CONDITION_MET** - Bedingung erfüllt
Wird ausgelöst, wenn eine Bedingung erfüllt ist. Dies ist der Haupttrigger-Typ für alle Feld-Änderungen.

**Verfügbare Operatoren:**

- **SET**: Feld wurde gerade gesetzt (von leer → Wert)
  ```json
  {
    "field": "demoDate",
    "operator": "SET"
  }
  ```

- **EQUALS**: Feld hat einen bestimmten Wert
  ```json
  {
    "field": "materialStatus",
    "operator": "EQUALS",
    "value": "VOLLSTAENDIG"
  }
  ```

- **NOT_SET_AFTER_DAYS**: Feld wurde nach X Tagen noch nicht gesetzt
  ```json
  {
    "field": "scriptToClient",
    "checkField": "scriptApproved",
    "operator": "NOT_SET_AFTER_DAYS",
    "days": 7
  }
  ```

#### **DATE_REACHED** - Datum erreicht (Cron)
Wird über einen Cron-Job ausgelöst, wenn ein Datum erreicht wurde. Nicht für sofortige Auslösung bei Feld-Änderungen.

#### **MANUAL** - Manuell ausgelöst
Wird nur manuell durch einen Admin ausgelöst.

### 4. **Empfänger-Konfiguration**

```json
{
  "to": "CLIENT",
  "cc": ["AGENT", "FILMER"]
}
```

Mögliche Werte:
- **to**: `CLIENT`, `AGENT`, `FILMER`, `CUTTER`
- **cc**: Array mit beliebiger Kombination

**Hinweis**: E-Mail-Adressen werden automatisch aus dem Projekt aufgelöst.

### 5. **Template-Variablen**

Templates können folgende Variablen verwenden (werden automatisch ersetzt):

**Projekt:**
- `{{project.title}}` - Projekttitel
- `{{project.id}}` - Projekt-ID
- `{{project.status}}` - Projektstatus
- `{{project.webDate}}` - Web-Termin (formatiert)
- `{{project.demoDate}}` - Demo-Datum (formatiert)
- `{{project.agentName}}` - Name des zuständigen Agents

**Kunde:**
- `{{client.name}}` - Kundenname
- `{{client.customerNo}}` - Kundennummer
- `{{client.contact}}` - Kontaktperson
- `{{client.phone}}` - Telefonnummer

**Agent:**
- `{{agent.name}}` - Agent-Name
- `{{agent.email}}` - Agent-E-Mail
- `{{agent.categories}}` - Agent-Kategorien

**Website:**
- `{{website.domain}}` - Domain
- `{{website.webDate}}` - Web-Termin (formatiert)
- `{{website.demoDate}}` - Demo-Datum (formatiert)
- `{{website.demoLink}}` - Demo-Link

**Film:**
- `{{film.scope}}` - Umfang (z.B. FILM, VIDEO, FOTO)
- `{{film.status}}` - Film-Status
- `{{film.shootDate}}` - Dreh-/Fototermin (formatiert)
- `{{film.filmerName}}` - Name des Filmers
- `{{film.cutterName}}` - Name des Cutters
- `{{film.previewLink}}` - Link zur neuesten Vorabversion
- `{{film.previewDate}}` - Datum der neuesten Vorabversion (formatiert)
- `{{film.previewVersion}}` - Versionsnummer der neuesten Vorabversion (z.B. "1", "2")
- `{{film.finalLink}}` - Link zur Finalversion
- `{{film.onlineLink}}` - Online-Link

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

### 1. Demo-Termin gesetzt (Website) - **Sofortversand**

```json
{
  "name": "Demo-Termin gesetzt",
  "triggerType": "CONDITION_MET",
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

**Hinweis**: Weil `delayDays: 0`, wird bei dieser E-Mail ein **Bestätigungsdialog** angezeigt, bevor sie versendet wird.

### 1b. Material vollständig (Website) - **Sofortversand**

```json
{
  "name": "Material vollständig",
  "triggerType": "CONDITION_MET",
  "projectType": "WEBSITE",
  "conditions": {
    "field": "materialStatus",
    "operator": "EQUALS",
    "value": "VOLLSTAENDIG"
  },
  "delayDays": 0,
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
