import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { processTriggers } from "@/lib/email/trigger-service";

export const preferredRegion = "fra1";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, installationId, customPath } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId erforderlich" }, { status: 400 });
    }

    // Check if project exists and is a website project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        website: {
          select: {
            demoDate: true,
          },
        },
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

    if (project.type !== "WEBSITE") {
      return NextResponse.json(
        { error: "Nur Website-Projekte können Installationen zugewiesen werden" },
        { status: 400 }
      );
    }

    // Option 1: Assign existing installation
    if (installationId) {
      // Check if installation exists and is not assigned
      const installation = await prisma.joomlaInstallation.findUnique({
        where: { id: installationId },
      });

      if (!installation) {
        return NextResponse.json(
          { error: "Installation nicht gefunden" },
          { status: 404 }
        );
      }

      if (installation.projectId) {
        return NextResponse.json(
          { error: "Installation ist bereits einem anderen Projekt zugewiesen" },
          { status: 400 }
        );
      }

      // Assign installation to project
      await prisma.joomlaInstallation.update({
        where: { id: installationId },
        data: { projectId },
      });

      // Check for email triggers after installation assignment
      let queueIds: string[] = [];
      if (project.website?.demoDate) {
        try {
          queueIds = await processTriggers(
            projectId,
            { demoDate: project.website.demoDate },
            { demoDate: null }
          );
        } catch (error) {
          console.error("Error processing email triggers:", error);
        }
      }

      return NextResponse.json({
        success: true,
        installationId,
        queueIds: queueIds.length > 0 ? queueIds : undefined,
      });
    }

    // Option 2: Create new installation with custom path
    if (customPath) {
      // Get default domain from mail server
      const mailServer = project.client?.agency?.mailServers?.[0];
      if (!mailServer?.host) {
        return NextResponse.json(
          { error: "Keine Standard-Domain gefunden (Mail-Server fehlt)" },
          { status: 400 }
        );
      }

      const defaultDomain = mailServer.host;
      const installUrl = `${defaultDomain}${customPath}`;
      const folderName = customPath.replace(/^\//, ""); // Remove leading slash

      // For custom installations, we need a server - get the first available server
      const server = await prisma.server.findFirst({
        orderBy: { createdAt: "desc" },
      });

      if (!server) {
        return NextResponse.json(
          { error: "Kein Server gefunden für die Installation" },
          { status: 400 }
        );
      }

      // Create new installation
      const newInstallation = await prisma.joomlaInstallation.create({
        data: {
          clientId: project.clientId,
          projectId,
          serverId: server.id,
          customerNo: project.client?.customerNo || "",
          folderName,
          installPath: `/var/www/${folderName}`,
          installUrl,
          standardDomain: defaultDomain,
          databaseName: `db_${folderName}`,
          databasePassword: Math.random().toString(36).substring(2, 15),
        },
      });

      // Check for email triggers after installation creation
      let queueIds: string[] = [];
      if (project.website?.demoDate) {
        try {
          queueIds = await processTriggers(
            projectId,
            { demoDate: project.website.demoDate },
            { demoDate: null }
          );
        } catch (error) {
          console.error("Error processing email triggers:", error);
        }
      }

      return NextResponse.json({
        success: true,
        installationId: newInstallation.id,
        queueIds: queueIds.length > 0 ? queueIds : undefined,
      });
    }

    return NextResponse.json(
      { error: "Entweder installationId oder customPath muss angegeben werden" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error assigning installation:", error);
    return NextResponse.json(
      {
        error: "Fehler beim Zuweisen der Installation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
