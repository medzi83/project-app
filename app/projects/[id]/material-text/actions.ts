"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { nowAsNaiveGermanTime } from "@/lib/naive-date";

type ReviewResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Bewertet einen eingereichten Text (MenuItem)
 */
export async function reviewMenuItemText(
  menuItemId: string,
  suitable: boolean,
  reviewNote: string | null,
  projectId: string
): Promise<ReviewResult> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "Nicht authentifiziert" };
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    // Vollständigen Namen aus der User-Tabelle laden
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, name: true },
    });
    const reviewerName = user?.fullName || user?.name || session.user.name || "Unbekannt";

    await prisma.materialTextSubmission.update({
      where: { menuItemId },
      data: {
        reviewedAt: nowAsNaiveGermanTime(),
        reviewedBy: session.user.id,
        reviewedByName: reviewerName,
        suitable,
        reviewNote: suitable ? null : reviewNote, // Nur bei Ablehnung wird Hinweis gespeichert
      },
    });

    revalidatePath(`/projects/${projectId}/material-text`);
    return { success: true };
  } catch (error) {
    console.error("Fehler beim Bewerten:", error);
    return { success: false, error: "Ein Fehler ist aufgetreten" };
  }
}

/**
 * Bewertet den allgemeinen eingereichten Text
 */
export async function reviewGeneralText(
  webDocumentationId: string,
  suitable: boolean,
  reviewNote: string | null,
  projectId: string
): Promise<ReviewResult> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "Nicht authentifiziert" };
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    // Vollständigen Namen aus der User-Tabelle laden
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, name: true },
    });
    const reviewerName = user?.fullName || user?.name || session.user.name || "Unbekannt";

    await prisma.materialGeneralSubmission.update({
      where: { webDocumentationId },
      data: {
        reviewedAt: nowAsNaiveGermanTime(),
        reviewedBy: session.user.id,
        reviewedByName: reviewerName,
        suitable,
        reviewNote: suitable ? null : reviewNote,
      },
    });

    revalidatePath(`/projects/${projectId}/material-text`);
    return { success: true };
  } catch (error) {
    console.error("Fehler beim Bewerten:", error);
    return { success: false, error: "Ein Fehler ist aufgetreten" };
  }
}

/**
 * Setzt die Bewertung zurück (z.B. wenn der Text neu bewertet werden soll)
 */
export async function resetMenuItemReview(
  menuItemId: string,
  projectId: string
): Promise<ReviewResult> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "Nicht authentifiziert" };
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    await prisma.materialTextSubmission.update({
      where: { menuItemId },
      data: {
        reviewedAt: null,
        reviewedBy: null,
        reviewedByName: null,
        suitable: null,
        reviewNote: null,
      },
    });

    revalidatePath(`/projects/${projectId}/material-text`);
    return { success: true };
  } catch (error) {
    console.error("Fehler beim Zurücksetzen:", error);
    return { success: false, error: "Ein Fehler ist aufgetreten" };
  }
}

/**
 * Setzt die Bewertung des allgemeinen Textes zurück
 */
export async function resetGeneralTextReview(
  webDocumentationId: string,
  projectId: string
): Promise<ReviewResult> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "Nicht authentifiziert" };
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    await prisma.materialGeneralSubmission.update({
      where: { webDocumentationId },
      data: {
        reviewedAt: null,
        reviewedBy: null,
        reviewedByName: null,
        suitable: null,
        reviewNote: null,
      },
    });

    revalidatePath(`/projects/${projectId}/material-text`);
    return { success: true };
  } catch (error) {
    console.error("Fehler beim Zurücksetzen:", error);
    return { success: false, error: "Ein Fehler ist aufgetreten" };
  }
}
