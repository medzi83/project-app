import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  getDownloadLink,
  getThumbnailLink,
  isAgencyConfigured,
  type LuckyCloudAgency
} from '@/lib/luckycloud';

/**
 * Image Proxy für LuckyCloud-Bilder
 *
 * Unterstützt zwei Modi:
 * 1. Thumbnail-Modus (size=48|96|192|256): Lädt kleine Vorschaubilder (empfohlen für Listen)
 * 2. Vollbild-Modus (size=full): Lädt das Originalbild (für Lightbox/Vollansicht)
 *
 * Seafile/LuckyCloud Download-Links sind IP-gebunden und funktionieren nur vom anfragenden Server.
 * Dieser Proxy löst das Problem, indem er das Bild serverseitig lädt.
 *
 * Traffic-Optimierung:
 * - Thumbnails sind ~5-20KB statt mehrerer MB für Originalbilder
 * - Browser-Cache: 24h für Thumbnails, 1h für Vollbilder
 * - Lazy Loading: Bilder werden erst geladen wenn sie sichtbar werden
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
  const sizeParam = request.nextUrl.searchParams.get('size') || '96';

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
    let imageLink: string;
    let cacheMaxAge: number;

    if (sizeParam === 'full') {
      // Vollbild-Modus: Original-Datei laden
      imageLink = await getDownloadLink(agency, libraryId, filePath);
      cacheMaxAge = 3600; // 1 Stunde
    } else {
      // Thumbnail-Modus: Kleine Vorschau laden
      const size = parseInt(sizeParam) as 48 | 96 | 192 | 256;
      const validSizes = [48, 96, 192, 256];
      const thumbnailSize = validSizes.includes(size) ? size : 96;

      try {
        imageLink = await getThumbnailLink(agency, libraryId, filePath, thumbnailSize as 48 | 96 | 192 | 256);
        cacheMaxAge = 86400; // 24 Stunden für Thumbnails (ändern sich selten)
      } catch {
        // Fallback auf Vollbild wenn Thumbnail nicht verfügbar
        imageLink = await getDownloadLink(agency, libraryId, filePath);
        cacheMaxAge = 3600;
      }
    }

    // Bild serverseitig laden
    const imageResponse = await fetch(imageLink);

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
        'Cache-Control': `private, max-age=${cacheMaxAge}`,
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
