import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

// GET - Kundensuche für LuckyCloud-Zuordnung
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get('search') || '';

  if (!search || search.length < 2) {
    return NextResponse.json({ clients: [] });
  }

  try {
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { customerNo: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        customerNo: true,
        agencyId: true,
        luckyCloudLibraryId: true,
        luckyCloudLibraryName: true,
        luckyCloudFolderPath: true,
        agency: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error searching clients:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }, { status: 500 });
  }
}

// PUT - LuckyCloud-Zuordnung aktualisieren
export async function PUT(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, libraryId, libraryName, folderPath } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId ist erforderlich' }, { status: 400 });
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        luckyCloudLibraryId: libraryId || null,
        luckyCloudLibraryName: libraryName || null,
        luckyCloudFolderPath: folderPath || null,
      },
      select: {
        id: true,
        name: true,
        customerNo: true,
        luckyCloudLibraryId: true,
        luckyCloudLibraryName: true,
        luckyCloudFolderPath: true,
      },
    });

    return NextResponse.json({ success: true, client: updatedClient });
  } catch (error) {
    console.error('Error updating client LuckyCloud assignment:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }, { status: 500 });
  }
}
