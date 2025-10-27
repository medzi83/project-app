# Joomla Installation - Technische Dokumentation

## Architektur

### Server-Setup
1. **Vautron 6** (`109.235.60.55`) - Backup-Storage
2. **Ziel-Server** - Beliebiger Froxlor-Server
3. **Next.js API** - Orchestrierung

### Intelligente Optimierung
- **Gleicher Server**: Direkter `cp` Befehl (4 Sek)
- **Unterschiedliche Server**: SFTP-Stream mit 2MB Chunks (30-45 Sek)

## API-Endpunkte

### 1. `/api/admin/joomla-install` (POST)

**Funktion**: Dateien übertragen und Datenbank anlegen

**Request**:
```json
{
  "serverId": "string",
  "customerNo": "string",
  "folderName": "string",
  "dbPassword": "string"
}
```

**Prozess**:
1. Server & Kunde validieren
2. Datenbank in Froxlor anlegen
3. Dateien übertragen:
   - **Gleicher Server**: `cp /backup/path /target/path` (4 Sek)
   - **Unterschiedlicher Server**: SFTP-Stream (30-45 Sek)
4. Berechtigungen setzen (`chown`, `chmod`)

**Response**:
```json
{
  "success": true,
  "installUrl": "https://domain.de/folder/kickstart.php",
  "databaseName": "E25065sql1"
}
```

**Code**: `app/api/admin/joomla-install/route.ts`

---

### 2. `/api/admin/joomla-extract` (POST)

**Funktion**: Backup extrahieren und konfigurieren

**Request**:
```json
{
  "serverId": "string",
  "customerNo": "string",
  "folderName": "string",
  "installUrl": "string",
  "databaseName": "string",
  "databasePassword": "string",
  "clientId": "string",
  "projectId": "string|null"
}
```

**Prozess**:
1. **Extraktion** via Kickstart.php API (40-45 Sek)
2. **Post-Processing** via SSH:
   - `htaccess.bak` → `.htaccess` umbenennen
   - `configuration.php` mit DB-Credentials aktualisieren
   - SQL-Dump importieren (Multi-Part Support)
   - `installation/` Ordner löschen
   - Backup-Dateien löschen
   - Owner setzen
3. **In DB speichern**: `JoomlaInstallation` Record erstellen

**Response**:
```json
{
  "success": true,
  "filesExtracted": 12453,
  "bytesProcessed": 110234567
}
```

**Code**: `app/api/admin/joomla-extract/route.ts`

---

## Wichtige Code-Stellen

### Server-Erkennung (Zeile 230-270)
```typescript
const isSameServer = storageServer.sshHost === server.sshHost ||
                     storageServer.ip === server.ip;

if (isSameServer) {
  // Lokaler cp-Befehl (schnell!)
  conn.exec(`cp ${sourcePath} ${targetPath}`);
} else {
  // SFTP-Stream (langsamer)
  await pipeline(readStream, writeStream);
}
```

### Pfad-Normalisierung (Zeile 147-148)
```typescript
// Verhindert doppelte Slashes (//)
const normalizedDocRoot = customer.documentroot.replace(/\/+$/, '');
const targetPath = `${normalizedDocRoot}/${folderName}`;
```

### SSH-Keepalive (Zeile 212-213)
```typescript
// Verhindert 2-Minuten-Delay
keepaliveInterval: 10000,  // Alle 10 Sekunden
keepaliveCountMax: 30
```

## Datenbank-Schema

```prisma
model JoomlaInstallation {
  id               String   @id @default(cuid())
  clientId         String
  serverId         String
  customerNo       String
  folderName       String
  installPath      String   // /var/customers/webs/E25065/demo2024
  installUrl       String   // https://beispiel.de/demo2024
  databaseName     String
  databasePassword String
  standardDomain   String
  filesExtracted   Int?
  bytesProcessed   BigInt?
  projectId        String?  // Optional: Verknüpfung mit Projekt
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

## Performance-Optimierungen

1. **Server-Erkennung**: Lokaler `cp` statt SFTP (~4 Sek vs. ~30 Sek)
2. **SSH-Keepalive**: Verhindert 2-Minuten-Delay
3. **Stream-Chunks**: 2MB statt 256KB für besseren Durchsatz
4. **Keine redundanten Uploads**: .htaccess aus Backup, kein separater Upload

## Sicherheit

### Pfad-Validierung
```typescript
// Pattern: /var/customers/webs/[customer]/[installation]
const pathPattern = /^\/var\/customers\/webs\/[^\/]+\/[^\/]+$/;

// Normalisierung: // → /
const normalizedPath = path.replace(/\/+/g, '/');
```

### Berechtigungen
```bash
chown -R customer:customer /path
chmod -R 775 /path          # Ordner
chmod 664 /path/*.php       # Dateien
```

## Weiterführende Dokumentation

- **[Quick Start](./README_JOOMLA.md)** - Schnelleinstieg
- **[Troubleshooting](./JOOMLA_TROUBLESHOOTING.md)** - Problemlösungen
- **[Installation löschen](./JOOMLA_INSTALLATION_DELETE.md)** - Lösch-Prozess
