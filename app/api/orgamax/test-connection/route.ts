import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import { createOrgamaxClient } from '@/lib/orgamax-api';

/**
 * GET /api/orgamax/test-connection
 * Test the connection to the Orgamax API
 * This is a safe way to test from the client without exposing the API key
 */
export async function GET() {
  try {
    // Check authentication
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Orgamax client
    const client = createOrgamaxClient();
    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: 'Orgamax API is not configured',
        },
        { status: 500 }
      );
    }

    // Test connection
    const result = await client.testConnection();

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
    console.error('Error in /api/orgamax/test-connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
