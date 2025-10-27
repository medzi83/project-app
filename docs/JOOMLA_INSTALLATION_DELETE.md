# Joomla-Installations-Löschfunktion

## Übersicht

Die Löschfunktion ermöglicht Administratoren das vollständige Entfernen von Joomla-Installationen inklusive aller zugehörigen Daten (Dateien, Datenbank, Datensatz).

**Implementiert:** Januar 2025
**Zugriff:** Nur für Benutzer mit ADMIN-Role

---

## Features

### 1. Vollständige Löschung in 3 Schritten

Die Löschfunktion entfernt systematisch:

1. **Dateien auf dem Server** - Via SSH mit `rm -rf` Befehl
2. **MySQL-Datenbank** - Via Froxlor API
3. **Datensatz** - Aus der Projektverwaltungs-Datenbank

### 2. Atomare Operation

Der Datensatz wird **nur** gelöscht, wenn sowohl Dateien als auch Datenbank erfolgreich entfernt wurden. Dies verhindert "verwaiste" Installationen, bei denen Daten auf dem Server verbleiben, aber der Datensatz gelöscht ist.

### 3. Intelligente Fehlerbehandlung

- Erkennt bereits gelöschte Dateien/Datenbanken
- Detaillierte Fehlermeldungen für jeden Schritt
- Keine Datensatz-Löschung bei Fehlern
- Timeout-Schutz (30s für SSH-Verbindungen)

---

## Sicherheitsmaßnahmen

### Strikte Pfad-Validierung

Nur Pfade, die dem exakten Muster entsprechen, werden akzeptiert:

```
/var/customers/webs/KUNDENORDNER/INSTALLATIONSORDNER
```

**Beispiele für erlaubte Pfade:**
```
✅ /var/customers/webs/M443322/joomla
✅ /var/customers/webs/kunde123/demo
✅ /var/customers/webs/web42/htdocs
```

**Beispiele für blockierte Pfade:**
```
❌ /var/customers/webs/               -> Zu flach
❌ /var/customers/webs/kunde/sub/dir  -> Zu tief
❌ /home/user/website                 -> Falsches Basis-Verzeichnis
❌ /var/customers/webs/../../../etc   -> Path Traversal
```

### Validierungsregeln

1. **Pfad-Struktur:** Exakt 5 Ebenen (`var`, `customers`, `webs`, `KUNDE`, `INSTALLATION`)
2. **Path-Traversal-Schutz:** Keine `..` erlaubt
3. **Zeichensatz:** Nur `a-z`, `A-Z`, `0-9`, `_`, `-` in Ordnernamen
4. **Shell-Injection-Schutz:** Proper Escaping mit Single Quotes
5. **Regex-Pattern:** `/^\/var\/customers\/webs\/[^\/]+\/[^\/]+$/`

### Berechtigungen

- Nur Benutzer mit **ADMIN-Role** können Installationen löschen
- API-Endpunkt prüft Session und Role

---

## Technische Details

### API-Endpunkt

```
DELETE /api/admin/joomla-installations/[id]/delete
```

**Authentifizierung:** Session-basiert, nur für ADMIN
**Response:** JSON mit detaillierten Lösch-Informationen

### Response-Format

```typescript
{
  success: boolean;
  message: string;
  details: {
    filesDeleted: boolean;
    filesMessage: string;
    databaseDeleted: boolean;
    databaseMessage: string;
    recordDeleted: boolean;
  };
}
```

### Froxlor-Integration

Die Datenbank-Löschung verwendet die bewährte Methode:

1. Liste alle Datenbanken via `Mysqls.listing`
2. Finde Datenbank nach Name
3. Lösche mit `id` + `customerid` Parametern

```typescript
await froxlorClient.request('Mysqls.delete', {
  id: database.id,
  customerid: database.customerid,
});
```

### SSH-Verbindung

```typescript
// Verbindungsparameter
{
  host: server.sshHost,
  port: server.sshPort || 22,
  username: server.sshUsername,
  password: server.sshPassword,
  readyTimeout: 10000,
}
```

**Timeout:** 30 Sekunden für gesamte Operation

---

## UI-Komponente

### DeleteInstallationButton

**Pfad:** `app/clients/[id]/DeleteInstallationButton.tsx`

**Features:**
- Bestätigungs-Dialog mit ausführlicher Warnung
- Detaillierte Fortschrittsanzeige
- Farbcodierte Status-Icons (✓ grün, ✗ rot)
- Automatisches Reload nach Erfolg

**Warnung im Dialog:**

```
Diese Aktion wird folgendes löschen:
• Alle Dateien im Installationsverzeichnis
• Die zugehörige Datenbank
• Den Datensatz aus der Projektverwaltung

Diese Aktion kann nicht rückgängig gemacht werden!
```

---

## Behobene Bugs (während Entwicklung)

### 1. SSH-Feldname-Inkonsistenz

**Problem:** Code verwendete `sshUser`, aber Schema definiert `sshUsername`
**Lösung:** Alle Referenzen auf `sshUsername` geändert

### 2. Doppelte Slashes in Pfaden

**Problem:** `documentroot` endete mit `/`, führte zu `//` in Pfaden
**Lösung:**
- Normalisierung in `joomla-install/route.ts`
- Migration-Script für bestehende Daten (7 Installationen korrigiert)

### 3. Pfad-Validierung

**Problem:** Validierung erwartete 4 Ebenen, Pfade haben 5
**Lösung:** Korrektur auf 5 Ebenen mit klarer Dokumentation

### 4. Froxlor DB-Löschung

**Problem:** Verschiedene Parameter-Versuche scheiterten
**Lösung:** Bewährte Methode mit `id` + `customerid` implementiert

### 5. Atomare Operation

**Problem:** Datensatz wurde vor Dateien/DB gelöscht
**Lösung:** Datensatz wird nur bei erfolgreicher Löschung entfernt

---

## Verwendung

### Für Administratoren

1. Navigiere zur Client-Detailseite
2. Scrolle zu "Joomla Installationen"
3. Klicke auf "Löschen" Button (roter Button unterhalb der Installation)
4. Bestätige im Dialog mit "Ja, jetzt löschen"
5. Warte auf Bestätigung (detaillierte Anzeige der Schritte)
6. Seite lädt automatisch neu bei Erfolg

### Fehlerbehandlung

Wenn Fehler auftreten:
- **Dateien nicht gelöscht:** Prüfe SSH-Zugangsdaten im Server
- **Datenbank nicht gelöscht:** Prüfe Froxlor-API-Konfiguration
- **Datensatz bleibt:** Wird nicht gelöscht, um Datenverlust zu vermeiden

Nach Behebung des Problems kann der Löschvorgang erneut versucht werden.

---

## Code-Referenzen

### Hauptdateien

- **API-Route:** `app/api/admin/joomla-installations/[id]/delete/route.ts`
- **Froxlor-Client:** `lib/froxlor.ts` (Methode: `deleteDatabase()`)
- **UI-Komponente:** `app/clients/[id]/DeleteInstallationButton.tsx`
- **Integration:** `app/clients/[id]/page.tsx`

### Validierungsfunktion

```typescript
function validateDeletionPath(installPath: string): {
  valid: boolean;
  error?: string;
}
```

**Pfad:** `app/api/admin/joomla-installations/[id]/delete/route.ts:226`

---

## Testing

### Manuelle Tests durchgeführt

✅ Erfolgreiche Löschung (alle 3 Schritte)
✅ Bereits gelöschte Dateien werden erkannt
✅ Fehlerhafte Pfade werden blockiert
✅ Path-Traversal-Versuche werden verhindert
✅ Timeout-Handling bei SSH
✅ Froxlor-API-Integration
✅ Atomare Operation (kein Datensatz-Löschen bei Fehlern)

### Testfall: M443322/samstagnacht4

**Ergebnis:** Erfolgreich gelöscht
- Dateien: ✅ Via SSH entfernt
- Datenbank: ✅ Via Froxlor gelöscht (`M443322sql13`)
- Datensatz: ✅ Aus Projektverwaltung entfernt

---

## Weitere Verbesserungsmöglichkeiten

1. **Backup vor Löschung:** Optional Backup erstellen
2. **Bulk-Löschung:** Mehrere Installationen gleichzeitig
3. **Soft-Delete:** Markieren statt sofort löschen
4. **Audit-Log:** Protokollierung aller Löschvorgänge
5. **E-Mail-Benachrichtigung:** Admin-Benachrichtigung bei Löschung

---

## Changelog

### Version 1.0 (Januar 2025)

- ✅ Initiale Implementierung
- ✅ SSH-Integration für Dateien-Löschung
- ✅ Froxlor-Integration für DB-Löschung
- ✅ Umfassende Sicherheitsvalidierung
- ✅ UI-Komponente mit Bestätigung
- ✅ Atomare Operation
- ✅ Fehlerbehandlung und Logging
