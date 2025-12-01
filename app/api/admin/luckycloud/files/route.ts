import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  listDirectory,
  createDirectory,
  isAgencyConfigured,
  type LuckyCloudAgency
} from '@/lib/luckycloud';

export async function GET(request: NextRequest) {
  // Auth check
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const agency = request.nextUrl.searchParams.get('agency') as LuckyCloudAgency;
  const libraryId = request.nextUrl.searchParams.get('libraryId');
  const path = request.nextUrl.searchParams.get('path') || '/';

  if (!agency || !['eventomaxx', 'vendoweb'].includes(agency)) {
    return NextResponse.json({ error: 'Ungültige Agentur' }, { status: 400 });
  }

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 });
  }

  if (!isAgencyConfigured(agency)) {
    return NextResponse.json({
      success: false,
      error: `LuckyCloud ist für "${agency}" nicht konfiguriert`,
    });
  }

  try {
    const entries = await listDirectory(agency, libraryId, path);

    return NextResponse.json({
      success: true,
      items: entries.map(entry => ({
        name: entry.name,
        type: entry.type,
        size: entry.size,
        mtime: entry.mtime,
      })),
    });
  } catch (error) {
    console.error('LuckyCloud list directory error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}

// POST - Neuen Ordner erstellen
export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const agency = request.nextUrl.searchParams.get('agency') as LuckyCloudAgency;
  const libraryId = request.nextUrl.searchParams.get('libraryId');

  if (!agency || !['eventomaxx', 'vendoweb'].includes(agency)) {
    return NextResponse.json({ error: 'Ungültige Agentur' }, { status: 400 });
  }

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 });
  }

  if (!isAgencyConfigured(agency)) {
    return NextResponse.json({
      success: false,
      error: `LuckyCloud ist für "${agency}" nicht konfiguriert`,
    });
  }

  try {
    const body = await request.json();
    const { path, folderName } = body;

    if (!path) {
      return NextResponse.json({ error: 'path ist erforderlich' }, { status: 400 });
    }

    if (!folderName || typeof folderName !== 'string' || folderName.trim() === '') {
      return NextResponse.json({ error: 'folderName ist erforderlich' }, { status: 400 });
    }

    // Vollständigen Pfad für den neuen Ordner erstellen
    const newFolderPath = path === '/' ? `/${folderName.trim()}` : `${path}/${folderName.trim()}`;

    await createDirectory(agency, libraryId, newFolderPath);

    return NextResponse.json({
      success: true,
      path: newFolderPath,
    });
  } catch (error) {
    console.error('LuckyCloud create directory error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}
