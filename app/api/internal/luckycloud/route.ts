import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  listDirectory,
  uploadFile,
  deleteFile,
  getThumbnailLink,
  getDownloadLink,
  getUploadLink,
  getOrCreateShareLink,
  getShareLinkThumbnail,
  type LuckyCloudAgency,
  type LuckyCloudDirEntry,
} from '@/lib/luckycloud';

type Agency = 'eventomaxx' | 'vendoweb';

/**
 * Mapping von Agentur-Namen zu LuckyCloud-Agency-Keys
 */
function getAgencyKey(agencyName: string): Agency | null {
  const lowerName = agencyName.toLowerCase().trim();
  if (lowerName.startsWith('eventomaxx')) return 'eventomaxx';
  if (lowerName.startsWith('vendoweb')) return 'vendoweb';
  return null;
}

/**
 * Hilfsfunktion zur Authentifizierung der internen API
 */
function authenticateRequest(request: NextRequest): { authorized: boolean; errorResponse?: NextResponse } {
  const authHeader = request.headers.get('x-internal-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('INTERNAL_API_KEY ist nicht konfiguriert');
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Server nicht korrekt konfiguriert' },
        { status: 500 }
      ),
    };
  }

  if (!authHeader || authHeader !== expectedKey) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Nicht autorisiert' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Lädt Projekt- und Client-Informationen für LuckyCloud-Operationen
 */
async function loadProjectContext(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        include: {
          agency: true,
        },
      },
      website: true,
    },
  });

  if (!project) {
    return { error: 'Projekt nicht gefunden', status: 404 };
  }

  if (!project.client) {
    return { error: 'Kunde nicht gefunden', status: 404 };
  }

  if (!project.client.luckyCloudLibraryId) {
    return { error: 'Keine LuckyCloud-Bibliothek für den Kunden konfiguriert', status: 400 };
  }

  if (!project.client.agency) {
    return { error: 'Keine Agentur für den Kunden konfiguriert', status: 400 };
  }

  const agencyKey = getAgencyKey(project.client.agency.name);
  if (!agencyKey) {
    return { error: `Agentur "${project.client.agency.name}" ist nicht für LuckyCloud konfiguriert`, status: 400 };
  }

  if (!project.website?.luckyCloudFolderPath) {
    return { error: 'Kein Material-Ordner für das Projekt konfiguriert', status: 400 };
  }

  // Vollständigen Basis-Pfad berechnen
  const clientFolderPath = project.client.luckyCloudFolderPath || '';
  const projectFolderPath = project.website.luckyCloudFolderPath;
  const basePath = clientFolderPath
    ? `${clientFolderPath}${projectFolderPath}`
    : projectFolderPath;

  return {
    project,
    client: project.client,
    agency: project.client.agency,
    agencyKey,
    libraryId: project.client.luckyCloudLibraryId,
    basePath,
  };
}

/**
 * GET: Dateien in einem Ordner auflisten oder Thumbnail/Download-Link abrufen
 */
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.authorized) return auth.errorResponse!;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const folderName = searchParams.get('folderName'); // Unterordner relativ zum Projektordner
  const action = searchParams.get('action') || 'list'; // list, thumbnail, download, upload-link
  const filePath = searchParams.get('filePath'); // Für thumbnail/download
  const size = parseInt(searchParams.get('size') || '192', 10) as 48 | 96 | 192 | 256;

  if (!projectId) {
    return NextResponse.json({ success: false, error: 'projectId ist erforderlich' }, { status: 400 });
  }

  try {
    const context = await loadProjectContext(projectId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const { agencyKey, libraryId, basePath } = context;

    if (action === 'list') {
      // Vollständigen Pfad für den Unterordner berechnen
      const fullPath = folderName ? `${basePath}/${folderName}` : basePath;

      let entries: LuckyCloudDirEntry[];
      try {
        entries = await listDirectory(agencyKey, libraryId, fullPath);
      } catch (listError) {
        // Wenn der Ordner nicht existiert (404), leere Liste zurückgeben
        // Das ist normal für optionale Unterordner wie "ungeeignet"
        const errorMessage = listError instanceof Error ? listError.message : '';
        if (errorMessage.includes('404') || errorMessage.includes('nicht gefunden')) {
          return NextResponse.json({ success: true, entries: [] });
        }
        // Andere Fehler weiterwerfen
        throw listError;
      }

      // Thumbnails für Bilder hinzufügen
      const entriesWithThumbnails: (LuckyCloudDirEntry & { thumbnailUrl?: string })[] = [];
      for (const entry of entries) {
        if (entry.type === 'file' && isImageFile(entry.name)) {
          try {
            const thumbnailUrl = await getThumbnailLink(agencyKey, libraryId, `${fullPath}/${entry.name}`, 192);
            entriesWithThumbnails.push({ ...entry, thumbnailUrl });
          } catch {
            entriesWithThumbnails.push(entry);
          }
        } else {
          entriesWithThumbnails.push(entry);
        }
      }

      return NextResponse.json({ success: true, entries: entriesWithThumbnails });
    }

    if (action === 'thumbnail' && filePath) {
      const fullFilePath = `${basePath}/${filePath}`;
      const thumbnailUrl = await getThumbnailLink(agencyKey, libraryId, fullFilePath, size);
      return NextResponse.json({ success: true, thumbnailUrl });
    }

    if (action === 'download' && filePath) {
      const fullFilePath = `${basePath}/${filePath}`;
      const downloadUrl = await getDownloadLink(agencyKey, libraryId, fullFilePath);
      return NextResponse.json({ success: true, downloadUrl });
    }

    if (action === 'upload-link') {
      const fullPath = folderName ? `${basePath}/${folderName}` : basePath;
      const uploadUrl = await getUploadLink(agencyKey, libraryId, fullPath);
      return NextResponse.json({ success: true, uploadUrl, targetPath: fullPath });
    }

    // Share-Link für direkte Bildanzeige im Browser (kein Vercel-Proxy nötig)
    if (action === 'share-link' && filePath) {
      const fullFilePath = `${basePath}/${filePath}`;
      const type = searchParams.get('type') || 'full'; // 'full' oder 'thumbnail'

      if (type === 'thumbnail') {
        const url = await getShareLinkThumbnail(agencyKey, libraryId, fullFilePath, size);
        return NextResponse.json({ success: true, url });
      } else {
        const forceDownload = searchParams.get('download') === '1';
        const url = await getOrCreateShareLink(agencyKey, libraryId, fullFilePath, forceDownload);
        return NextResponse.json({ success: true, url });
      }
    }

    return NextResponse.json({ success: false, error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    console.error('Error in luckycloud GET:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * POST: Datei hochladen
 */
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const folderName = formData.get('folderName') as string;
    const file = formData.get('file') as File;

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId ist erforderlich' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'Keine Datei übergeben' }, { status: 400 });
    }

    const context = await loadProjectContext(projectId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const { agencyKey, libraryId, basePath } = context;
    const fullPath = folderName ? `${basePath}/${folderName}` : basePath;

    // Datei hochladen
    const arrayBuffer = await file.arrayBuffer();
    const result = await uploadFile(agencyKey, libraryId, fullPath, arrayBuffer, file.name);

    return NextResponse.json({ success: true, file: result });
  } catch (error) {
    console.error('Error in luckycloud POST:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Datei löschen
 */
export async function DELETE(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await request.json();
    const { projectId, folderName, fileName } = body;

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId ist erforderlich' }, { status: 400 });
    }

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName ist erforderlich' }, { status: 400 });
    }

    const context = await loadProjectContext(projectId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const { agencyKey, libraryId, basePath } = context;
    const fullPath = folderName ? `${basePath}/${folderName}/${fileName}` : `${basePath}/${fileName}`;

    await deleteFile(agencyKey, libraryId, fullPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in luckycloud DELETE:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * Hilfsfunktion: Prüft ob eine Datei ein Bild ist
 */
function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}
