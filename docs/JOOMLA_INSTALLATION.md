# Joomla Automatische Installation - Dokumentation

## Übersicht

Das System ermöglicht die vollautomatische Installation einer Joomla-Basis auf beliebigen Froxlor-Servern. Die Installation erfolgt in 3 Schritten und nutzt einen zentralen Backup-Speicher (Vautron 6).

## Architektur

### Komponenten

1. **Storage Server (Vautron 6)**: `109.235.60.55`
   - Speicherort: `/var/customers/basis-backup/`
   - Enthält immer genau 1x `kickstart.php` und 1x `.jpa` Backup
   - Alte Backups werden automatisch gelöscht beim Upload neuer Dateien

2. **Ziel-Server**: Beliebiger Froxlor-Server
   - Muss SSH/SFTP-Zugriff haben
   - Muss Froxlor API-Zugriff haben
   - Kunde muss in Froxlor existieren

3. **Workflow-Server**: Next.js Backend
   - Orchestriert den gesamten Installationsprozess
   - Fungiert als Stream-Relay zwischen Vautron 6 und Ziel-Server

### Datenfluss

```
┌─────────────────┐
│   Vautron 6     │
│  (Storage)      │
│                 │
│ kickstart.php   │
│ backup.jpa      │
│ (105 MB)        │
└────────┬────────┘
         │
         │ SFTP Stream
         ▼
┌─────────────────┐
│  Next.js API    │
│  (Relay)        │
│                 │
│ Stream-Proxy    │
│ Keine Speicherung
└────────┬────────┘
         │
         │ SFTP Stream
         ▼
┌─────────────────┐
│  Ziel-Server    │
│  (Froxlor)      │
│                 │
│ /var/customers/ │
│ webs/E25065/    │
│ demo2024/       │
└─────────────────┘
```

## API-Routen

### 1. `/api/admin/joomla-backup/upload` (POST)

**Zweck**: Upload von kickstart.php oder .jpa zu Vautron 6

**Parameter**:
- `file`: File (FormData)
- `type`: "kickstart" | "backup"

**Prozess**:
1. Verbindung zu Vautron 6 via SFTP
2. Bei `type=backup`: Lösche alte .jpa/.zip Dateien
3. Upload der kompletten Datei (kein Chunking!)
4. Verbindung schließen

**Wichtig**: Keine Chunks! Direkt-Upload funktioniert lokal stabil.

**Code-Location**: `app/api/admin/joomla-backup/upload/route.ts`

---

### 2. `/api/admin/joomla-install` (POST)

**Zweck**: Installation vorbereiten - Dateien übertragen und Datenbank anlegen

**Parameter**:
```json
{
  "serverId": "string",
  "customerNo": "string",
  "folderName": "string",
  "dbPassword": "string"
}
```

**Prozess**:

1. **Validierung**:
   - Server existiert & hat Froxlor-Credentials
   - Kunde existiert in Froxlor
   - Datenbank-Limit nicht erreicht

2. **Datenbank erstellen**:
   - Froxlor API: `Databases.add`
   - Automatischer Name: z.B. `E25065sql1`
   - User = DB-Name
   - Passwort = vom User gewählt

3. **Backup-Datei ermitteln**:
   - Verbindung zu Vautron 6
   - Liste Dateien in `/var/customers/basis-backup/`
   - Finde `.jpa` oder `.zip` Datei

4. **Datei-Transfer** (KRITISCH!):

   ```typescript
   // SFTP-Verbindung 1: Vautron 6 (Source)
   await sftpStorage.connect({
     host: "109.235.60.55",
     readyTimeout: 60000
   });

   // SFTP-Verbindung 2: Ziel-Server (Target)
   await sftpTarget.connect({
     host: server.sshHost,
     readyTimeout: 60000,
     keepaliveInterval: 10000,
     keepaliveCountMax: 30
   });

   // Ordner erstellen
   await sftpTarget.mkdir(targetPath, true);

   // kickstart.php (klein, Buffer)
   const kickstartBuffer = await sftpStorage.get('/var/customers/basis-backup/kickstart.php');
   await sftpTarget.put(kickstartBuffer, `${targetPath}/kickstart.php`);

   // backup.jpa (groß, Stream)
   const sourceStream = await sftpStorage.get('/var/customers/basis-backup/backup.jpa');
   await sftpTarget.put(sourceStream, `${targetPath}/backup.jpa`);
   ```

5. **Berechtigungen setzen** (WICHTIG!):

   ```typescript
   // SSH-Client aus bestehender SFTP-Verbindung holen
   const sshClient = (sftpTarget as any).client;

   // Über GLEICHE Verbindung (keine neue!)
   sshClient.exec(`
     chown -R ${customer.loginname}:${customer.loginname} ${targetPath} &&
     chmod -R 775 ${targetPath} &&
     chmod 664 ${targetPath}/*.php ${targetPath}/*.jpa ${targetPath}/*.zip
   `);
   ```

   **WICHTIG**: Nutze die bestehende SSH-Verbindung von `sftpTarget`!
   Keine neue Verbindung öffnen → verhindert "Connection lost before handshake"

6. **Verbindungen schließen**:
   ```typescript
   await sftpStorage.end();
   await sftpTarget.end();
   ```

**Response**:
```json
{
  "success": true,
  "installUrl": "https://beispiel.de/demo2024/kickstart.php",
  "databaseName": "E25065sql1",
  "info": { ... }
}
```

**Code-Location**: `app/api/admin/joomla-install/route.ts`

---

### 3. `/api/admin/joomla-extract` (POST)

**Zweck**: Backup extrahieren und Joomla konfigurieren

**Parameter**:
```json
{
  "serverId": "string",
  "customerNo": "string",
  "folderName": "string",
  "installUrl": "string",
  "databaseName": "string",
  "databasePassword": "string"
}
```

**Prozess**:

1. **Kickstart Extraktion starten**:
   - POST zu `${installUrl}?json=1&task=startExtracting`
   - Startet Kickstart.php API

2. **Extraktions-Loop** (bis 100%):
   ```typescript
   while (!done) {
     POST zu ${installUrl}?json=1&task=stepExtracting

     Warte auf:
     - status: true
     - done: true
     - files: Anzahl extrahierter Dateien
   }
   ```

3. **Joomla Konfiguration erstellen**:
   - Generiere `configuration.php` mit DB-Zugangsdaten
   - Secret aus Environment (`JOOMLA_SECRET`)
   - Host: `localhost` (wichtig für MySQL Socket!)

4. **Post-Processing via SSH**:

   Bash-Script wird auf Ziel-Server ausgeführt:

   ```bash
   # 1. configuration.php hochladen

   # 2. Multi-Part SQL Import (Akeeba Backup)
   if [ -f site.sql ] && [ -f site.s01 ]; then
     # Kombiniere alle Teile
     cat site.sql site.s* > /tmp/combined.sql

     # Ersetze #__ mit echtem Prefix
     sed -i "s/#__/${DB_PREFIX}/g" /tmp/combined.sql

     # Import (Socket-Verbindung!)
     mysql -u ${dbName} -p'${dbPassword}' ${dbName} < /tmp/combined.sql
   fi

   # 3. installation/ Ordner löschen
   rm -rf installation

   # 4. kickstart.php + .jpa löschen
   rm -f kickstart.php *.jpa *.zip

   # 5. Owner setzen
   chown -R ${customer.loginname}:${customer.loginname} ${targetPath}
   ```

5. **In Datenbank speichern**:
   ```typescript
   await prisma.joomlaInstallation.create({
     data: {
       clientId, serverId, customerNo,
       folderName, installPath, installUrl,
       databaseName, databasePassword,
       standardDomain, filesExtracted, bytesProcessed
     }
   });
   ```

**Response**:
```json
{
  "success": true,
  "message": "Joomla installation erfolgreich extrahiert und konfiguriert",
  "filesExtracted": 12453,
  "bytesProcessed": 110234567
}
```

**Code-Location**: `app/api/admin/joomla-extract/route.ts`

---

## Häufige Probleme & Lösungen

### Problem 1: "Connection lost before handshake"

**Symptom**: Fehler beim `chown` Befehl nach erfolgreichem Upload

**Ursache**: Neue SSH-Verbindung wird geöffnet, nachdem SFTP geschlossen wurde

**Lösung**:
```typescript
// ❌ FALSCH: Neue SSH-Verbindung
const sshClient = new Client();
await sshClient.connect({ ... });

// ✅ RICHTIG: Bestehende SSH-Verbindung aus SFTP wiederverwenden
const sshClient = (sftpTarget as any).client;
```

**Code-Stelle**: `app/api/admin/joomla-install/route.ts:237`

---

### Problem 2: "ECONNRESET" beim Upload

**Symptom**: Upload bricht bei ~90% ab

**Ursache**:
- Chunked Upload mit mehreren SFTP-Verbindungen
- Timeout bei SSH cat-Befehl zum Kombinieren

**Lösung**: Direct Single-File Upload
```typescript
// ✅ Direkt-Upload ohne Chunks
await sftp.put(buffer, remotePath);

// oder für große Dateien: Stream
const sourceStream = await sftpStorage.get(sourcePath);
await sftpTarget.put(sourceStream, targetPath);
```

**Code-Stelle**: `app/api/admin/joomla-backup/upload/route.ts`

---

### Problem 3: MySQL Import schlägt fehl

**Symptom**: Datenbank leer nach Installation

**Mögliche Ursachen**:

1. **Falscher MySQL Host**:
   ```php
   // ❌ FALSCH
   public $host = '127.0.0.1';

   // ✅ RICHTIG (nutzt Unix Socket)
   public $host = 'localhost';
   ```

2. **Multi-Part SQL nicht kombiniert**:
   - Akeeba erstellt `site.sql + site.s01 + site.s02 + ...`
   - Müssen zu einer Datei kombiniert werden
   - `#__` Prefix muss ersetzt werden

3. **Tabellenprefix falsch**:
   ```bash
   # Prefix aus databases.json lesen
   DB_PREFIX=$(grep -oP '"prefix"\s*:\s*"\K[^"]+' databases.json)
   sed -i "s/#__/${DB_PREFIX}/g" combined.sql
   ```

**Code-Stelle**: `app/api/admin/joomla-extract/route.ts:195-234`

---

### Problem 4: "Prisma Client validation error"

**Symptom**: `Unknown field 'joomlaInstallations'`

**Ursache**: Prisma Client nicht neu generiert nach Schema-Änderung

**Lösung**:
```bash
npx prisma generate
```

---

### Problem 5: Vercel Deployment Fehler

**Symptom**:
- "Request Entity Too Large" bei Upload
- "ENOENT" bei Dateisystem-Zugriff

**Ursache**: Vercel Limitierungen:
- 4.5 MB Body-Limit
- Read-only Filesystem (außer `/tmp`)

**Lösung**:
1. **Body-Limit erhöhen**:
   ```typescript
   // next.config.ts
   experimental: {
     serverActions: {
       bodySizeLimit: '200mb'
     }
   }
   ```

2. **Kein lokales Filesystem verwenden**:
   - Alle Dateien direkt zu Vautron 6
   - Kein Temp-Ordner in `./storage`

**Hinweis**: Großer File-Upload (105 MB) funktioniert nur lokal, nicht auf Vercel!

---

## Datenbank-Schema

```prisma
model JoomlaInstallation {
  id               String   @id @default(cuid())
  clientId         String
  client           Client   @relation(...)
  serverId         String
  server           Server   @relation(...)
  customerNo       String
  folderName       String
  installPath      String   // z.B. /var/customers/webs/E25065/demo2024
  installUrl       String   // z.B. https://beispiel.de/demo2024
  databaseName     String
  databasePassword String
  standardDomain   String
  filesExtracted   Int?
  bytesProcessed   BigInt?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**Abruf**:
- Admin-Übersicht: `/admin/joomla-installations`
- Im Kundendatenblatt: `/clients/[id]` (inkludiert automatisch)

---

## Sicherheitshinweise

### Passwörter

1. **Auto-Generierung**:
   - 10 Zeichen
   - Mind. 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl
   - Randomisiert beim Laden von Schritt 3

2. **Speicherung**:
   - Datenbank-Passwort wird in Klartext gespeichert
   - Nur für Admins sichtbar
   - Notwendig für spätere Wartung

3. **SSH/SFTP Credentials**:
   - In `Server` Model gespeichert
   - Werden für jeden Transfer verwendet

### Dateiberechtigungen

```bash
# Ordner: 775 (rwxrwxr-x)
chmod -R 775 ${targetPath}

# Dateien: 664 (rw-rw-r--)
chmod 664 ${targetPath}/*.php ${targetPath}/*.jpa

# Owner: Froxlor-Kunde
chown -R ${customer.loginname}:${customer.loginname} ${targetPath}
```

**Wichtig**: Owner MUSS auf Froxlor-Kunde gesetzt werden, sonst kann PHP nicht schreiben!

---

## Monitoring & Debugging

### Logging

Alle wichtigen Schritte werden geloggt:

```typescript
console.log(`✓ Saved Joomla installation to database for client ${client.name}`);
console.error("ERROR: Post-processing failed:", error);
```

**Log-Locations**:
- Development: Terminal wo `npm run dev` läuft
- Production (Vercel): Vercel Dashboard → Functions → Logs

### Typische Log-Sequenz

```
POST /api/admin/joomla-install
→ Validating server and customer...
→ Creating database E25065sql1...
→ Connecting to Vautron 6...
→ Connecting to target server...
→ Uploading kickstart.php...
→ Streaming backup.jpa (105 MB)...
→ Setting permissions...
✓ Installation prepared

POST /api/admin/joomla-extract
→ Starting extraction...
→ Step 1/45 (2%)
→ Step 23/45 (51%)
→ Step 45/45 (100%)
→ Extraction complete
→ Uploading configuration.php...
→ Running post-processing...
→ Importing database...
✓ Imported multi-part database
✓ Removed installation folder
✓ Saved to database
→ Installation complete
```

### Fehlersuche

1. **SFTP-Probleme**:
   ```bash
   # Test SFTP-Verbindung manuell
   sftp -P 22 username@server.de
   ```

2. **Froxlor API-Probleme**:
   - Prüfe API-Key/Secret in `/admin/server`
   - Teste API-Verbindung in Basisinstallation Step 1

3. **Datei-Permissions**:
   ```bash
   # SSH auf Server
   ssh username@server.de

   # Prüfe Owner
   ls -la /var/customers/webs/E25065/demo2024/

   # Sollte sein: E25065:E25065
   ```

---

## Performance

### Durchschnittliche Zeiten

- **Upload zu Vautron 6** (105 MB): ~60-90 Sekunden
- **Transfer Vautron 6 → Ziel**: ~2-3 Minuten (Stream)
- **Extraktion** (12.000 Dateien): ~2-4 Minuten
- **Post-Processing** (DB Import): ~30-60 Sekunden

**Gesamt**: ~5-8 Minuten für komplette Installation

### Optimierungen

1. **Stream statt Buffer**:
   - Große Dateien (>.jpa) werden gestreamt
   - Keine Speicherung im RAM
   - Konstanter Memory-Footprint

2. **Persistente SSH-Verbindungen**:
   - Eine Verbindung für Upload + chown
   - Keepalive verhindert Timeouts

3. **Parallele Checks**:
   - Alle Server werden parallel geprüft (Step 1)
   - Async/await Promises

---

## Zukünftige Verbesserungen

### Geplant

- [ ] Backup-Versionierung auf Vautron 6
- [ ] Rollback-Funktion
- [ ] Installation-Status-Updates (WebSocket/SSE)
- [ ] Bulk-Installation (mehrere Kunden)
- [ ] Alternative zu Vercel Blob Storage für große Dateien

### Nicht empfohlen

- ❌ Chunked Upload (instabil bei großen Dateien)
- ❌ Lokales Filesystem auf Vercel (read-only)
- ❌ Mehrere SSH-Verbindungen nacheinander (Timeout-Probleme)

---

## Wartung

### Backup auf Vautron 6 aktualisieren

1. Gehe zu `/admin/joomla-backup`
2. Upload neue `kickstart.php` (wird nie überschrieben)
3. Upload neue `.jpa` (alte wird automatisch gelöscht)

### Installationsdaten abrufen

**Admin-Übersicht**:
```
/admin/joomla-installations
```

**Im Kundendatenblatt**:
```
/clients/[id]
→ Sektion "Joomla Installationen"
```

Zeigt:
- Installationspfad
- URL
- Datenbank-Name & Passwort
- Server
- Datum

---

## Support & Troubleshooting

Bei Problemen:

1. **Logs prüfen**: Terminal oder Vercel Dashboard
2. **Diese Dokumentation**: Häufige Probleme
3. **SSH-Test**: Manuelle Verbindung testen
4. **Froxlor API**: In Step 1 testen

**Kritische Dateien**:
- `app/api/admin/joomla-install/route.ts`
- `app/api/admin/joomla-extract/route.ts`
- `app/api/admin/joomla-backup/upload/route.ts`
- `prisma/schema.prisma` (JoomlaInstallation Model)
