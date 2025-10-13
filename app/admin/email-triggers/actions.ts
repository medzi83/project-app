"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ProjectType, EmailTriggerType, DelayType } from "@prisma/client";

// Turbopack sometimes tree-shakes Prisma enums in server bundles; provide fallbacks so z.nativeEnum always receives values.
const EmailTriggerTypeEnum =
  EmailTriggerType ??
  ({
    DATE_FIELD_SET: "DATE_FIELD_SET",
    DATE_REACHED: "DATE_REACHED",
    CONDITION_MET: "CONDITION_MET",
    MANUAL: "MANUAL",
  } as const);

const ProjectTypeEnum =
  ProjectType ??
  ({
    WEBSITE: "WEBSITE",
    FILM: "FILM",
    SOCIAL: "SOCIAL",
  } as const);

const DelayTypeEnum =
  DelayType ??
  ({
    BEFORE: "BEFORE",
    AFTER: "AFTER",
    EXACT: "EXACT",
  } as const);

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}

const TriggerSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  active: z.enum(["yes", "no"]).default("yes"),
  triggerType: z.nativeEnum(EmailTriggerTypeEnum),
  projectType: z.nativeEnum(ProjectTypeEnum).optional().nullable(),
  templateId: z.string().min(1, "Template ist erforderlich"),
  delayDays: z.coerce.number().int().optional().nullable(),
  delayType: z.nativeEnum(DelayTypeEnum).optional().nullable(),

  // Conditions (als einzelne Felder, werden zu JSON konvertiert)
  conditionField: z.string().optional(),
  conditionOperator: z.string().optional(),
  conditionCheckField: z.string().optional(),
  conditionDays: z.coerce.number().int().optional().nullable(),

  // Recipients (als einzelne Felder, werden zu JSON konvertiert)
  recipientTo: z.string().min(1, "Empfänger ist erforderlich"),
  recipientCcAgent: z.enum(["yes", "no"]).optional(),
  recipientCcFilmer: z.enum(["yes", "no"]).optional(),
  recipientCcCutter: z.enum(["yes", "no"]).optional(),
});

export async function createTrigger(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = TriggerSchema.safeParse(raw);

  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/email-triggers?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;

  // Build conditions JSON
  const conditions: Record<string, unknown> = {};
  if (data.conditionField) conditions.field = data.conditionField;
  if (data.conditionOperator) conditions.operator = data.conditionOperator;
  if (data.conditionCheckField) conditions.checkField = data.conditionCheckField;
  if (data.conditionDays) conditions.days = data.conditionDays;

  // Build recipient config JSON
  const recipientConfig: Record<string, unknown> = {
    to: data.recipientTo,
    cc: [],
  };

  if (data.recipientCcAgent === "yes") (recipientConfig.cc as string[]).push("AGENT");
  if (data.recipientCcFilmer === "yes") (recipientConfig.cc as string[]).push("FILMER");
  if (data.recipientCcCutter === "yes") (recipientConfig.cc as string[]).push("CUTTER");

  await prisma.emailTrigger.create({
    data: {
      name: data.name,
      description: data.description || null,
      active: data.active === "yes",
      triggerType: data.triggerType,
      projectType: data.projectType || null,
      templateId: data.templateId,
      delayDays: data.delayDays || null,
      delayType: data.delayType || null,
      conditions,
      recipientConfig,
    },
  });

  revalidatePath("/admin/email-triggers");
  redirect("/admin/email-triggers?success=created");
}

export async function updateTrigger(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  if (!id) {
    redirect("/admin/email-triggers?error=Invalid+trigger+ID");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = TriggerSchema.safeParse(raw);

  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/email-triggers?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;

  // Build conditions JSON
  const conditions: Record<string, unknown> = {};
  if (data.conditionField) conditions.field = data.conditionField;
  if (data.conditionOperator) conditions.operator = data.conditionOperator;
  if (data.conditionCheckField) conditions.checkField = data.conditionCheckField;
  if (data.conditionDays) conditions.days = data.conditionDays;

  // Build recipient config JSON
  const recipientConfig: Record<string, unknown> = {
    to: data.recipientTo,
    cc: [],
  };

  if (data.recipientCcAgent === "yes") (recipientConfig.cc as string[]).push("AGENT");
  if (data.recipientCcFilmer === "yes") (recipientConfig.cc as string[]).push("FILMER");
  if (data.recipientCcCutter === "yes") (recipientConfig.cc as string[]).push("CUTTER");

  await prisma.emailTrigger.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      active: data.active === "yes",
      triggerType: data.triggerType,
      projectType: data.projectType || null,
      templateId: data.templateId,
      delayDays: data.delayDays || null,
      delayType: data.delayType || null,
      conditions,
      recipientConfig,
    },
  });

  revalidatePath("/admin/email-triggers");
  redirect("/admin/email-triggers?success=updated");
}

export async function deleteTrigger(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  if (!id) {
    redirect("/admin/email-triggers");
  }

  await prisma.emailTrigger.delete({ where: { id } });

  revalidatePath("/admin/email-triggers");
  redirect("/admin/email-triggers?success=deleted");
}

export async function toggleTrigger(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) {
    redirect("/admin/email-triggers");
  }

  await prisma.emailTrigger.update({
    where: { id },
    data: { active: !active },
  });

  revalidatePath("/admin/email-triggers");
  redirect("/admin/email-triggers");
}
