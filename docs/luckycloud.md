# LuckyCloud Integration

## Übersicht

Die LuckyCloud-Integration ermöglicht es, Dateien und Bilder für Kundenprojekte in der LuckyCloud zu speichern, anzuzeigen und zu verwalten. Dies betrifft insbesondere Material, das Kunden für ihre Projekte hochladen.

## Architektur

### Agenturen

Die Integration unterstützt mehrere Agenturen mit separaten LuckyCloud-Zugängen:

| Agentur | Status | URL |
|---------|--------|-----|
| Eventomaxx | Aktiv | `https://sync.luckycloud.de` (One/Teams-Plan) |
| Vendoweb | Geplant | Wird später eingerichtet |

### Dateien

```
projektverwaltung/
├── lib/
│   └── luckycloud.ts              # API-Service mit allen Funktionen
├── app/
│   ├── admin/
│   │   └── luckycloud/
│   │       ├── page.tsx           # Admin-Seite
│   │       ├── connection-test.tsx # Verbindungstest-Komponente
│   │       └── file-explorer.tsx  # Datei-Explorer mit Thumbnails & Bewertung
│   └── api/
│       └── admin/
│           └── luckycloud/
│               ├── test-connection/route.ts  # Verbindungstest
│               ├── libraries/route.ts        # Bibliotheken auflisten
│               ├── files/route.ts            # Verzeichnisse auflisten
│               ├── download/route.ts         # Download-Links (IP-gebunden, nur für Server)
│               ├── thumbnail/route.ts        # Thumbnail-Links (IP-gebunden, nur für Server)
│               ├── image/route.ts            # Image-Proxy (lädt Bilder server-seitig, Fallback)
│               ├── share-link/route.ts       # Share-Links (öffentlich, für Browser)
│               ├── delete/route.ts           # Dateien/Ordner löschen
│               └── comments/route.ts         # Datei-Kommentare (GET/POST/DELETE)
└── components/
    └── ui/
        ├── alert-dialog.tsx       # Für Löschen-Bestätigung
        ├── popover.tsx            # Für Hover-Bildvorschau
        └── dropdown-menu.tsx      # Für Bewertungs-Auswahl
```

## Umgebungsvariablen

```env
# Eventomaxx
LUCKYCLOUD_EVENTOMAXX_URL="https://sync.luckycloud.de"
LUCKYCLOUD_EVENTOMAXX_USERNAME="design-team@eventomaxx.de"
LUCKYCLOUD_EVENTOMAXX_PASSWORD="..."

# Vendoweb (später)
# LUCKYCLOUD_VENDOWEB_URL="https://sync.luckycloud.de"
# LUCKYCLOUD_VENDOWEB_USERNAME=""
# LUCKYCLOUD_VENDOWEB_PASSWORD=""
```

**Hinweis zur Domain:**
- `https://sync.luckycloud.de` - One/Teams-Plan
- `https://storage.luckycloud.de` - Business-Plan
- Enterprise hat individuelle Domains

## API-Service (`lib/luckycloud.ts`)

### Authentifizierung

```typescript
// Token wird automatisch gecacht (55 Minuten)
const token = await getAuthToken('eventomaxx');
```

Das Token wird im `Authorization: Token [API-KEY]` Header verwendet.

### Verfügbare Funktionen

| Funktion | Beschreibung |
|----------|--------------|
| `getAgencyConfig(agency)` | Holt Konfiguration aus Umgebungsvariablen |
| `isAgencyConfigured(agency)` | Prüft ob Agentur konfiguriert ist |
| `getAuthToken(agency)` | Holt Auth-Token (mit Cache) |
| `ping(agency)` | Verbindungstest ohne Auth |
| `authPing(agency)` | Verbindungstest mit Auth |
| `listLibraries(agency)` | Listet alle Bibliotheken/Repos |
| `listDirectory(agency, libraryId, path)` | Listet Verzeichnisinhalt |
| `getUploadLink(agency, libraryId, path)` | Erstellt Upload-Link |
| `uploadFile(agency, libraryId, path, file, filename)` | Lädt Datei hoch |
| `getDownloadLink(agency, libraryId, filePath)` | Erstellt Download-Link |
| `getThumbnailLink(agency, libraryId, filePath, size)` | Erstellt Thumbnail-Link |
| `deleteFile(agency, libraryId, filePath)` | Löscht eine Datei |
| `createDirectory(agency, libraryId, path)` | Erstellt Verzeichnis |
| `deleteDirectory(agency, libraryId, path)` | Löscht Verzeichnis |
| `getFileComments(agency, libraryId, filePath)` | Holt alle Kommentare einer Datei |
| `addFileComment(agency, libraryId, filePath, comment)` | Fügt Kommentar hinzu |
| `deleteFileComment(agency, libraryId, commentId)` | Löscht einen Kommentar |
| `getFileCommentCounts(agency, libraryId, path)` | Anzahl Kommentare im Verzeichnis |
| `getOrCreateShareLink(agency, libraryId, filePath, forceDownload?)` | Erstellt/holt Share-Link für Datei |
| `getShareLinkThumbnail(agency, libraryId, filePath, size)` | Thumbnail-URL über Share-Link |

### Typen

```typescript
type LuckyCloudAgency = 'eventomaxx' | 'vendoweb';

type LuckyCloudLibrary = {
  id: string;
  name: string;
  owner: string;
  owner_name: string;
  size: number;
  encrypted: boolean;
  permission: 'rw' | 'r';
  mtime: number;
  type: string;
};

type LuckyCloudDirEntry = {
  id: string;
  type: 'file' | 'dir';
  name: string;
  mtime: string;
  permission: string;
  size?: number;
  modifier_email?: string;
  modifier_name?: string;
};

type LuckyCloudComment = {
  id: number;
  repo_id: string;
  parent_path: string;
  item_name: string;
  comment: string;
  user_name: string;
  user_email: string;
  user_contact_email: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
  resolved: boolean;
};

type LuckyCloudShareLink = {
  token: string;
  link: string;
  repo_id: string;
  path: string;
  username: string;
  view_cnt: number;
  ctime: string;
  expire_date: string | null;
  is_expired: boolean;
  permissions: {
    can_edit: boolean;
    can_download: boolean;
  };
};
```

## LuckyCloud Web API

### Basis-Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `GET /api2/ping/` | Verbindungstest (ohne Auth) - Antwort: `"pong"` |
| `GET /api2/auth/ping/` | Verbindungstest (mit Auth) |
| `POST /api2/auth-token/` | Token abrufen |
| `GET /api2/repos/` | Alle Bibliotheken auflisten |

### Bibliothek-Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `GET /api2/repos/{repo_id}/dir/?p=/path` | Verzeichnis auflisten |
| `POST /api2/repos/{repo_id}/dir/?p=/path` | Verzeichnis erstellen (operation=mkdir) |
| `DELETE /api2/repos/{repo_id}/dir/?p=/path` | Verzeichnis löschen |

### Datei-Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `GET /api2/repos/{repo_id}/file/?p=/path` | Download-Link erhalten |
| `DELETE /api2/repos/{repo_id}/file/?p=/path` | Datei löschen |
| `GET /api2/repos/{repo_id}/upload-link/?p=/path` | Upload-Link erhalten |
| `GET /api2/repos/{repo_id}/thumbnail/?p=/path&size=96` | Thumbnail-Link |

### Kommentar-Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `GET /api2/repos/{repo_id}/file/comments/?p=/path` | Kommentare einer Datei abrufen |
| `POST /api2/repos/{repo_id}/file/comments/?p=/path` | Kommentar hinzufügen (Body: `{"comment": "..."}`) |
| `DELETE /api2/repos/{repo_id}/file/comments/{comment_id}/` | Kommentar löschen |
| `GET /api2/repos/{repo_id}/file/comments/counts/?p=/path` | Anzahl Kommentare im Verzeichnis |

### Share-Link-Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `GET /api/v2.1/share-links/?repo_id={id}&path={path}` | Existierende Share-Links für Datei abrufen |
| `POST /api/v2.1/share-links/` | Neuen Share-Link erstellen |

**Share-Link erstellen (POST Body):**
```json
{
  "repo_id": "library-id",
  "path": "/pfad/zur/datei.jpg",
  "permissions": {
    "can_edit": false,
    "can_download": true
  }
}
```

**Response:**
```json
{
  "token": "68eb576b77314939a488",
  "link": "https://sync.luckycloud.de/f/68eb576b77314939a488/",
  "repo_id": "...",
  "path": "/pfad/zur/datei.jpg",
  ...
}
```

### Thumbnail-Größen

Unterstützte Größen: `48`, `96`, `192`, `256` Pixel

## URL-Formate für Share-Links (WICHTIG!)

### Übersicht der URL-Typen

Seafile/LuckyCloud verwendet unterschiedliche URL-Pfade für verschiedene Zwecke:

| URL-Typ | Format | Verwendung |
|---------|--------|------------|
| **Datei Share-Link** | `/f/{token}/` | Einzelne Datei teilen |
| **Ordner Share-Link** | `/d/{token}/` | Ordner teilen |
| **Thumbnail** | `/thumbnail/{token}/{size}/{filename}` | Vorschaubilder |

### Datei-Share-Link URLs (`/f/{token}/`)

Für **einzelne Dateien** (Bilder, PDFs, etc.) wird das `/f/`-Format verwendet:

```
# Basis-URL (zeigt HTML-Vorschau-Seite)
https://sync.luckycloud.de/f/{token}/

# Direkte Bildanzeige im Browser (für <img src="...">)
https://sync.luckycloud.de/f/{token}/?raw=1

# Download erzwingen
https://sync.luckycloud.de/f/{token}/?dl=1
```

**Beispiel:**
```
Token: 68eb576b77314939a488

# Zeigt Bild direkt im Browser an:
https://sync.luckycloud.de/f/68eb576b77314939a488/?raw=1

# Erzwingt Download:
https://sync.luckycloud.de/f/68eb576b77314939a488/?dl=1
```

### Ordner-Share-Link URLs (`/d/{token}/`)

Für **Ordner** wird das `/d/`-Format verwendet:

```
# Basis-URL (zeigt Ordner-Inhalt)
https://sync.luckycloud.de/d/{token}/

# Datei im Ordner anzeigen (HTML-Seite, NICHT direktes Bild!)
https://sync.luckycloud.de/d/{token}/files/?p={filename}

# Download einer Datei im Ordner
https://sync.luckycloud.de/d/{token}/files/?p={filename}&dl=1
```

⚠️ **ACHTUNG:** Das `/d/{token}/files/?p=...` Format zeigt eine HTML-Seite, NICHT das Bild direkt! Für direkte Bildanzeige muss ein **Datei-Share-Link** (`/f/`) erstellt werden.

### Thumbnail URLs

Thumbnails funktionieren sowohl für Datei- als auch für Ordner-Share-Links:

```
# Thumbnail-URL (funktioniert für beide Typen)
https://sync.luckycloud.de/thumbnail/{token}/{size}/{filename}
```

**Unterstützte Größen:** `48`, `96`, `192`, `256` Pixel

**Beispiel:**
```
https://sync.luckycloud.de/thumbnail/68eb576b77314939a488/96/micha.png
```

### Unterschied: Download-Link vs. Share-Link

| Aspekt | Download-Link (`getDownloadLink`) | Share-Link (`getOrCreateShareLink`) |
|--------|-----------------------------------|-------------------------------------|
| **Gültigkeit** | Temporär, IP-gebunden | Permanent, öffentlich |
| **Funktioniert im Browser** | ❌ Nein (403 Forbidden) | ✅ Ja |
| **Vercel-Proxy nötig** | ✅ Ja | ❌ Nein |
| **Traffic über Vercel** | 100% der Dateigröße | 0% (nur JSON-Request) |
| **Verwendung** | Server-seitiges Laden | Client-seitiges Laden (img src) |

### Warum Share-Links statt Download-Links?

**Problem mit Download-Links:**
1. Vercel-Server holt Download-Link von LuckyCloud
2. Download-Link ist an die IP des Vercel-Servers gebunden
3. Browser (andere IP) versucht, den Link zu öffnen → **403 Forbidden**

**Lösung mit Share-Links:**
1. Vercel-Server erstellt/holt Share-Link (einmalig, wird gecacht)
2. Share-Link ist öffentlich und funktioniert von jeder IP
3. Browser lädt Bild direkt von LuckyCloud → **Kein Vercel-Traffic!**

### Implementierung in `lib/luckycloud.ts`

```typescript
// Share-Link für direkte Bildanzeige im Browser
const url = await getOrCreateShareLink(agency, libraryId, filePath);
// Ergebnis: https://sync.luckycloud.de/f/{token}/?raw=1

// Share-Link für Download
const downloadUrl = await getOrCreateShareLink(agency, libraryId, filePath, true);
// Ergebnis: https://sync.luckycloud.de/f/{token}/?dl=1

// Thumbnail über Share-Link
const thumbnailUrl = await getShareLinkThumbnail(agency, libraryId, filePath, 96);
// Ergebnis: https://sync.luckycloud.de/thumbnail/{token}/96/{filename}
```

### Token-Caching

Share-Link-Tokens werden 24 Stunden im Server-Memory gecacht:
- Reduziert API-Aufrufe an LuckyCloud
- Gleicher Token für Thumbnail und Vollbild einer Datei
- Cache-Key: `{agency}:{libraryId}:{filePath}`

## Admin-Oberfläche

### Navigation

Der Menüpunkt "Luckycloud" ist im Admin-Bereich unter `/admin/luckycloud` verfügbar.

### Features

1. **Verbindungstest**
   - Ping ohne/mit Authentifizierung
   - Anzahl gefundener Bibliotheken
   - Token-Vorschau

2. **Datei-Explorer**
   - Bibliotheken durchsuchen
   - Verzeichnisse navigieren (Breadcrumb)
   - Dateien anzeigen mit:
     - Mini-Thumbnails (32x32) direkt in der Liste
     - Hover-Vorschau mit größerem Bild
     - Bild-Dimensionen (Pixel) und Dateigröße
     - Dateiformat und Änderungsdatum
     - Icons für andere Dateitypen
   - Aktionen:
     - Vorschau (Bilder, PDFs)
     - Download
     - Löschen (mit Bestätigung)
     - Kommentare anzeigen/hinzufügen/löschen
     - Neuen Ordner erstellen (mit Option "Projektordner erstellen")

6. **Projektordner-Erstellung**
   - Checkbox "Projektordner erstellen" beim Anlegen eines neuen Ordners
   - Erstellt automatisch 7 Standard-Unterordner:
     - !Wichtig
     - BFSG
     - Fotos
     - Inhalte
     - Logo
     - QM Check
     - SEO+
   - Alle Unterordner werden parallel erstellt (schnell)

3. **Bilder-Bewertung**
   - Schnellbewertung direkt in der Dateiliste
   - "Geeignet" (grüner Daumen) - Bild ist verwendbar
   - "Nicht geeignet" (roter Daumen) - mit Begründung:
     - Auflösung zu gering
     - Bild unscharf
     - Motiv ungeeignet
     - Format falsch
     - Falsches Dateiformat
   - Bewertung wird als LuckyCloud-Kommentar gespeichert
   - Farbliche Badges zeigen Bewertung direkt am Bild

4. **Kommentar-System**
   - Nutzt native LuckyCloud/Seafile Kommentar-API
   - Kommentare werden direkt in der Dateiliste angezeigt
   - Dialog für erweiterte Kommentar-Verwaltung
   - Lazy-Loading der Kommentare beim Scrollen

5. **Ordnersuche**
   - Suchfeld in der Toolbar (nur bei geöffneter Bibliothek)
   - Prefix-Suche: Ordner die mit dem Suchbegriff beginnen
   - Wildcard-Unterstützung: `EM11002*` findet `EM11002-Projekt`
   - Sucht in Root und einer Unterebene (schnell)
   - Case-insensitive
   - Suchergebnisse zeigen Ordnername und Pfad
   - Klick auf Ergebnis navigiert direkt zum Ordner

7. **Auto-Load**
   - Bibliotheken werden automatisch beim Laden der Seite geladen
   - Optional: Standard-Bibliothek kann per `defaultLibraryId` vorkonfiguriert werden
   - Button-Text ändert sich zu "Aktualisieren" wenn bereits geladen

### Unterstützte Dateitypen

**Bilder (mit Thumbnail & Bewertung):**
- jpg, jpeg, png, gif, webp, bmp

**Vorschau möglich:**
- Alle Bildformate oben
- PDF

### Bewertungs-Kommentar-Format

Die Bilder-Bewertung wird als strukturierter Kommentar gespeichert:

| Bewertung | Kommentar-Text |
|-----------|----------------|
| Geeignet | `GEEIGNET` |
| Nicht geeignet | `NICHT GEEIGNET: [Begründung]` |

**Beispiele:**
- `GEEIGNET`
- `NICHT GEEIGNET: Auflösung zu gering`
- `NICHT GEEIGNET: Bild unscharf`

Diese Kommentare sind auch in der LuckyCloud Web-Oberfläche sichtbar.

## Zukünftige Erweiterungen

### Geplant

1. **Vendoweb-Integration**
   - Separater LuckyCloud-Zugang einrichten
   - Umgebungsvariablen konfigurieren

2. **Kundenportal-Integration**
   - Material-Upload direkt in LuckyCloud
   - Material-Anzeige aus LuckyCloud
   - Projekt-spezifische Ordnerstruktur

3. **Datenbankintegration**
   - Speichern von LuckyCloud-Referenzen (libraryId, filePath)
   - Verknüpfung mit Projekten/Kunden
   - Mögliches Schema-Update für WebDocumentation oder neues Model

### Schema-Überlegungen

```prisma
// Mögliche Erweiterung für Material-Referenzen
model CloudFile {
  id          String   @id @default(uuid())
  agency      String   // 'eventomaxx' | 'vendoweb'
  libraryId   String
  filePath    String
  fileName    String
  fileType    String   // 'image' | 'pdf' | 'document' | 'other'
  fileSize    Int?
  uploadedAt  DateTime @default(now())

  // Verknüpfungen
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id])
  clientId    String?
  client      Client?  @relation(fields: [clientId], references: [id])
}
```

## Fehlerbehebung

### Häufige Fehler

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| `401 Unauthorized` | Token ungültig/abgelaufen | Token-Cache wird automatisch erneuert |
| `403 Forbidden` | Keine Berechtigung | Benutzerrechte in LuckyCloud prüfen |
| `404 Not Found` | Pfad existiert nicht | Pfad überprüfen |
| `Thumbnail konnte nicht erstellt werden` | Kein Bild oder nicht unterstützt | Nur für Bilddateien verfügbar |

### Debug-Tipps

1. **Verbindung testen:** `/admin/luckycloud` -> "Verbindung testen"
2. **Token prüfen:** Token-Vorschau im Verbindungstest
3. **API-Logs:** `console.error` in den API-Routes

## Abhängigkeiten

```json
{
  "@radix-ui/react-alert-dialog": "^1.x.x",  // Für Löschen-Bestätigung
  "@radix-ui/react-popover": "^1.x.x",       // Für Hover-Bildvorschau
  "@radix-ui/react-dropdown-menu": "^2.x.x"  // Für Bewertungs-Dropdown
}
```

## Referenzen

- [LuckyCloud API Dokumentation](https://storage.luckycloud.de/published/api-dokumentation/home.md)
- Admin-Seite: `/admin/luckycloud`
- API-Service: `lib/luckycloud.ts`
