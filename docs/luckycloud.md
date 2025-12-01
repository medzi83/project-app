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
│               ├── download/route.ts         # Download-Links
│               ├── thumbnail/route.ts        # Thumbnail-Links
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

### Thumbnail-Größen

Unterstützte Größen: `48`, `96`, `192`, `256` Pixel

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
