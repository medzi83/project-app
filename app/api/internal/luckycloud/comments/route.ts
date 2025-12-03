import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFileComments,
  addFileComment,
  type LuckyCloudAgency,
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
    agencyKey: agencyKey as LuckyCloudAgency,
    libraryId: project.client.luckyCloudLibraryId,
    basePath,
  };
}

/**
 * GET: Kommentare für eine Datei abrufen
 *
 * Query-Parameter:
 * - projectId: ID des Projekts
 * - filePath: Pfad zur Datei relativ zum Projektordner (z.B. "Startseite/bild.jpg")
 */
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.authorized) return auth.errorResponse!;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const filePath = searchParams.get('filePath');

  if (!projectId) {
    return NextResponse.json({ success: false, error: 'projectId ist erforderlich' }, { status: 400 });
  }

  if (!filePath) {
    return NextResponse.json({ success: false, error: 'filePath ist erforderlich' }, { status: 400 });
  }

  try {
    const context = await loadProjectContext(projectId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const { agencyKey, libraryId, basePath } = context;
    const fullFilePath = `${basePath}/${filePath}`;

    const comments = await getFileComments(agencyKey, libraryId, fullFilePath);

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('Error in luckycloud comments GET:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * POST: Kommentar zu einer Datei hinzufügen
 *
 * Body:
 * - projectId: ID des Projekts
 * - filePath: Pfad zur Datei relativ zum Projektordner (z.B. "Startseite/bild.jpg")
 * - comment: Der Kommentartext
 */
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await request.json();
    const { projectId, filePath, comment } = body;

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId ist erforderlich' }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ success: false, error: 'filePath ist erforderlich' }, { status: 400 });
    }

    if (!comment) {
      return NextResponse.json({ success: false, error: 'comment ist erforderlich' }, { status: 400 });
    }

    const context = await loadProjectContext(projectId);
    if ('error' in context) {
      return NextResponse.json({ success: false, error: context.error }, { status: context.status });
    }

    const { agencyKey, libraryId, basePath } = context;
    const fullFilePath = `${basePath}/${filePath}`;

    const newComment = await addFileComment(agencyKey, libraryId, fullFilePath, comment);

    return NextResponse.json({
      success: true,
      comment: newComment,
    });
  } catch (error) {
    console.error('Error in luckycloud comments POST:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
