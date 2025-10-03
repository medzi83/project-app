"use server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
}

export async function deleteSelectedClients(formData: FormData) {
  await requireAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) {
    redirect("/clients?delError=keine%20Auswahl");
  }

  // Collect project IDs for selected clients
  const projects = await prisma.project.findMany({
    where: { clientId: { in: ids } },
    select: { id: true },
  });
  const pids = projects.map((p) => p.id);

  await prisma.$transaction([
    // Child tables of projects
    prisma.projectNote.deleteMany({ where: { projectId: { in: pids } } }),
    prisma.projectWebsite.deleteMany({ where: { projectId: { in: pids } } }),
    prisma.project.deleteMany({ where: { id: { in: pids } } }),
    // Detach users from clients (do not delete users)
    prisma.user.updateMany({ where: { clientId: { in: ids } }, data: { clientId: null } }),
    // Finally delete clients
    prisma.client.deleteMany({ where: { id: { in: ids } } }),
  ]);

  revalidatePath("/clients");
  redirect("/clients?delOk=1");
}

