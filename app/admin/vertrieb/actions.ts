"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}

function getPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const possible = (error as { code?: unknown }).code;
    return typeof possible === "string" ? possible : undefined;
  }
  return undefined;
}

/* ---------- Vertriebsagent anlegen ---------- */
const EmailField = z
  .string()
  .optional()
  .transform((value) => (value ?? "").trim())
  .superRefine((value, ctx) => {
    if (value === "") return;
    if (!z.string().email("Ungueltige E-Mail").safeParse(value).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungueltige E-Mail" });
    }
  })
  .transform((value) => (value === "" ? null : value.toLowerCase()));

const CreateSalesAgentSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").transform(v => v.trim()),
  email: EmailField,
  password: z.string().min(8, "Mind. 8 Zeichen"),
});

export async function createSalesAgent(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateSalesAgentSchema.safeParse(raw);

  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`/admin/vertrieb?error=${encodeURIComponent(msg)}`);
  }

  const { name, email, password } = parsed.data;

  try {
    await prisma.user.create({
      data: {
        name,
        email: email ?? undefined,
        password: bcrypt.hashSync(password, 10),
        role: "SALES",
      },
    });
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "P2002") {
      redirect(`/admin/vertrieb?error=${encodeURIComponent("E-Mail ist bereits vergeben.")}`);
    }
    redirect(`/admin/vertrieb?error=${encodeURIComponent("Anlegen fehlgeschlagen.")}`);
  }

  revalidatePath("/admin/vertrieb");
  redirect(`/admin/vertrieb?ok=1`);
}

/* ---------- Vertriebsagent-Passwort zuruecksetzen ---------- */
const ResetPwdSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8, "Mind. 8 Zeichen"),
});

export async function resetSalesAgentPassword(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = ResetPwdSchema.safeParse(raw);

  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`/admin/vertrieb?pwdError=${encodeURIComponent(msg)}`);
  }

  const { userId, newPassword } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "SALES" },
    data: { password: bcrypt.hashSync(newPassword, 10) },
  });

  revalidatePath("/admin/vertrieb");
  redirect(`/admin/vertrieb?pwdOk=1`);
}

/* ---------- Vertriebsagent aktiv/inaktiv schalten ---------- */
const ToggleSalesAgentActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.enum(["0","1"]),
});

export async function toggleSalesAgentActive(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = ToggleSalesAgentActiveSchema.safeParse(raw);

  if (!parsed.success) {
    redirect("/admin/vertrieb");
  }

  const { userId, active } = parsed.data;
  const isActive = active === "1";

  const result = await prisma.user.updateMany({
    where: { id: userId, role: "SALES" },
    data: { active: isActive },
  });

  if (result.count === 0) {
    redirect(`/admin/vertrieb?error=${encodeURIComponent("Vertriebsagent wurde nicht gefunden.")}`);
  }

  revalidatePath("/admin/vertrieb");
  redirect("/admin/vertrieb");
}

/* ---------- Vertriebsagent löschen ---------- */
const DeleteSalesAgentSchema = z.object({ userId: z.string().min(1) });

export async function deleteSalesAgent(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = DeleteSalesAgentSchema.safeParse(raw);

  if (!parsed.success) {
    redirect("/admin/vertrieb");
  }

  const { userId } = parsed.data;

  await prisma.user.delete({ where: { id: userId, role: "SALES" } });

  revalidatePath("/admin/vertrieb");
  redirect(`/admin/vertrieb?delOk=1`);
}

/* ---------- Vertriebsagent-Name aktualisieren ---------- */
const UpdateSalesAgentNameSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1, "Name ist erforderlich").transform(v => v.trim()),
});

export async function updateSalesAgentName(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateSalesAgentNameSchema.safeParse(raw);

  if (!parsed.success) {
    redirect(`/admin/vertrieb`);
  }

  const { userId, name } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "SALES" },
    data: { name },
  });

  revalidatePath("/admin/vertrieb");
  redirect(`/admin/vertrieb`);
}

/* ---------- Vertriebsagent-Email aktualisieren ---------- */
const UpdateSalesAgentEmailSchema = z.object({
  userId: z.string().min(1),
  email: EmailField,
});

export async function updateSalesAgentEmail(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateSalesAgentEmailSchema.safeParse(raw);

  if (!parsed.success) {
    redirect(`/admin/vertrieb`);
  }

  const { userId, email } = parsed.data;

  try {
    await prisma.user.update({
      where: { id: userId, role: "SALES" },
      data: { email: email ?? undefined },
    });
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "P2002") {
      redirect(`/admin/vertrieb?error=${encodeURIComponent("E-Mail ist bereits vergeben.")}`);
    }
    redirect(`/admin/vertrieb?error=${encodeURIComponent("Aktualisierung fehlgeschlagen.")}`);
  }

  revalidatePath("/admin/vertrieb");
  redirect(`/admin/vertrieb`);
}
