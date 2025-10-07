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
  await prisma.$transaction([
    prisma.projectNote.deleteMany({}),
    prisma.projectWebsite.deleteMany({}),
    prisma.project.deleteMany({}),
  ]);
  revalidatePath("/projects");
}


export async function deleteProject(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return;

  await prisma.$transaction([
    prisma.projectNote.deleteMany({ where: { projectId } }),
    prisma.projectWebsite.deleteMany({ where: { projectId } }),
    prisma.projectFilm.deleteMany({ where: { projectId } }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}





