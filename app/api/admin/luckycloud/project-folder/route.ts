import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

// GET - Projekt-Ordner-Zuordnung abrufen
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId ist erforderlich' }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        website: {
          select: {
            luckyCloudFolderPath: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            customerNo: true,
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
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        type: project.type,
        luckyCloudFolderPath: project.website?.luckyCloudFolderPath || null,
      },
      client: project.client,
    });
  } catch (error) {
    console.error('Error fetching project folder:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }, { status: 500 });
  }
}

// PUT - Projekt-Ordner-Zuordnung aktualisieren
export async function PUT(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, folderPath } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId ist erforderlich' }, { status: 400 });
    }

    // Prüfen ob das Projekt existiert und ein Website-Projekt ist
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { website: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    if (!project.website) {
      return NextResponse.json({ error: 'Nur Website-Projekte können einen Material-Ordner haben' }, { status: 400 });
    }

    // Update der Zuordnung
    const updatedWebsite = await prisma.projectWebsite.update({
      where: { projectId },
      data: {
        luckyCloudFolderPath: folderPath || null,
      },
      select: {
        projectId: true,
        luckyCloudFolderPath: true,
      },
    });

    return NextResponse.json({
      success: true,
      website: updatedWebsite,
    });
  } catch (error) {
    console.error('Error updating project folder:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }, { status: 500 });
  }
}
