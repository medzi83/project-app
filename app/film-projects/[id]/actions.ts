"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function deletePreviewVersion(previewVersionId: string) {
  const session = await getAuthSession();

  // Only admins can delete preview versions
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Only admins can delete preview versions");
  }

  // Get preview version to find project for revalidation
  const previewVersion = await prisma.filmPreviewVersion.findUnique({
    where: { id: previewVersionId },
    select: { projectId: true },
  });

  if (!previewVersion) {
    throw new Error("Preview version not found");
  }

  // Delete the preview version
  await prisma.filmPreviewVersion.delete({
    where: { id: previewVersionId },
  });

  // Revalidate project pages
  revalidatePath(`/film-projects/${previewVersion.projectId}`);
  revalidatePath(`/film-projects`);

  return { success: true };
}
