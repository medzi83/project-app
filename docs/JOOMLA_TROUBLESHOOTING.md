# Joomla Installation - Troubleshooting

## Performance-Probleme

### Problem: 2-Minuten-Delay vor Backup-Transfer

**Symptom**: Nach Upload von `kickstart.php` wartet das System ~2 Minuten, bevor der Transfer der `.jpa` Datei startet

**Ursache**: Fehlende SSH-Keepalive-Einstellungen

**Lösung**:
```typescript
// ✅ Mit Keepalive
await sftpStorage.connect({
  host: storageServer.sshHost,
  readyTimeout: 60000,
  keepaliveInterval: 10000,  // Alle 10 Sekunden
  keepaliveCountMax: 30
});
```

**Weitere Optimierung** - Server-Erkennung:
```typescript
if (isSameServer) {
  // Lokaler cp-Befehl (4 Sekunden!)
  conn.exec(`cp ${sourcePath} ${targetPath}`);
} else {
  // SFTP-Stream (30-45 Sekunden)
  await pipeline(readStream, writeStream);
}
```

**Code**: `app/api/admin/joomla-install/route.ts:212-213`, `230-270`

---

## Verbindungs-Probleme

### Problem: "Connection lost before handshake"

**Symptom**: Fehler beim `chown` Befehl nach erfolgreichem Upload

**Ursache**: Neue SSH-Verbindung wird geöffnet, nachdem SFTP geschlossen wurde

**Lösung**:
```typescript
// ✅ RICHTIG: Bestehende SSH-Verbindung wiederverwenden
const sshClient = (sftpTarget as any).client;
```

**Code**: `app/api/admin/joomla-install/route.ts:237`

---

### Problem: "ECONNRESET" beim Upload

**Symptom**: Upload bricht bei ~90% ab

**Ursache**: Chunked Upload mit mehreren SFTP-Verbindungen

**Lösung**:
```typescript
// ✅ Direkt-Upload ohne Chunks
await sftp.put(buffer, remotePath);
```

**Code**: `app/api/admin/joomla-backup/upload/route.ts`

---

## Datenbank-Probleme

### Problem: Error 500 nach erfolgreicher Installation

**Symptom**: Installation erfolgreich abgeschlossen, Datenbank gefüllt, aber Webseite zeigt Error 500

**Ursache**: Falsches MySQL Host-Format in `configuration.php` für non-default MySQL Ports

**Lösung**: Seit v2.2.6 automatisch behoben. Der Host wird nun korrekt formatiert:

```php
// ✅ RICHTIG für MariaDB 10.5 (Port 3307)
public $host = '127.0.0.1:3307';

// ✅ RICHTIG für Default MySQL (Port 3306)
public $host = 'localhost';  // KEIN Port für default 3306
```

**Manuelle Korrektur** (falls alte Installation):
1. SSH auf Server: `ssh kunde@server.de`
2. Datei bearbeiten: `nano /var/customers/webs/KUNDE/ordner/configuration.php`
3. Zeile ändern: `public $host = '127.0.0.1:3307';` (für MariaDB 10.5)
4. Speichern und Seite neu laden

**Code-Referenz**: `app/api/admin/joomla-extract/route.ts:230-237`

---

### Problem: MySQL Import schlägt fehl

**Symptom**: Datenbank leer nach Installation

**Mögliche Ursachen**:

#### 1. Multi-Part SQL nicht kombiniert
Akeeba erstellt `site.sql + site.s01 + site.s02 + ...`. Diese müssen kombiniert werden:

```bash
cat site.sql site.s* > /tmp/combined.sql
sed -i "s/#__/${DB_PREFIX}/g" /tmp/combined.sql
mysql -u dbname -p'password' dbname < /tmp/combined.sql
```

#### 2. Tabellenprefix falsch
```bash
DB_PREFIX=$(grep -oP '"prefix"\s*:\s*"\K[^"]+' databases.json)
```

#### 3. Falsche MySQL-Verbindungsparameter
Für MariaDB 10.5 muss `-h` und `-P` explizit angegeben werden:
```bash
# ✅ RICHTIG für MariaDB 10.5
mysql -h 127.0.0.1 -P 3307 -u dbname -p'password' dbname < dump.sql

# ✅ RICHTIG für Default (nutzt Unix Socket)
mysql -u dbname -p'password' dbname < dump.sql
```

**Code**: `app/api/admin/joomla-extract/route.ts:296-344`

---

## Pfad-Probleme

### Problem: Doppelte Slashes in Pfaden (`//`)

**Symptom**:
- Pfade haben `//`: `/var/customers/webs/M443322//folder/`
- Löschen schlägt fehl wegen Pfad-Validierung

**Ursache**: `customer.documentroot` endet mit `/`, beim Anhängen von `/${folderName}` entsteht `//`

**Lösung**:
```typescript
// ✅ Normalisierung vorher
const normalizedDocRoot = customer.documentroot.replace(/\/+$/, '');
const targetPath = `${normalizedDocRoot}/${folderName}`;
```

**Code-Stellen**:
- `app/api/admin/joomla-extract/route.ts:147-148`
- `app/api/admin/joomla-install/route.ts:162-163`
- `app/api/admin/joomla-installations/[id]/delete/route.ts:244-245`

**Hinweis**: Lösch-Funktion normalisiert automatisch → alte Installationen mit `//` können gelöscht werden

---

## Build & Deployment

### Problem: TypeScript-Fehler bei Vercel

**Symptome**:
- `Parameter 'err' implicitly has an 'any' type`
- `'customer.documentroot' is possibly 'undefined'`

**Lösung**:
```typescript
// ✅ Explizite Type-Annotationen
readStream.on('error', (err: Error) => { ... });

// ✅ Validierung vor Verwendung
if (!customer.documentroot) {
  return NextResponse.json({ error: "..." }, { status: 400 });
}
```

---

### Problem: "Prisma Client validation error"

**Symptom**: `Unknown field 'joomlaInstallations'`

**Ursache**: Prisma Client nicht neu generiert

**Lösung**:
```bash
npx prisma generate
```

---

### Problem: Vercel Deployment Fehler

**Symptom**: "Request Entity Too Large" oder "ENOENT"

**Ursache**: Vercel Limitierungen
- 4.5 MB Body-Limit
- Read-only Filesystem (außer `/tmp`)

**Lösung**:
```typescript
// next.config.ts
experimental: {
  serverActions: {
    bodySizeLimit: '200mb'
  }
}
```

**Wichtig**: Großer File-Upload (105 MB) funktioniert nur lokal, **nicht auf Vercel**!

---

## Debug-Tipps

### Logging aktivieren
Alle wichtigen Schritte werden geloggt:
```
✓ Same server detected - using direct cp for faster transfer
✓ Files copied locally on server
✓ .htaccess already configured from backup
✓ Saved Joomla installation to database
```

### SSH-Verbindung testen
```bash
sftp -P 22 username@server.de
```

### Froxlor API testen
In der App unter `/admin/basisinstallation` → Step 1

### Dateiberechtigungen prüfen
```bash
ssh username@server.de
ls -la /var/customers/webs/E25065/installation/
# Sollte sein: E25065:E25065
```

---

## Weiterführende Links

- **[Quick Start](./README_JOOMLA.md)** - Schnelleinstieg
- **[Technische Doku](./JOOMLA_TECHNICAL.md)** - API-Details
- **[Installation löschen](./JOOMLA_INSTALLATION_DELETE.md)** - Lösch-Prozess
