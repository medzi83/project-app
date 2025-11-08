import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import { createOrgamaxClient, ORGAMAX_MANDANTEN, type OrgamaxMandant } from '@/lib/orgamax-api';

/**
 * POST /api/orgamax/query
 * Execute a custom SQL query on the Orgamax database
 * Body: { sql: string, mandant: number }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { sql, mandant } = body;

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    if (!mandant || typeof mandant !== 'number') {
      return NextResponse.json({ error: 'Mandant is required' }, { status: 400 });
    }

    if (!ORGAMAX_MANDANTEN.includes(mandant as OrgamaxMandant)) {
      return NextResponse.json(
        { error: `Invalid mandant. Must be one of: ${ORGAMAX_MANDANTEN.join(', ')}` },
        { status: 400 }
      );
    }

    // Create Orgamax client
    const client = createOrgamaxClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Orgamax API is not configured' },
        { status: 500 }
      );
    }

    // Execute query
    const result = await client.query(sql, mandant as OrgamaxMandant);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to execute query' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
      count: result.data?.length || 0,
      mandant,
    });
  } catch (error) {
    console.error('[query-route] Exception caught:', error);
    console.error('[query-route] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
