"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function createPreviewVersion(
  projectId: string,
  data: { sentDate: Date; link: string }
) {
  const session = await getAuthSession();

  // Admins and agents can create preview versions
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    throw new Error("Unauthorized: Only admins and agents can create preview versions");
  }

  // Get the highest version number for this project
  const highestVersion = await prisma.filmPreviewVersion.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (highestVersion?.version ?? 0) + 1;

  // Create the new preview version
  await prisma.filmPreviewVersion.create({
    data: {
      projectId,
      version: nextVersion,
      sentDate: data.sentDate,
      link: data.link,
    },
  });

  // Revalidate project pages
  revalidatePath(`/film-projects/${projectId}`);
  revalidatePath(`/film-projects`);

  return { success: true };
}

export async function updatePreviewVersion(
  previewVersionId: string,
  data: { sentDate?: Date; link?: string }
) {
  const session = await getAuthSession();

  // Admins and agents can update preview versions
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    throw new Error("Unauthorized: Only admins and agents can update preview versions");
  }

  // Get preview version to find project for revalidation
  const previewVersion = await prisma.filmPreviewVersion.findUnique({
    where: { id: previewVersionId },
    select: { projectId: true },
  });

  if (!previewVersion) {
    throw new Error("Preview version not found");
  }

  // Update the preview version
  await prisma.filmPreviewVersion.update({
    where: { id: previewVersionId },
    data: {
      ...(data.sentDate !== undefined && { sentDate: data.sentDate }),
      ...(data.link !== undefined && { link: data.link }),
    },
  });

  // Revalidate project pages
  revalidatePath(`/film-projects/${previewVersion.projectId}`);
  revalidatePath(`/film-projects`);

  return { success: true };
}

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
