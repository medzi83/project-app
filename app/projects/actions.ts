"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
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

