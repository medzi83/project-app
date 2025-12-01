import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  listLibraries,
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
  if (!agency || !['eventomaxx', 'vendoweb'].includes(agency)) {
    return NextResponse.json({ error: 'Ungültige Agentur' }, { status: 400 });
  }

  if (!isAgencyConfigured(agency)) {
    return NextResponse.json({
      success: false,
      error: `LuckyCloud ist für "${agency}" nicht konfiguriert`,
    });
  }

  try {
    const repos = await listLibraries(agency);

    return NextResponse.json({
      success: true,
      libraries: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        size: repo.size,
        encrypted: repo.encrypted,
        permission: repo.permission,
      })),
    });
  } catch (error) {
    console.error('LuckyCloud list libraries error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}
