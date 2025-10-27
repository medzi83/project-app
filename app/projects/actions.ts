"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/authz";

import { redirect } from "next/navigation";

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
}

export async function deleteAllProjects() {
  await requireAdmin();

  // Only delete WEBSITE projects, not FILM projects
  const websiteProjects = await prisma.project.findMany({
    where: {
      OR: [
        { type: "WEBSITE" },
        { website: { isNot: null } }
      ]
    },
    select: { id: true }
  });

  const projectIds = websiteProjects.map(p => p.id);

  await prisma.$transaction([
    prisma.projectNote.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.projectDomainHistory.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.projectWebsite.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
  ]);
  revalidatePath("/projects");
}


export async function deleteProject(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return;

  await prisma.$transaction([
    prisma.projectNote.deleteMany({ where: { projectId } }),
    prisma.projectDomainHistory.deleteMany({ where: { projectId } }),
    prisma.projectWebsite.deleteMany({ where: { projectId } }),
    prisma.projectFilm.deleteMany({ where: { projectId } }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}





