"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  try {
    return await requireRole(["ADMIN"]);
  } catch {
    redirect("/");
  }
}

function getPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const possible = (error as { code?: unknown }).code;
    return typeof possible === "string" ? possible : undefined;
  }
  return undefined;
}

const CreateAdminSchema = z.object({
  name: z.string().optional().transform((v) => v?.trim() || null),
  fullName: z.string().optional().transform((v) => v?.trim() || null),
  roleTitle: z.string().optional().transform((v) => v?.trim() || null),
  email: z.string().email("Ungueltige E-Mail").transform((v) => v.toLowerCase()),
  password: z.string().min(8, "Mind. 8 Zeichen"),
});

export async function createAdmin(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateAdminSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    redirect(`/admin/admins?adminError=${encodeURIComponent(msg)}`);
  }

  const { name, fullName, roleTitle, email, password } = parsed.data;
  try {
    await prisma.user.create({
      data: {
        name,
        fullName,
        roleTitle,
        email,
        password: bcrypt.hashSync(password, 10),
        role: "ADMIN",
      },
    });
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "P2002") {
      redirect(`/admin/admins?adminError=${encodeURIComponent("E-Mail ist bereits vergeben.")}`);
    }
    redirect(`/admin/admins?adminError=${encodeURIComponent("Anlegen fehlgeschlagen.")}`);
  }

  revalidatePath("/admin/admins");
  redirect(`/admin/admins?adminOk=1`);
}

const UpdateAdminDetailsSchema = z.object({
  userId: z.string().min(1),
  name: z.string().optional().transform((v) => v?.trim() || null),
  fullName: z.string().optional().transform((v) => v?.trim() || null),
  roleTitle: z.string().optional().transform((v) => v?.trim() || null),
});

export async function updateAdminDetails(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateAdminDetailsSchema.safeParse(raw);
  if (!parsed.success) redirect("/admin/admins");

  const { userId, name, fullName, roleTitle } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "ADMIN" },
    data: { name, fullName, roleTitle },
  });

  revalidatePath("/admin/admins");
  redirect("/admin/admins");
}

// Keep old function for backwards compatibility
export async function updateAdminName(formData: FormData) {
  return updateAdminDetails(formData);
}

const ResetAdminPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8, "Mind. 8 Zeichen"),
});

export async function resetAdminPassword(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = ResetAdminPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    redirect(`/admin/admins?pwdError=${encodeURIComponent(msg)}`);
  }

  const { userId, newPassword } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "ADMIN" },
    data: { password: bcrypt.hashSync(newPassword, 10) },
  });

  revalidatePath("/admin/admins");
  redirect(`/admin/admins?pwdOk=1`);
}

const ToggleAdminActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.enum(["0", "1"]),
});

export async function toggleAdminActive(formData: FormData) {
  const session = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = ToggleAdminActiveSchema.safeParse(raw);
  if (!parsed.success) redirect("/admin/admins");

  const { userId, active } = parsed.data;
  const isActive = active === "1";

  if (!isActive) {
    const remaining = await prisma.user.count({ where: { role: "ADMIN", active: true, id: { not: userId } } });
    if (remaining === 0) {
      redirect(`/admin/admins?adminError=${encodeURIComponent("Mindestens ein aktiver Admin wird benoetigt.")}`);
    }
    const actingEmail = session.user.email ?? null;
    if (actingEmail) {
      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (target?.email === actingEmail) {
        redirect(`/admin/admins?adminError=${encodeURIComponent("Eigener Account kann nicht deaktiviert werden.")}`);
      }
    }
  }

  const result = await prisma.user.updateMany({
    where: { id: userId, role: "ADMIN" },
    data: { active: isActive },
  });

  if (result.count === 0) {
    redirect(`/admin/admins?adminError=${encodeURIComponent("Admin wurde nicht gefunden.")}`);
  }

  revalidatePath("/admin/admins");
  redirect("/admin/admins");
}
