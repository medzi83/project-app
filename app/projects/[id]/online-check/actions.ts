"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * Erstellt oder holt den Online-Check für ein Projekt.
 * Beim Erstellen werden die aktuellen Template-Items als Kopie übernommen.
 */
export async function getOrCreateOnlineCheck(projectId: string) {
  const session = await requireRole(["ADMIN", "AGENT"]);

  // Prüfen ob Online-Check bereits existiert
  const existing = await prisma.onlineCheck.findUnique({
    where: { projectId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (existing) {
    return existing;
  }

  // Prüfen ob Demo freigegeben wurde
  const website = await prisma.projectWebsite.findUnique({
    where: { projectId },
    select: { demoApprovedAt: true },
  });

  if (!website?.demoApprovedAt) {
    throw new Error("Demo muss erst freigegeben werden");
  }

  // Template-Items holen
  const templateItems = await prisma.onlineCheckTemplateItem.findMany({
    orderBy: { sortOrder: "asc" },
  });

  // Online-Check mit Kopien der Template-Items erstellen
  const onlineCheck = await prisma.onlineCheck.create({
    data: {
      projectId,
      items: {
        create: templateItems.map((item) => ({
          label: item.label,
          description: item.description,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Kein revalidatePath hier - diese Funktion wird während des Renderings aufgerufen
  // und revalidatePath ist nur für Client-initiierte Mutationen gedacht
  return onlineCheck;
}

/**
 * Setzt ein Item als erledigt/nicht erledigt
 */
export async function toggleCheckItem(itemId: string, completed: boolean) {
  const session = await requireRole(["ADMIN", "AGENT"]);

  const item = await prisma.onlineCheckItem.findUnique({
    where: { id: itemId },
    select: { onlineCheckId: true },
  });

  if (!item) {
    throw new Error("Item nicht gefunden");
  }

  const onlineCheck = await prisma.onlineCheck.findUnique({
    where: { projectId: item.onlineCheckId },
    select: { projectId: true },
  });

  await prisma.onlineCheckItem.update({
    where: { id: itemId },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
      completedById: completed ? session.user.id : null,
      completedByName: completed ? session.user.name : null,
    },
  });

  revalidatePath(`/projects/${onlineCheck?.projectId}/online-check`);
  return { success: true };
}

/**
 * Speichert die Bemerkung eines Items
 */
export async function updateItemNote(itemId: string, note: string) {
  await requireRole(["ADMIN", "AGENT"]);

  const item = await prisma.onlineCheckItem.findUnique({
    where: { id: itemId },
    select: { onlineCheckId: true },
  });

  if (!item) {
    throw new Error("Item nicht gefunden");
  }

  await prisma.onlineCheckItem.update({
    where: { id: itemId },
    data: {
      note: note.trim() || null,
    },
  });

  revalidatePath(`/projects/${item.onlineCheckId}/online-check`);
  return { success: true };
}

/**
 * Setzt den QM-Check zurück (löscht ihn komplett).
 * Nur für Admins - beim nächsten Öffnen wird er neu erstellt mit aktuellem Template.
 */
export async function resetOnlineCheck(projectId: string) {
  await requireRole(["ADMIN"]);

  // OnlineCheck und alle Items löschen (cascade)
  await prisma.onlineCheck.delete({
    where: { projectId },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/online-check`);
  return { success: true };
}

/**
 * Schließt den QM-Check ab (nur wenn alle Items erledigt sind).
 * Dokumentiert wer und wann abgeschlossen hat.
 */
export async function completeOnlineCheck(projectId: string) {
  const session = await requireRole(["ADMIN", "AGENT"]);

  // Prüfen ob alle Items erledigt sind
  const items = await prisma.onlineCheckItem.findMany({
    where: { onlineCheckId: projectId },
  });

  const allCompleted = items.length > 0 && items.every((item) => item.completed);

  if (!allCompleted) {
    throw new Error("Alle Punkte müssen zuerst abgehakt werden");
  }

  // Check ob bereits abgeschlossen
  const onlineCheck = await prisma.onlineCheck.findUnique({
    where: { projectId },
    select: { completedAt: true },
  });

  if (onlineCheck?.completedAt) {
    throw new Error("QM-Check wurde bereits abgeschlossen");
  }

  const now = new Date();

  await prisma.onlineCheck.update({
    where: { projectId },
    data: {
      completedAt: now,
      completedById: session.user.id,
      completedByName: session.user.name,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/online-check`);
  return {
    success: true,
    completedAt: now,
    completedByName: session.user.name,
  };
}
