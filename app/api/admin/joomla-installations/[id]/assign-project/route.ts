import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';


type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  try {
    const session = await getAuthSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { projectId } = await req.json();

    // Validate that project exists and belongs to same client as installation
    if (projectId) {
      const installation = await prisma.joomlaInstallation.findUnique({
        where: { id },
        select: { clientId: true },
      });

      if (!installation) {
        return NextResponse.json(
          { error: "Installation nicht gefunden" },
          { status: 404 }
        );
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { clientId: true },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Projekt nicht gefunden" },
          { status: 404 }
        );
      }

      if (project.clientId !== installation.clientId) {
        return NextResponse.json(
          { error: "Projekt gehört nicht zum selben Kunden" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.joomlaInstallation.update({
      where: { id },
      data: { projectId: projectId || null },
    });

    // Convert BigInt to string for JSON serialization
    const response = {
      ...updated,
      bytesProcessed: updated.bytesProcessed ? updated.bytesProcessed.toString() : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error assigning project to installation:", error);
    return NextResponse.json(
      { error: "Fehler beim Zuordnen des Projekts" },
      { status: 500 }
    );
  }
}
