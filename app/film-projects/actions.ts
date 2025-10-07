"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteFilmProject(formData: FormData) {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    throw new Error("FORBIDDEN");
  }

  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid project ID");
  }

  await prisma.$transaction([
    prisma.projectNote.deleteMany({ where: { projectId: id } }),
    prisma.projectWebsite.deleteMany({ where: { projectId: id } }),
    prisma.projectFilm.deleteMany({ where: { projectId: id } }),
    prisma.project.delete({ where: { id } }),
  ]);

  revalidatePath("/film-projects");
  revalidatePath("/projects");
  redirect("/film-projects");
}

export async function deleteAllFilmProjects() {
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  // Find all film project IDs first
  const filmProjects = await prisma.project.findMany({
    where: {
      film: {
        isNot: null
      }
    },
    select: { id: true }
  });

  const projectIds = filmProjects.map(p => p.id);

  // Delete all related data in transaction
  await prisma.$transaction([
    prisma.projectNote.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.projectWebsite.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.projectFilm.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
  ]);

  revalidatePath("/film-projects");
  revalidatePath("/projects");
  redirect("/film-projects");
}
