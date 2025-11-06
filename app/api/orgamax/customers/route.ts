import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import { createOrgamaxClient, ORGAMAX_MANDANTEN, type OrgamaxMandant } from '@/lib/orgamax-api';

/**
 * GET /api/orgamax/customers
 * Get all customers from a specific Mandant
 * Query params: mandant (1, 2, or 4)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get mandant from query params
    const searchParams = request.nextUrl.searchParams;
    const mandantParam = searchParams.get('mandant');

    if (!mandantParam) {
      return NextResponse.json({ error: 'Mandant parameter is required' }, { status: 400 });
    }

    const mandant = Number(mandantParam);
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

    // Get customers
    const result = await client.getCustomers(mandant as OrgamaxMandant);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch customers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customers: result.customers || [],
      mandant,
    });
  } catch (error) {
    console.error('Error in /api/orgamax/customers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
