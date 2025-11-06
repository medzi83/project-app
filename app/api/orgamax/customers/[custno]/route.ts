import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import { createOrgamaxClient, ORGAMAX_MANDANTEN, type OrgamaxMandant } from '@/lib/orgamax-api';

/**
 * GET /api/orgamax/customers/[custno]
 * Get a single customer by customer number
 * Query params: mandant (1, 2, or 4)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ custno: string }> }
) {
  try {
    // Check authentication
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params (Next.js 15 requirement)
    const { custno: custnoParam } = await params;

    // Get customer number from params
    const custno = Number(custnoParam);
    if (isNaN(custno)) {
      return NextResponse.json({ error: 'Invalid customer number' }, { status: 400 });
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

    // Get customer
    const result = await client.getCustomer(custno, mandant as OrgamaxMandant);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: result.customer,
      mandant,
    });
  } catch (error) {
    console.error('Error in /api/orgamax/customers/[custno]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
