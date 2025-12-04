import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  getDownloadLink,
  isAgencyConfigured,
  type LuckyCloudAgency
} from '@/lib/luckycloud';

/**
 * Image Proxy für LuckyCloud-Bilder
 * Lädt das Bild serverseitig und gibt es an den Client zurück.
 * Dies umgeht CORS/Referrer-Probleme, da der Server keine solchen Einschränkungen hat.
 */
export async function GET(request: NextRequest) {
  // Auth check
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const agency = request.nextUrl.searchParams.get('agency') as LuckyCloudAgency;
  const libraryId = request.nextUrl.searchParams.get('libraryId');
  const filePath = request.nextUrl.searchParams.get('path');

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
    }, { status: 400 });
  }

  try {
    // Download-Link von LuckyCloud holen
    const downloadLink = await getDownloadLink(agency, libraryId, filePath);

    // Bild serverseitig laden (kein CORS/Referrer-Problem)
    const imageResponse = await fetch(downloadLink, {
      headers: {
        'Referer': '', // Leerer Referer
      },
    });

    if (!imageResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Fehler beim Laden des Bildes: ${imageResponse.status}`,
      }, { status: imageResponse.status });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Bild an Client zurückgeben mit Caching
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // 1 Stunde cachen
      },
    });
  } catch (error) {
    console.error('LuckyCloud image proxy error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }, { status: 500 });
  }
}
