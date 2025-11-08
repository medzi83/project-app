import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import { createOrgamaxClient } from '@/lib/orgamax-api';

/**
 * GET /api/orgamax/test-connection
 * Test the connection to the Orgamax API
 * This is a safe way to test from the client without exposing the API key
 */
export async function GET() {
  console.log('[test-connection] Request received');

  try {
    // Check authentication
    const session = await getAuthSession();
    if (!session) {
      console.log('[test-connection] No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[test-connection] Session valid');

    // Create Orgamax client
    const client = createOrgamaxClient();
    if (!client) {
      console.log('[test-connection] Client creation failed - API not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Orgamax API is not configured',
        },
        { status: 500 }
      );
    }

    console.log('[test-connection] Client created, testing connection...');

    // Test connection
    const result = await client.testConnection();

    console.log('[test-connection] Test result:', result);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.message,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('[test-connection] Exception caught:', error);
    console.error('[test-connection] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
