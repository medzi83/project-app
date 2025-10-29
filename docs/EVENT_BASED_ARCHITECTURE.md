# Event-basierte Architektur für Dialog-Trigger

## Übersicht

Die Projektverwaltung verwendet ein **event-basiertes System** anstelle von Polling, um Dialoge zu triggern. Dies sorgt für bessere Performance, weniger Ressourcenverbrauch und eine sofortige Reaktion auf Benutzeraktionen.

## Motivation

**Vorher (Polling-basiert):**
- ❌ Hintergrund-Prozesse liefen kontinuierlich (alle 2 Sekunden)
- ❌ Unnötige API-Calls auch wenn keine Änderungen vorlagen
- ❌ Verzögerung zwischen Aktion und Dialog (bis zu 2 Sekunden)
- ❌ Ressourcenverschwendung durch ständiges Polling
- ❌ Komplexe State-Verwaltung (Polling-Counter, Timeouts, etc.)

**Jetzt (Event-basiert):**
- ✅ Keine Hintergrund-Prozesse
- ✅ API-Calls nur bei tatsächlichen Änderungen
- ✅ Sofortige Reaktion auf Benutzeraktionen
- ✅ Ressourcenschonend
- ✅ Einfache Event-Listener

## Architektur

### 1. Installation-Zuweisung bei Demo-Termin

Wenn ein Benutzer ein Demo-Datum setzt, muss geprüft werden, ob dem Projekt bereits eine Joomla-Installation zugewiesen ist.

#### Flow:

```
User setzt demoDate
    ↓
inline-actions.ts prüft:
  - Installation vorhanden?
  - Nein → needsInstallationCheck = true
    ↓
InlineCell dispatcht Event:
  "checkInstallation" mit projectId
    ↓
InstallationCheckHandler reagiert:
  - Lädt verfügbare Installationen
  - Öffnet Dialog
    ↓
User wählt Installation
    ↓
assign-installation API:
  - Weist Installation zu
  - Prüft Email-Trigger
  - Gibt queueIds zurück
    ↓
InstallationAssignmentDialog:
  - Schließt sich
  - Dispatcht "emailConfirmationNeeded" Event
    ↓
EmailConfirmationHandler:
  - Öffnet Email-Dialog
```

#### Code-Beispiel:

**inline-actions.ts:**
```typescript
// Prüfen ob Installation fehlt
if (nextValue && !oldValue) {
  const existingInstallation = await prisma.joomlaInstallation.findFirst({
    where: { projectId: id },
  });

  if (!existingInstallation) {
    needsInstallationCheck = true;
  }
}

// Email-Trigger nur wenn Installation NICHT fehlt
if (!needsInstallationCheck) {
  const queueIds = await processTriggers(id, { demoDate: value }, { demoDate: null });
  if (queueIds.length > 0) {
    emailTriggered = true;
    emailQueueIds = queueIds;
  }
}
```

**InlineCell.tsx:**
```typescript
const result = await updateInlineField(fd);

// Installation-Check Event
if (result?.needsInstallationCheck && result?.projectId) {
  const event = new CustomEvent("checkInstallation", {
    detail: { projectId: result.projectId },
  });
  window.dispatchEvent(event);
  return;
}

// Email-Confirmation Event
if (result?.emailTriggered && result?.queueIds) {
  const event = new CustomEvent("emailConfirmationNeeded", {
    detail: { queueIds: result.queueIds },
  });
  window.dispatchEvent(event);
  return;
}
```

**InstallationCheckHandler.tsx:**
```typescript
useEffect(() => {
  const handleInstallationCheck = async (event: Event) => {
    const customEvent = event as InstallationCheckEvent;
    const { projectId } = customEvent.detail;

    const res = await fetch(`/api/projects/check-installation?projectId=${projectId}`);
    const data = await res.json();

    if (data.needsAssignment) {
      setIsDialogOpen(true);
      // ... show dialog
    }
  };

  window.addEventListener("checkInstallation", handleInstallationCheck);
  return () => window.removeEventListener("checkInstallation", handleInstallationCheck);
}, []);
```

### 2. Email-Bestätigung bei Termin-Eingabe

Wenn ein Benutzer ein Datum setzt (webDate, demoDate, etc.) und Email-Trigger konfiguriert sind, wird ein Email-Bestätigungs-Dialog geöffnet.

#### Flow:

```
User setzt Datum (z.B. webDate)
    ↓
inline-actions.ts:
  - processTriggers() prüft Email-Trigger
  - Gibt queueIds zurück
    ↓
InlineCell dispatcht Event:
  "emailConfirmationNeeded" mit queueIds
    ↓
EmailConfirmationHandler reagiert:
  - Prüft fehlende Kundendaten
  - Öffnet Pre-Dialog (falls Daten fehlen)
  - Oder: Öffnet Email-Dialog direkt
```

#### Code-Beispiel:

**EmailConfirmationHandler.tsx:**
```typescript
useEffect(() => {
  const handleEmailConfirmationNeeded = (event: Event) => {
    const customEvent = event as CustomEvent<{ queueIds: string[] }>;
    const { queueIds: newQueueIds } = customEvent.detail;

    if (newQueueIds && newQueueIds.length > 0) {
      setQueueIds(newQueueIds);
      setClientDataChecked(false);
      setMissingClientData(null);
    }
  };

  window.addEventListener("emailConfirmationNeeded", handleEmailConfirmationNeeded);
  return () => window.removeEventListener("emailConfirmationNeeded", handleEmailConfirmationNeeded);
}, []);
```

## Events

### checkInstallation

**Zweck:** Triggert die Installation-Zuweisung für ein Projekt

**Payload:**
```typescript
{
  projectId: string;
}
```

**Wird getriggert von:** `InlineCell.tsx` (wenn demoDate gesetzt wird und keine Installation vorhanden ist)

**Wird empfangen von:** `InstallationCheckHandler.tsx`

### emailConfirmationNeeded

**Zweck:** Triggert die Email-Bestätigung für wartende Emails

**Payload:**
```typescript
{
  queueIds: string[];
}
```

**Wird getriggert von:**
- `InlineCell.tsx` (bei direktem Email-Trigger)
- `InstallationAssignmentDialog.tsx` (nach Installation-Zuweisung)

**Wird empfangen von:** `EmailConfirmationHandler.tsx`

## Sequentielle Dialog-Verarbeitung

Ein wichtiger Aspekt ist die **sequentielle Verarbeitung** von Dialogen. Wenn beide Bedingungen zutreffen (Installation fehlt UND Email-Trigger), müssen die Dialoge nacheinander geöffnet werden:

1. **Installation-Dialog** öffnet sich zuerst
2. User weist Installation zu
3. Installation-Dialog schließt sich
4. **Email-Dialog** öffnet sich (mit der neu zugewiesenen Installation-URL)

### Warum sequentiell?

Die Email-Templates verwenden die Variable `{{website.demoLink}}`, die auf die Installation-URL verweist. Wenn die Installation noch nicht zugewiesen ist, wäre diese Variable leer. Daher MUSS die Installation-Zuweisung VOR dem Email-Dialog erfolgen.

### Implementierung:

**inline-actions.ts:**
```typescript
// Wenn Installation fehlt, Email-Trigger überspringen
if (!needsInstallationCheck) {
  // Email-Trigger nur ausführen wenn Installation bereits vorhanden
  const queueIds = await processTriggers(...);
}
```

**assign-installation API:**
```typescript
// Nach erfolgreicher Installation-Zuweisung
await prisma.joomlaInstallation.update({ ... });

// JETZT Email-Trigger ausführen
if (project.website?.demoDate) {
  const queueIds = await processTriggers(...);
  return { success: true, queueIds };
}
```

**InstallationAssignmentDialog:**
```typescript
// Nach Speichern
const result = await fetch("/api/projects/assign-installation", { ... });

// Dialog schließen
onClose();

// Email-Event triggern (falls queueIds vorhanden)
if (result.queueIds?.length > 0) {
  window.dispatchEvent(new CustomEvent("emailConfirmationNeeded", {
    detail: { queueIds: result.queueIds }
  }));
}
```

## Vorteile

1. **Performance:** Keine unnötigen API-Calls oder Hintergrund-Prozesse
2. **Reaktivität:** Sofortige Reaktion auf Benutzeraktionen (keine Polling-Verzögerung)
3. **Ressourcen:** Deutlich geringere CPU- und Netzwerk-Last
4. **Wartbarkeit:** Einfachere Event-Listener statt komplexer Polling-Logik
5. **Skalierbarkeit:** System skaliert besser mit mehr gleichzeitigen Benutzern
6. **User Experience:** Dialoge öffnen sich instant, nicht nach Verzögerung

## Migration von Polling zu Events

Falls weitere Polling-Mechanismen existieren, sollten diese nach diesem Muster umgestellt werden:

### Schritt 1: Event definieren
```typescript
type MyCustomEvent = CustomEvent<{ data: string }>;
```

### Schritt 2: Event triggern
```typescript
const event = new CustomEvent("myEvent", {
  detail: { data: "value" }
});
window.dispatchEvent(event);
```

### Schritt 3: Event-Listener hinzufügen
```typescript
useEffect(() => {
  const handler = (event: Event) => {
    const customEvent = event as MyCustomEvent;
    // Handle event
  };

  window.addEventListener("myEvent", handler);
  return () => window.removeEventListener("myEvent", handler);
}, []);
```

### Schritt 4: Polling-Code entfernen
- `setInterval` Calls entfernen
- Polling-State-Variablen entfernen
- Cleanup-Logic vereinfachen

## Best Practices

1. **Event-Namen:** Verwende beschreibende Namen im camelCase (z.B. `emailConfirmationNeeded`)
2. **Payload-Types:** Definiere TypeScript-Types für Event-Payloads
3. **Cleanup:** Entferne immer Event-Listener im useEffect cleanup
4. **Error Handling:** Wrappe Event-Handler in try-catch
5. **Dokumentation:** Dokumentiere alle Events mit Zweck, Payload und Verwendung
6. **Testing:** Teste Event-Flows manuell und automatisiert

## Zukünftige Erweiterungen

Weitere Bereiche die von Event-basierter Architektur profitieren könnten:

- **Real-time Updates:** WebSocket-Events für Projekt-Updates
- **Notifications:** Event-basierte Benachrichtigungen
- **State Synchronization:** Cross-Tab-Kommunikation via BroadcastChannel
- **Undo/Redo:** Event-sourcing für User-Aktionen

## Fazit

Die Migration von Polling zu Events hat die Projektverwaltung deutlich effizienter gemacht. Das System ist jetzt:
- Schneller (instant statt 2s Verzögerung)
- Ressourcenschonender (keine Hintergrund-Prozesse)
- Wartbarer (einfachere Code-Struktur)
- Skalierbarer (weniger Server-Last)

Diese Architektur sollte als Standard für alle zukünftigen Dialog-Trigger und Echtzeit-Updates verwendet werden.
