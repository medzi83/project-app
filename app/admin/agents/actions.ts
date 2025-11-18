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
    redirect("/"); // notfalls raus
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

/* ---------- Agent anlegen ---------- */
const hexColorPattern = /^#([0-9a-fA-F]{6})$/;

const ColorField = z
  .union([z.literal(""), z.string().regex(hexColorPattern, "Ungueltige Farbe")])
  .optional()
  .transform((value) => {
    if (!value || value === "") return null;
    return value.toUpperCase();
  });

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

const CreateAgentSchema = z.object({
  name: z.string().optional().transform(v => v?.trim() || null),
  fullName: z.string().optional().transform(v => v?.trim() || null),
  roleTitle: z.string().optional().transform(v => v?.trim() || null),
  email: EmailField,
  password: z.string().min(8, "Mind. 8 Zeichen"),
  color: ColorField,
  categories: z.array(z.enum(["WEBSEITE", "FILM", "SOCIALMEDIA", "PRINT_DESIGN"])).default([]),
});

export async function createAgent(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const categoriesRaw = formData.getAll("categories");

  // Ensure categories is always an array and filter valid values
  const validCategories = (Array.isArray(categoriesRaw) ? categoriesRaw : [categoriesRaw])
    .filter((cat): cat is string => typeof cat === "string" && ["WEBSEITE", "FILM", "SOCIALMEDIA", "PRINT_DESIGN"].includes(cat));

  const parsed = CreateAgentSchema.safeParse({
    ...raw,
    categories: validCategories,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`/admin/agents?agentError=${encodeURIComponent(msg)}`);
  }

  const { name, fullName, roleTitle, email, password, color, categories } = parsed.data;
  try {
    await prisma.user.create({
      data: {
        name,
        fullName,
        roleTitle,
        email: email ?? undefined,
        password: bcrypt.hashSync(password, 10),
        role: "AGENT",
        color,
        categories: { set: categories },
      },
    });
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "P2002") {
      redirect(`/admin/agents?agentError=${encodeURIComponent("E-Mail ist bereits vergeben.")}`);
    }
    redirect(`/admin/agents?agentError=${encodeURIComponent("Anlegen fehlgeschlagen.")}`);
  }

  revalidatePath("/admin/agents");
  redirect(`/admin/agents?agentOk=1`);
}
/* ---------- Agenten-Passwort zuruecksetzen ---------- */
const ResetPwdSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8, "Mind. 8 Zeichen"),
});

export async function resetAgentPassword(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = ResetPwdSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`/admin/agents?pwdError=${encodeURIComponent(msg)}`);
  }

  const { userId, newPassword } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "AGENT" },
    data: { password: bcrypt.hashSync(newPassword, 10) },
  });

  revalidatePath("/admin/agents");
  redirect(`/admin/agents?pwdOk=1`);
}

/* ---------- (Optional) Agent-Name aktualisieren ---------- */
const UpdateAgentNameSchema = z.object({
  userId: z.string().min(1),
  name: z.string().optional().transform(v => v?.trim() || null),
});
export async function updateAgentName(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateAgentNameSchema.safeParse(raw);
  if (!parsed.success) redirect(`/admin/agents`);

  const { userId, name } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "AGENT" },
    data: { name },
  });

  revalidatePath("/admin/agents");
  revalidatePath("/projects");
  redirect(`/admin/agents`);
}

/* ---------- Agent Voller Name aktualisieren ---------- */
const UpdateAgentFullNameSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().optional().transform(v => v?.trim() || null),
});
export async function updateAgentFullName(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateAgentFullNameSchema.safeParse(raw);
  if (!parsed.success) redirect(`/admin/agents`);

  const { userId, fullName } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "AGENT" },
    data: { fullName },
  });

  revalidatePath("/admin/agents");
  redirect(`/admin/agents`);
}

/* ---------- Agent Rollenbezeichnung aktualisieren ---------- */
const UpdateAgentRoleTitleSchema = z.object({
  userId: z.string().min(1),
  roleTitle: z.string().optional().transform(v => v?.trim() || null),
});
export async function updateAgentRoleTitle(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateAgentRoleTitleSchema.safeParse(raw);
  if (!parsed.success) redirect(`/admin/agents`);

  const { userId, roleTitle } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "AGENT" },
    data: { roleTitle },
  });

  revalidatePath("/admin/agents");
  redirect(`/admin/agents`);
}

const UpdateAgentColorSchema = z.object({
  userId: z.string().min(1),
  color: ColorField,
  mode: z.enum(["save", "clear"]).default("save"),
});

export async function updateAgentColor(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateAgentColorSchema.safeParse(raw);
  if (!parsed.success) redirect(`/admin/agents`);

  const { userId, color, mode } = parsed.data;
  const nextColor = mode === "clear" ? null : color;

  await prisma.user.update({
    where: { id: userId, role: "AGENT" },
    data: { color: nextColor },
  });

  revalidatePath("/admin/agents");
  revalidatePath("/projects");
  redirect(`/admin/agents`);
}

/* ---------- Agent aktiv/inaktiv schalten ---------- */
const ToggleAgentActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.enum(["0","1"]),
});

export async function toggleAgentActive(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = ToggleAgentActiveSchema.safeParse(raw);
  if (!parsed.success) redirect("/admin/agents");

  const { userId, active } = parsed.data;
  const isActive = active === "1";

  const result = await prisma.user.updateMany({
    where: { id: userId, role: "AGENT" },
    data: { active: isActive },
  });

  if (result.count === 0) {
    redirect(`/admin/agents?agentError=${encodeURIComponent("Agent wurde nicht gefunden.")}`);
  }

  revalidatePath("/admin/agents");
  redirect("/admin/agents");
}

/* ---------- Agent-Kategorien aktualisieren ---------- */
const UpdateAgentCategoriesSchema = z.object({
  userId: z.string().min(1),
  categories: z.array(z.enum(["WEBSEITE", "FILM", "SOCIALMEDIA", "PRINT_DESIGN"])).optional().default([]),
});

export async function updateAgentCategories(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const categoriesRaw = formData.getAll("categories");
  const parsed = UpdateAgentCategoriesSchema.safeParse({
    ...raw,
    categories: categoriesRaw,
  });
  if (!parsed.success) redirect(`/admin/agents`);

  const { userId, categories } = parsed.data;
  await prisma.user.update({
    where: { id: userId, role: "AGENT" },
    data: { categories: { set: categories } },
  });

  revalidatePath("/admin/agents");
  revalidatePath("/projects");
  redirect(`/admin/agents`);
}

/* ---------- Agent löschen ---------- */
const DeleteAgentSchema = z.object({ userId: z.string().min(1) });

export async function deleteAgent(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = DeleteAgentSchema.safeParse(raw);
  if (!parsed.success) redirect("/admin/agents");

  const { userId } = parsed.data;

  // Verhindere Löschung, wenn Notizen existieren (FK-Bindung)
  const notes = await prisma.projectNote.count({ where: { authorId: userId } });
  if (notes > 0) {
    redirect(`/admin/agents?agentError=${encodeURIComponent("Agent hat Notizen und kann nicht gelöscht werden.")}`);
  }

  await prisma.$transaction([
    // Projekte von Agent lösen
    prisma.project.updateMany({ where: { agentId: userId }, data: { agentId: null } }),
    // Agent löschen
    prisma.user.delete({ where: { id: userId } }),
  ]);

  revalidatePath("/admin/agents");
  revalidatePath("/projects");
  redirect(`/admin/agents?delOk=1`);
}















