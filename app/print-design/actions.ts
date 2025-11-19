"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function deleteProject(formData: FormData) {
  const session = await getAuthSession();

  // Only admins can delete projects
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();

  if (!projectId) {
    return { success: false, message: "Projekt-ID fehlt" };
  }

  try {
    // Delete project and all related data in a transaction
    await prisma.$transaction([
      prisma.projectNote.deleteMany({ where: { projectId } }),
      prisma.projectDomainHistory.deleteMany({ where: { projectId } }),
      prisma.printDesign.deleteMany({ where: { projectId } }),
      prisma.emailLog.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    // Revalidate relevant paths
    revalidatePath("/print-design");
    revalidatePath(`/print-design/${projectId}`);
    revalidatePath("/dashboard");

    if (clientId) {
      revalidatePath(`/clients/${clientId}`);
    }

    return { success: true, message: "Projekt erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting project:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Löschen des Projekts"
    };
  }
}
