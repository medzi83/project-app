import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';


export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  // Only admins can toggle client status
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clientId, field } = await request.json();

    if (!clientId || !field) {
      return NextResponse.json(
        { error: "clientId and field are required" },
        { status: 400 }
      );
    }

    if (field !== "workStopped" && field !== "finished") {
      return NextResponse.json(
        { error: "field must be 'workStopped' or 'finished'" },
        { status: 400 }
      );
    }

    // Type assertion after validation
    const validatedField = field as "workStopped" | "finished";

    // Get current value
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { workStopped: true, finished: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Toggle the field
    const newValue = !client[validatedField];

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { [validatedField]: newValue },
    });

    // If setting client to "finished", also mark all their projects as finished
    if (validatedField === "finished" && newValue === true) {
      console.log(`[toggle-status] Client ${clientId} set to finished, updating all projects...`);

      // Get all projects for this client
      const projects = await prisma.project.findMany({
        where: { clientId },
        select: {
          id: true,
          type: true,
          film: { select: { projectId: true } },
          website: { select: { projectId: true } },
        },
      });

      console.log(`[toggle-status] Found ${projects.length} projects for client ${clientId}`);

      // Update each project based on its type
      let updatedCount = 0;
      for (const project of projects) {
        try {
          if (project.type === "FILM") {
            // Check if film relation exists, if not create it first
            if (!project.film) {
              console.log(`[toggle-status] Creating missing ProjectFilm for project ${project.id}`);
              await prisma.projectFilm.create({
                data: {
                  projectId: project.id,
                  status: "BEENDET",
                },
              });
            } else {
              await prisma.projectFilm.update({
                where: { projectId: project.id },
                data: { status: "BEENDET" },
              });
            }
            updatedCount++;
          } else if (project.type === "WEBSITE") {
            // Check if website relation exists, if not create it first
            if (!project.website) {
              console.log(`[toggle-status] Creating missing ProjectWebsite for project ${project.id}`);
              await prisma.projectWebsite.create({
                data: {
                  projectId: project.id,
                  pStatus: "BEENDET",
                },
              });
            } else {
              await prisma.projectWebsite.update({
                where: { projectId: project.id },
                data: { pStatus: "BEENDET" },
              });
            }
            updatedCount++;
          } else if (project.type === "SOCIAL") {
            // Social projects don't have a specific status field, set main status to ONLINE
            await prisma.project.update({
              where: { id: project.id },
              data: { status: "ONLINE" },
            });
            updatedCount++;
          }
        } catch (error) {
          console.error(`[toggle-status] Error updating project ${project.id}:`, error);
          // Continue with other projects even if one fails
        }
      }

      console.log(`[toggle-status] Successfully updated ${updatedCount}/${projects.length} projects`);
    }

    return NextResponse.json({
      success: true,
      [validatedField]: updatedClient[validatedField],
    });
  } catch (error) {
    console.error("Error toggling client status:", error);
    return NextResponse.json(
      { error: "Failed to toggle status" },
      { status: 500 }
    );
  }
}
