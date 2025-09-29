"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}

const CreateServerSchema = z.object({
  name: z.string().min(1, "Bitte Servnamen angeben").trim(),
  ip: z.string().min(1, "Bitte IP-Adresse angeben").trim(),
  froxlorUrl: z.string().url("Ungültige URL").trim().optional().or(z.literal("")),
  mysqlUrl: z.string().url("Ungültige URL").trim().optional().or(z.literal("")),
});

export async function createServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateServerSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/server?error=${encodeURIComponent(msg)}`);
  }

  const { name, ip, froxlorUrl, mysqlUrl } = parsed.data;
  await prisma.server.create({
    data: {
      name,
      ip,
      froxlorUrl: froxlorUrl || null,
      mysqlUrl: mysqlUrl || null,
    },
  });

  revalidatePath("/admin/server");
  redirect("/admin/server?ok=1");
}

const UpdateServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).trim(),
  ip: z.string().min(1).trim(),
  froxlorUrl: z.string().url().trim().optional().or(z.literal("")),
  mysqlUrl: z.string().url().trim().optional().or(z.literal("")),
});

export async function updateServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateServerSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/server?error=${encodeURIComponent(msg)}`);
  }

  const { id, name, ip, froxlorUrl, mysqlUrl } = parsed.data;
  await prisma.server.update({
    where: { id },
    data: {
      name,
      ip,
      froxlorUrl: froxlorUrl || null,
      mysqlUrl: mysqlUrl || null,
    },
  });

  revalidatePath("/admin/server");
  redirect("/admin/server?ok=1");
}

const DeleteServerSchema = z.object({ id: z.string().min(1) });

export async function deleteServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = DeleteServerSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/admin/server");
  }

  await prisma.server.delete({ where: { id: parsed.data.id } });
  revalidatePath("/admin/server");
  redirect("/admin/server");
}
