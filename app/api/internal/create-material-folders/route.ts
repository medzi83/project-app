import { NextRequest, NextResponse } from 'next/server';
import { createMaterialFoldersForProject } from '@/lib/luckycloud-material-folders';

/**
 * Interner API-Endpunkt für die Erstellung von Material-Ordnern.
 * Wird vom Kundenportal nach der Webdoku-Bestätigung aufgerufen.
 *
 * Authentifizierung erfolgt über einen gemeinsamen geheimen Schlüssel.
 */
export async function POST(request: NextRequest) {
  // Geheimen Schlüssel prüfen
  const authHeader = request.headers.get('x-internal-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('INTERNAL_API_KEY ist nicht konfiguriert');
    return NextResponse.json(
      { success: false, error: 'Server nicht korrekt konfiguriert' },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== expectedKey) {
    return NextResponse.json(
      { success: false, error: 'Nicht autorisiert' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'projectId ist erforderlich' },
        { status: 400 }
      );
    }

    // Material-Ordner erstellen
    const result = await createMaterialFoldersForProject(projectId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in create-material-folders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
