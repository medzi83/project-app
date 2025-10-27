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

### Problem: MySQL Import schlägt fehl

**Symptom**: Datenbank leer nach Installation

**Mögliche Ursachen**:

#### 1. Falscher MySQL Host
```php
// ❌ FALSCH
public $host = '127.0.0.1';

// ✅ RICHTIG (nutzt Unix Socket)
public $host = 'localhost';
```

#### 2. Multi-Part SQL nicht kombiniert
Akeeba erstellt `site.sql + site.s01 + site.s02 + ...`. Diese müssen kombiniert werden:

```bash
cat site.sql site.s* > /tmp/combined.sql
sed -i "s/#__/${DB_PREFIX}/g" /tmp/combined.sql
mysql -u dbname -p'password' dbname < /tmp/combined.sql
```

#### 3. Tabellenprefix falsch
```bash
DB_PREFIX=$(grep -oP '"prefix"\s*:\s*"\K[^"]+' databases.json)
```

**Code**: `app/api/admin/joomla-extract/route.ts:210-284`

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
