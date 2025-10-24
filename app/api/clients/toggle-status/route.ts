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

      // Update each project based on its type
      for (const project of projects) {
        if (project.type === "FILM" && project.film) {
          await prisma.projectFilm.update({
            where: { projectId: project.id },
            data: { status: "BEENDET" },
          });
        } else if (project.type === "WEBSITE" && project.website) {
          await prisma.projectWebsite.update({
            where: { projectId: project.id },
            data: { pStatus: "BEENDET" },
          });
        } else if (project.type === "SOCIAL") {
          // Social projects don't have a specific status field, set main status to ONLINE
          await prisma.project.update({
            where: { id: project.id },
            data: { status: "ONLINE" },
          });
        }
      }
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
