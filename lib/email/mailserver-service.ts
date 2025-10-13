import { prisma } from "@/lib/prisma";

/**
 * Ermittelt den passenden Mailserver für ein Projekt basierend auf der Agentur-Zuordnung
 *
 * Logik:
 * 1. Wenn der Kunde einer Agentur zugeordnet ist, verwende den Mailserver dieser Agentur
 * 2. Falls kein agentur-spezifischer Server existiert, verwende den Fallback-Server (agencyId = null)
 * 3. Falls kein Server gefunden wird, werfe einen Fehler
 */
export async function getMailServerForProject(projectId: string) {
  // Hole Projekt mit Kunde und dessen Agentur
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        include: {
          agency: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const agencyId = project.client.agency?.id;

  // Versuche zuerst agentur-spezifischen Mailserver zu finden
  if (agencyId) {
    const agencyMailServer = await prisma.mailServer.findFirst({
      where: { agencyId },
      orderBy: { createdAt: "asc" }, // Ältester = primärer Server
    });

    if (agencyMailServer) {
      return agencyMailServer;
    }
  }

  // Fallback: Mailserver für "alle Agenturen"
  const fallbackMailServer = await prisma.mailServer.findFirst({
    where: { agencyId: null },
    orderBy: { createdAt: "asc" },
  });

  if (!fallbackMailServer) {
    throw new Error(
      "No mail server configured. Please configure at least one mail server with agencyId=null as fallback."
    );
  }

  return fallbackMailServer;
}

/**
 * Ermittelt den Mailserver anhand einer expliziten Agentur-ID
 */
export async function getMailServerForAgency(agencyId: string | null) {
  if (agencyId) {
    const agencyMailServer = await prisma.mailServer.findFirst({
      where: { agencyId },
      orderBy: { createdAt: "asc" },
    });

    if (agencyMailServer) {
      return agencyMailServer;
    }
  }

  // Fallback
  const fallbackMailServer = await prisma.mailServer.findFirst({
    where: { agencyId: null },
    orderBy: { createdAt: "asc" },
  });

  if (!fallbackMailServer) {
    throw new Error("No fallback mail server configured");
  }

  return fallbackMailServer;
}
