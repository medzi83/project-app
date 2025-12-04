/**
 * LuckyCloud API Service
 *
 * Diese Bibliothek stellt Funktionen für die Interaktion mit der LuckyCloud Web API bereit.
 * Dokumentation: https://storage.luckycloud.de/published/api-dokumentation/home.md
 *
 * Unterstützte Agenturen:
 * - eventomaxx: https://storage.luckycloud.de (Business-Plan)
 * - vendoweb: Wird später eingerichtet
 */

export type LuckyCloudAgency = 'eventomaxx' | 'vendoweb';

type LuckyCloudConfig = {
  url: string;
  username: string;
  password: string;
};

// Token-Cache um wiederholte Authentifizierung zu vermeiden
const tokenCache: Map<LuckyCloudAgency, { token: string; expiresAt: number }> = new Map();
const TOKEN_CACHE_DURATION = 55 * 60 * 1000; // 55 Minuten (Token sind 1h gültig)

/**
 * Holt die Konfiguration für eine Agentur aus den Umgebungsvariablen
 */
export function getAgencyConfig(agency: LuckyCloudAgency): LuckyCloudConfig | null {
  if (agency === 'eventomaxx') {
    const url = process.env.LUCKYCLOUD_EVENTOMAXX_URL;
    const username = process.env.LUCKYCLOUD_EVENTOMAXX_USERNAME;
    const password = process.env.LUCKYCLOUD_EVENTOMAXX_PASSWORD;

    if (!url || !username || !password) {
      return null;
    }

    return { url, username, password };
  }

  if (agency === 'vendoweb') {
    const url = process.env.LUCKYCLOUD_VENDOWEB_URL;
    const username = process.env.LUCKYCLOUD_VENDOWEB_USERNAME;
    const password = process.env.LUCKYCLOUD_VENDOWEB_PASSWORD;

    if (!url || !username || !password) {
      return null;
    }

    return { url, username, password };
  }

  return null;
}

/**
 * Prüft ob eine Agentur konfiguriert ist
 */
export function isAgencyConfigured(agency: LuckyCloudAgency): boolean {
  return getAgencyConfig(agency) !== null;
}

/**
 * Holt ein Authentifizierungs-Token von der LuckyCloud API
 */
export async function getAuthToken(agency: LuckyCloudAgency): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(agency);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const response = await fetch(`${config.url}/api2/auth-token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: config.username,
      password: config.password,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Authentifizierung fehlgeschlagen: ${response.status} - ${text}`);
  }

  const data = await response.json();

  if (!data.token) {
    throw new Error('Kein Token in der Antwort enthalten');
  }

  // Cache the token
  tokenCache.set(agency, {
    token: data.token,
    expiresAt: Date.now() + TOKEN_CACHE_DURATION,
  });

  return data.token;
}

/**
 * Führt einen Ping ohne Authentifizierung durch
 */
export async function ping(agency: LuckyCloudAgency): Promise<boolean> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  try {
    const response = await fetch(`${config.url}/api2/ping/`);
    const text = await response.text();
    return text.trim() === '"pong"' || text.trim() === 'pong';
  } catch {
    return false;
  }
}

/**
 * Führt einen authentifizierten Ping durch
 */
export async function authPing(agency: LuckyCloudAgency): Promise<boolean> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  try {
    const token = await getAuthToken(agency);
    const response = await fetch(`${config.url}/api2/auth/ping/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    });
    const text = await response.text();
    return text.trim() === '"pong"' || text.trim() === 'pong';
  } catch {
    return false;
  }
}

/**
 * Typen für LuckyCloud Libraries (Repos)
 */
export type LuckyCloudLibrary = {
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

/**
 * Listet alle verfügbaren Bibliotheken auf
 */
export async function listLibraries(agency: LuckyCloudAgency): Promise<LuckyCloudLibrary[]> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const response = await fetch(`${config.url}/api2/repos/`, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bibliotheken konnten nicht geladen werden: ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * Typen für Dateien und Verzeichnisse
 */
export type LuckyCloudDirEntry = {
  id: string;
  type: 'file' | 'dir';
  name: string;
  mtime: string;
  permission: string;
  size?: number;
  modifier_email?: string;
  modifier_name?: string;
  modifier_contact_email?: string;
};

/**
 * Listet den Inhalt eines Verzeichnisses auf
 */
export async function listDirectory(
  agency: LuckyCloudAgency,
  libraryId: string,
  path: string = '/'
): Promise<LuckyCloudDirEntry[]> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/dir/`);
  url.searchParams.set('p', path);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Verzeichnis konnte nicht geladen werden: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.dirent_list || data;
}

/**
 * Erstellt einen Upload-Link für eine Bibliothek
 */
export async function getUploadLink(
  agency: LuckyCloudAgency,
  libraryId: string,
  path: string = '/'
): Promise<string> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/upload-link/`);
  url.searchParams.set('p', path);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload-Link konnte nicht erstellt werden: ${response.status} - ${text}`);
  }

  // Die API gibt den Link als JSON-String zurück (mit Anführungszeichen)
  const uploadLink = await response.text();
  // Entferne Anführungszeichen falls vorhanden
  return uploadLink.replace(/^"|"$/g, '');
}

/**
 * Lädt eine Datei hoch
 */
export async function uploadFile(
  agency: LuckyCloudAgency,
  libraryId: string,
  path: string,
  file: File | Blob | ArrayBuffer,
  filename: string
): Promise<{ name: string; id: string; size: number }> {
  const uploadLink = await getUploadLink(agency, libraryId, path);

  const formData = new FormData();
  const blob = file instanceof ArrayBuffer ? new Blob([file]) : file;
  formData.append('file', blob, filename);
  formData.append('parent_dir', path);

  const response = await fetch(uploadLink, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Datei konnte nicht hochgeladen werden: ${response.status} - ${text}`);
  }

  // Seafile gibt bei erfolgreichem Upload einen Text mit der Datei-ID zurück (nicht JSON)
  const responseText = await response.text();
  // Die Antwort ist z.B. "\"abc123\"" oder nur "abc123"
  const fileId = responseText.replace(/^"|"$/g, '').trim();

  // Datei-Größe aus dem Blob ermitteln
  const fileSize = blob instanceof Blob ? blob.size : (file as ArrayBuffer).byteLength;

  return {
    name: filename,
    id: fileId,
    size: fileSize,
  };
}

/**
 * Holt einen Download-Link für eine Datei
 */
export async function getDownloadLink(
  agency: LuckyCloudAgency,
  libraryId: string,
  filePath: string
): Promise<string> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/file/`);
  url.searchParams.set('p', filePath);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Download-Link konnte nicht erstellt werden: ${response.status} - ${text}`);
  }

  // Die API gibt den Link als JSON-String zurück (mit Anführungszeichen)
  const downloadLink = await response.text();
  // Entferne Anführungszeichen falls vorhanden
  return downloadLink.replace(/^"|"$/g, '');
}

/**
 * Verschiebt eine Datei in ein anderes Verzeichnis
 */
export async function moveFile(
  agency: LuckyCloudAgency,
  libraryId: string,
  srcFilePath: string,
  dstDir: string,
  dstLibraryId?: string
): Promise<void> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/file/`);
  url.searchParams.set('p', srcFilePath);

  const body: Record<string, string> = {
    operation: 'move',
    dst_repo: dstLibraryId || libraryId, // dst_repo ist immer erforderlich
    dst_dir: dstDir,
  };

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
    redirect: 'manual', // Wichtig: 301 nicht automatisch folgen
  });

  // Seafile API gibt 301 MOVED PERMANENTLY bei Erfolg zurück
  // oder 200/201 bei manchen Implementierungen
  if (response.status !== 301 && response.status !== 200 && response.status !== 201) {
    const responseText = await response.text();
    throw new Error(`Datei konnte nicht verschoben werden: ${response.status} - ${responseText}`);
  }
}

/**
 * Löscht eine Datei
 */
export async function deleteFile(
  agency: LuckyCloudAgency,
  libraryId: string,
  filePath: string
): Promise<void> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/file/`);
  url.searchParams.set('p', filePath);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Datei konnte nicht gelöscht werden: ${response.status} - ${text}`);
  }
}

/**
 * Erstellt ein Verzeichnis
 */
export async function createDirectory(
  agency: LuckyCloudAgency,
  libraryId: string,
  path: string
): Promise<void> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/dir/`);
  url.searchParams.set('p', path);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      operation: 'mkdir',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Verzeichnis konnte nicht erstellt werden: ${response.status} - ${text}`);
  }
}

/**
 * Löscht ein Verzeichnis
 */
export async function deleteDirectory(
  agency: LuckyCloudAgency,
  libraryId: string,
  path: string
): Promise<void> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/dir/`);
  url.searchParams.set('p', path);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Verzeichnis konnte nicht gelöscht werden: ${response.status} - ${text}`);
  }
}

/**
 * Holt einen Thumbnail-Link für eine Bilddatei
 * Unterstützte Größen: 48, 96, 192, 256 (Pixel)
 */
export async function getThumbnailLink(
  agency: LuckyCloudAgency,
  libraryId: string,
  filePath: string,
  size: 48 | 96 | 192 | 256 = 96
): Promise<string> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/thumbnail/`);
  url.searchParams.set('p', filePath);
  url.searchParams.set('size', String(size));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Thumbnail konnte nicht erstellt werden: ${response.status} - ${text}`);
  }

  // Die API gibt den Link als JSON-String zurück (mit Anführungszeichen)
  const thumbnailLink = await response.text();
  // Entferne Anführungszeichen falls vorhanden
  return thumbnailLink.replace(/^"|"$/g, '');
}

/**
 * Typen für Datei-Kommentare
 */
export type LuckyCloudComment = {
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

/**
 * Holt alle Kommentare für eine Datei
 */
export async function getFileComments(
  agency: LuckyCloudAgency,
  libraryId: string,
  filePath: string
): Promise<LuckyCloudComment[]> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/file/comments/`);
  url.searchParams.set('p', filePath);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kommentare konnten nicht geladen werden: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.comments || data || [];
}

/**
 * Fügt einen Kommentar zu einer Datei hinzu
 */
export async function addFileComment(
  agency: LuckyCloudAgency,
  libraryId: string,
  filePath: string,
  comment: string
): Promise<LuckyCloudComment> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/file/comments/`);
  url.searchParams.set('p', filePath);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ comment }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kommentar konnte nicht hinzugefügt werden: ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * Löscht einen Kommentar
 */
export async function deleteFileComment(
  agency: LuckyCloudAgency,
  libraryId: string,
  commentId: number
): Promise<void> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = `${config.url}/api2/repos/${libraryId}/file/comments/${commentId}/`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kommentar konnte nicht gelöscht werden: ${response.status} - ${text}`);
  }
}

/**
 * Holt die Anzahl der Kommentare für Dateien in einem Verzeichnis
 */
export async function getFileCommentCounts(
  agency: LuckyCloudAgency,
  libraryId: string,
  path: string = '/'
): Promise<Record<string, number>> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const token = await getAuthToken(agency);
  const url = new URL(`${config.url}/api2/repos/${libraryId}/file/comments/counts/`);
  url.searchParams.set('p', path);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    // Bei 404 oder anderen Fehlern leeres Objekt zurückgeben
    return {};
  }

  const data = await response.json();
  return data || {};
}

/**
 * Typen für Share-Links
 */
export type LuckyCloudShareLink = {
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

// Cache für Share-Link-Tokens (nicht die volle URL, damit wir forceDownload dynamisch anwenden können)
const shareLinkTokenCache: Map<string, { token: string; expiresAt: number }> = new Map();
const SHARE_LINK_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Stunden

/**
 * Erstellt oder holt einen existierenden Share-Link für eine Datei
 * Share-Links sind permanente, öffentlich zugängliche URLs die direkt im Browser funktionieren
 *
 * @param forceDownload - Wenn true, wird dl=1 angehängt (erzwingt Download). Standard: false (Anzeige im Browser)
 */
export async function getOrCreateShareLink(
  agency: LuckyCloudAgency,
  libraryId: string,
  filePath: string,
  forceDownload: boolean = false
): Promise<string> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const fileName = filePath.split('/').pop() || filePath;

  // Helper-Funktion um URL aus Token zu generieren
  const buildUrl = (shareToken: string) => {
    const dlParam = forceDownload ? '&dl=1' : '';
    return `${config.url}/d/${shareToken}/files/?p=${encodeURIComponent(fileName)}${dlParam}`;
  };

  // Cache-Key aus allen Parametern (ohne forceDownload, da wir nur den Token cachen)
  const cacheKey = `${agency}:${libraryId}:${filePath}`;
  const cached = shareLinkTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return buildUrl(cached.token);
  }

  const authToken = await getAuthToken(agency);

  // Erst prüfen ob bereits ein Share-Link existiert
  const existingToken = await findExistingShareLinkToken(config.url, authToken, libraryId, filePath);
  if (existingToken) {
    // Cache aktualisieren
    shareLinkTokenCache.set(cacheKey, {
      token: existingToken,
      expiresAt: Date.now() + SHARE_LINK_CACHE_DURATION,
    });
    return buildUrl(existingToken);
  }

  // Neuen Share-Link erstellen
  const createUrl = `${config.url}/api/v2.1/share-links/`;
  const response = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Token ${authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      repo_id: libraryId,
      path: filePath,
      permissions: {
        can_edit: false,
        can_download: true,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Share-Link konnte nicht erstellt werden: ${response.status} - ${text}`);
  }

  const data: LuckyCloudShareLink = await response.json();

  // Cache aktualisieren (nur Token speichern)
  shareLinkTokenCache.set(cacheKey, {
    token: data.token,
    expiresAt: Date.now() + SHARE_LINK_CACHE_DURATION,
  });

  return buildUrl(data.token);
}

/**
 * Sucht nach einem existierenden Share-Link für eine Datei und gibt den Token zurück
 */
async function findExistingShareLinkToken(
  baseUrl: string,
  authToken: string,
  libraryId: string,
  filePath: string
): Promise<string | null> {
  try {
    const url = new URL(`${baseUrl}/api/v2.1/share-links/`);
    url.searchParams.set('repo_id', libraryId);
    url.searchParams.set('path', filePath);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Token ${authToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const links: LuckyCloudShareLink[] = await response.json();
    if (links && links.length > 0) {
      return links[0].token;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Holt einen Thumbnail-Link über Share-Link (direkt im Browser nutzbar)
 * Seafile stellt Thumbnails auch für Share-Links bereit
 */
export async function getShareLinkThumbnail(
  agency: LuckyCloudAgency,
  libraryId: string,
  filePath: string,
  size: 48 | 96 | 192 | 256 = 96
): Promise<string> {
  const config = getAgencyConfig(agency);
  if (!config) {
    throw new Error(`LuckyCloud ist für Agentur "${agency}" nicht konfiguriert`);
  }

  const fileName = filePath.split('/').pop() || '';
  const cacheKey = `${agency}:${libraryId}:${filePath}`;

  // Prüfe Cache
  const cached = shareLinkTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return `${config.url}/thumbnail/${cached.token}/${size}/${encodeURIComponent(fileName)}`;
  }

  const authToken = await getAuthToken(agency);

  // Erst prüfen ob bereits ein Share-Link existiert
  let shareToken = await findExistingShareLinkToken(config.url, authToken, libraryId, filePath);

  if (!shareToken) {
    // Neuen Share-Link erstellen
    const createUrl = `${config.url}/api/v2.1/share-links/`;
    const response = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${authToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        repo_id: libraryId,
        path: filePath,
        permissions: {
          can_edit: false,
          can_download: true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Share-Link konnte nicht erstellt werden`);
    }

    const data: LuckyCloudShareLink = await response.json();
    shareToken = data.token;
  }

  // Token cachen
  shareLinkTokenCache.set(cacheKey, {
    token: shareToken,
    expiresAt: Date.now() + SHARE_LINK_CACHE_DURATION,
  });

  // Thumbnail-URL für Share-Link
  return `${config.url}/thumbnail/${shareToken}/${size}/${encodeURIComponent(fileName)}`;
}
