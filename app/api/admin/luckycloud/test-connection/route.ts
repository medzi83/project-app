import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  ping,
  authPing,
  listLibraries,
  getAuthToken,
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
    // Test 1: Simple ping (no auth)
    const pingResult = await ping(agency);

    // Test 2: Auth ping
    let authPingResult = false;
    let tokenPreview = '';
    try {
      const token = await getAuthToken(agency);
      tokenPreview = token.substring(0, 10);
      authPingResult = await authPing(agency);
    } catch (error) {
      console.error('Auth ping failed:', error);
    }

    // Test 3: List repos (if auth works)
    let reposCount = 0;
    if (authPingResult) {
      try {
        const repos = await listLibraries(agency);
        reposCount = repos.length;
      } catch (error) {
        console.error('List repos failed:', error);
      }
    }

    const success = pingResult && authPingResult;

    return NextResponse.json({
      success,
      details: {
        ping: pingResult,
        authPing: authPingResult,
        repos: reposCount,
        tokenPreview,
      },
    });
  } catch (error) {
    console.error('LuckyCloud connection test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}
