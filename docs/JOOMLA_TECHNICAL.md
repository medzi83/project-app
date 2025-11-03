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
  "dbPassword": "string",
  "mysqlServerId": "number"
}
```

**Prozess**:
1. Server & Kunde validieren
2. **MySQL-Server-Auswahl** (seit Version 2.2.6):
   - Benutzer wählt MySQL-Server im UI aus (Default oder MariaDB 10.5)
   - Verwendet `mysqlServerId` Parameter für die Datenbankerstellung via Froxlor API
   - API-Parameter: `mysql_server` (Froxlor 2.x, siehe [FROXLOR_2X_MIGRATION.md](./FROXLOR_2X_MIGRATION.md))
3. Datenbank in Froxlor anlegen (auf ausgewähltem DB-Server)
4. Dateien übertragen:
   - **Gleicher Server**: `cp /backup/path /target/path` (4 Sek)
   - **Unterschiedlicher Server**: SFTP-Stream (30-45 Sek) mit Timeout (5 Min)
5. Berechtigungen setzen (`chown`, `chmod`) mit Timeout (30 Sek)

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
  "projectId": "string|null",
  "mysqlServerId": "number"
}
```

**Prozess**:
1. **MySQL-Server ermitteln** (seit Version 2.2.6):
   - Verwendet den vom Benutzer ausgewählten MySQL-Server (`mysqlServerId`)
   - Lädt Host und Port von Froxlor für die MySQL-Verbindung
   - Host wird für `configuration.php` formatiert (siehe Punkt 3)
2. **Extraktion** via Kickstart.php API (40-45 Sek)
3. **Post-Processing** via SSH:
   - `htaccess.bak` → `.htaccess` umbenennen
   - `configuration.php` mit DB-Credentials und Host aktualisieren:
     - Non-default Ports: `public $host = '127.0.0.1:3307';` (MariaDB 10.5)
     - Default Port: `public $host = 'localhost';` (Default MySQL)
   - SQL-Dump importieren mit korrektem Host/Port (Multi-Part Support)
   - `installation/` Ordner löschen
   - Backup-Dateien löschen
   - Owner setzen
4. **In DB speichern**: `JoomlaInstallation` Record erstellen

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
model DatabaseServer {
  id                  String   @id @default(cuid())
  serverId            String
  name                String
  version             String
  host                String   @default("localhost")
  port                Int?     @default(3306)
  froxlorDbServerId   Int?     // Froxlor DB-Server ID (neu in v2.2.2)
  isDefault           Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

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
5. **Smart MySQL Connection**: Verwendet Socket für localhost:3306, TCP für andere Hosts/Ports
6. **Timeouts** (seit Version 2.2.2):
   - File Transfer: 5 Minuten
   - Permission Setting: 30 Sekunden
   - Verhindert hängende Requests bei langsamen Verbindungen
7. **MySQL Host Formatierung** (seit v2.2.6):
   - Non-default Ports: Host enthält Port (`127.0.0.1:3307`)
   - Default Port 3306: Nur Hostname (`localhost`)
   - Verhindert Error 500 bei Joomla mit MariaDB 10.5
   - **Code**: `app/api/admin/joomla-extract/route.ts:230-237`

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
- **[Froxlor 2.x Migration](./FROXLOR_2X_MIGRATION.md)** - API-Änderungen bei Upgrade auf Froxlor 2.x
