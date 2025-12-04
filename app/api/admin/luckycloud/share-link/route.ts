import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  getOrCreateShareLink,
  getShareLinkThumbnail,
  isAgencyConfigured,
  type LuckyCloudAgency
} from '@/lib/luckycloud';

/**
 * Share-Link API für LuckyCloud-Dateien
 *
 * Gibt einen permanenten, öffentlich zugänglichen Link zurück, der direkt im Browser funktioniert.
 * Kein Vercel-Proxy nötig - der Browser lädt direkt von LuckyCloud.
 *
 * Parameter:
 * - agency: 'eventomaxx' | 'vendoweb'
 * - libraryId: Die Bibliotheks-ID
 * - path: Der Dateipfad
 * - type: 'full' (Vollbild) | 'thumbnail' (Vorschau, default)
 * - size: Thumbnail-Größe (48, 96, 192, 256), nur bei type=thumbnail
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
  const type = request.nextUrl.searchParams.get('type') || 'thumbnail';
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
    let url: string;

    if (type === 'full') {
      // Vollbild-Download-Link
      url = await getOrCreateShareLink(agency, libraryId, filePath);
    } else {
      // Thumbnail-Link
      const size = parseInt(sizeParam) as 48 | 96 | 192 | 256;
      const validSizes = [48, 96, 192, 256];
      const thumbnailSize = validSizes.includes(size) ? size : 96;

      try {
        url = await getShareLinkThumbnail(agency, libraryId, filePath, thumbnailSize as 48 | 96 | 192 | 256);
      } catch {
        // Fallback auf Vollbild wenn Thumbnail nicht verfügbar
        url = await getOrCreateShareLink(agency, libraryId, filePath);
      }
    }

    return NextResponse.json({
      success: true,
      url,
    });
  } catch (error) {
    console.error('LuckyCloud share-link error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }, { status: 500 });
  }
}
