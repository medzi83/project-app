"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createFroxlorClientFromServer } from "@/lib/froxlor";

/**
 * Delete a database from Froxlor
 * Checks if database is used by any Joomla installation before deletion
 */
export async function deleteDatabase(
  serverId: string,
  databaseName: string,
  clientId: string
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return { success: false, error: "Nicht authentifiziert" };
    }

    // Only ADMIN can delete databases
    if (session.user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Check if database is used by any Joomla installation
    const joomlaInstallation = await prisma.joomlaInstallation.findFirst({
      where: {
        databaseName: databaseName,
      },
      include: {
        project: {
          select: {
            title: true,
          },
        },
      },
    });

    if (joomlaInstallation) {
      const projectInfo = joomlaInstallation.project
        ? ` (Projekt: ${joomlaInstallation.project.title})`
        : "";
      return {
        success: false,
        error: `Diese Datenbank ist mit einer Joomla-Installation verbunden${projectInfo} und kann nicht gelöscht werden.`,
      };
    }

    // Get server data
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    // Create Froxlor client
    const froxlorClient = createFroxlorClientFromServer(server);

    if (!froxlorClient) {
      return {
        success: false,
        error: "Server-Konfiguration unvollständig (Froxlor URL oder API-Zugangsdaten fehlen)",
      };
    }

    // Delete database via Froxlor API
    const result = await froxlorClient.deleteDatabase(databaseName);

    if (!result.success) {
      return {
        success: false,
        error: result.message || "Fehler beim Löschen der Datenbank",
      };
    }

    revalidatePath(`/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting database:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fehler beim Löschen",
    };
  }
}
