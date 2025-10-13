"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import type { FilmScope, FilmPriority, FilmProjectStatus } from "@prisma/client";

export async function updateFilmProject(formData: FormData) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }

  const projectId = formData.get("projectId") as string;
  const scope = (formData.get("scope") as FilmScope) || null;
  const priority = (formData.get("priority") as FilmPriority) || "NONE";
  const status = (formData.get("status") as FilmProjectStatus) || "AKTIV";
  const filmerId = (formData.get("filmerId") as string) || null;
  const cutterId = (formData.get("cutterId") as string) || null;
  const reminderAt = formData.get("reminderAt") as string;
  const contractStart = formData.get("contractStart") as string;
  const scouting = formData.get("scouting") as string;
  const scriptToClient = formData.get("scriptToClient") as string;
  const scriptApproved = formData.get("scriptApproved") as string;
  const shootDate = formData.get("shootDate") as string;
  const firstCutToClient = formData.get("firstCutToClient") as string;
  const finalToClient = formData.get("finalToClient") as string;
  const onlineDate = formData.get("onlineDate") as string;
  const finalLinkRaw = formData.get("finalLink") as string | null;
  const onlineLinkRaw = formData.get("onlineLink") as string | null;
  const lastContact = formData.get("lastContact") as string;
  const note = formData.get("note") as string;

  const toDate = (s?: string | null) => (s && s.trim() ? new Date(s) : null);
  const toLink = (s?: string | null) => {
    if (!s) return null;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const nextFinalLink = toLink(finalLinkRaw);
  const nextFinalDate = toDate(finalToClient);
  if (nextFinalDate && !nextFinalLink) {
    throw new Error("Ein Finalversion-Link ist erforderlich, wenn eine Finalversion hinterlegt wird.");
  }

  const requestedOnlineDate = toDate(onlineDate);
  const requestedOnlineLink = toLink(onlineLinkRaw);
  const resolvedOnlineLink = requestedOnlineDate ? (requestedOnlineLink ?? nextFinalLink) : requestedOnlineLink;
  if (requestedOnlineDate && !resolvedOnlineLink) {
    throw new Error("Bitte einen Hauptlink hinterlegen (wird aus dem Finalversion-Link �bernommen, falls vorhanden).");
  }

  await prisma.projectFilm.update({
    where: { projectId },
    data: {
      scope,
      priority,
      status,
      filmerId: filmerId || null,
      cutterId: cutterId || null,
      reminderAt: toDate(reminderAt),
      contractStart: toDate(contractStart),
      scouting: toDate(scouting),
      scriptToClient: toDate(scriptToClient),
      scriptApproved: toDate(scriptApproved),
      shootDate: toDate(shootDate),
      firstCutToClient: toDate(firstCutToClient),
      finalToClient: nextFinalDate,
      finalLink: nextFinalLink,
      onlineDate: requestedOnlineDate,
      onlineLink: resolvedOnlineLink,
      lastContact: toDate(lastContact),
      note: note || null,
    },
  });

  revalidatePath("/film-projects");
  revalidatePath(`/film-projects/${projectId}`);
  redirect(`/film-projects/${projectId}`);
}

export async function deletePreviewVersion(formData: FormData) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }

  const versionId = formData.get("versionId") as string;
  const projectId = formData.get("projectId") as string;

  await prisma.filmPreviewVersion.delete({
    where: { id: versionId },
  });

  revalidatePath("/film-projects");
  revalidatePath(`/film-projects/${projectId}`);
  revalidatePath(`/film-projects/${projectId}/edit`);
  redirect(`/film-projects/${projectId}/edit`);
}
