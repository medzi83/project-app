import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export const preferredRegion = "fra1";

/**
 * Check if project needs installation assignment when demoDate is set
 * Returns available installations or default domain info
 */
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId erforderlich" }, { status: 400 });
  }

  try {
    // Get project with installation info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        joomlaInstallations: true,
        client: {
          include: {
            agency: {
              select: {
                mailServers: {
                  select: { host: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    }

    // Check if project already has an installation
    const hasInstallation = project.joomlaInstallations.length > 0;

    if (hasInstallation) {
      return NextResponse.json({
        needsAssignment: false,
        hasInstallation: true,
      });
    }

    // Get available installations for this client (not assigned to any project)
    const availableInstallations = await prisma.joomlaInstallation.findMany({
      where: {
        clientId: project.clientId,
        projectId: null,
      },
      select: {
        id: true,
        folderName: true,
        installUrl: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get default domain from mail server
    const mailServer = project.client?.agency?.mailServers?.[0];
    const defaultDomain = mailServer?.host || "";

    return NextResponse.json({
      needsAssignment: true,
      hasInstallation: false,
      availableInstallations,
      defaultDomain,
      clientId: project.clientId,
    });
  } catch (error) {
    console.error("Error checking installation:", error);
    return NextResponse.json(
      {
        error: "Fehler beim Prüfen der Installation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
