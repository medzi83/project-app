import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  deleteFile,
  deleteDirectory,
  isAgencyConfigured,
  type LuckyCloudAgency
} from '@/lib/luckycloud';

export async function DELETE(request: NextRequest) {
  // Auth check
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const agency = request.nextUrl.searchParams.get('agency') as LuckyCloudAgency;
  const libraryId = request.nextUrl.searchParams.get('libraryId');
  const filePath = request.nextUrl.searchParams.get('path');
  const itemType = request.nextUrl.searchParams.get('type') || 'file'; // 'file' oder 'dir'

  if (!agency || !['eventomaxx', 'vendoweb'].includes(agency)) {
    return NextResponse.json({ error: 'Ungültige Agentur' }, { status: 400 });
  }

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 });
  }

  if (!filePath) {
    return NextResponse.json({ error: 'path ist erforderlich' }, { status: 400 });
  }

  if (!isAgencyConfigured(agency)) {
    return NextResponse.json({
      success: false,
      error: `LuckyCloud ist für "${agency}" nicht konfiguriert`,
    });
  }

  try {
    if (itemType === 'dir') {
      await deleteDirectory(agency, libraryId, filePath);
    } else {
      await deleteFile(agency, libraryId, filePath);
    }

    return NextResponse.json({
      success: true,
      message: itemType === 'dir' ? 'Verzeichnis gelöscht' : 'Datei gelöscht',
    });
  } catch (error) {
    console.error('LuckyCloud delete error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}
