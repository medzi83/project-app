"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DEFAULT_SIGNATURE_KEY } from "./constants";

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}

const CreateTemplateSchema = z.object({
  title: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Titel ist erforderlich")),
  subject: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Betreff ist erforderlich")),
  body: z
    .string()
    .pipe(z.string().min(1, "Vorlagentext ist erforderlich")),
});

const UpdateTemplateSchema = CreateTemplateSchema.extend({
  id: z.string().min(1, "Template-ID fehlt"),
});

const DeleteTemplateSchema = z.object({
  id: z.string().min(1, "Template-ID fehlt"),
});

const SignatureSchema = z.object({
  body: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Signatur darf nicht leer sein")),
  agencyId: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null)),
});

function parseForm<T extends z.ZodTypeAny>(schema: T, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    return { success: false, message };
  }
  return { success: true, data: parsed.data as z.infer<T> };
}

function handlePrismaError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") {
      return "Titel ist bereits vergeben.";
    }
  }
  return "Aktion fehlgeschlagen.";
}

function buildRedirect(searchParamKey: string, message?: string) {
  const base = "/admin/email-templates";
  if (!message) {
    redirect(base);
  }
  redirect(`${base}?${searchParamKey}=${encodeURIComponent(message)}`);
}

export async function createEmailTemplate(formData: FormData) {
  await requireAdmin();

  const parsed = parseForm(CreateTemplateSchema, formData);
  if (!parsed.success) {
    buildRedirect("error", parsed.message);
  }

  try {
    await prisma.emailTemplate.create({
      data: parsed.data!,
    });
  } catch (error) {
    buildRedirect("error", handlePrismaError(error));
  }

  revalidatePath("/admin/email-templates");
  buildRedirect("success", "Vorlage angelegt.");
}

export async function updateEmailTemplate(formData: FormData) {
  await requireAdmin();

  const parsed = parseForm(UpdateTemplateSchema, formData);
  if (!parsed.success) {
    buildRedirect("error", parsed.message);
  }

  const { id, title, subject, body } = parsed.data!;
  try {
    await prisma.emailTemplate.update({
      where: { id },
      data: { title, subject, body },
    });
  } catch (error) {
    buildRedirect("error", handlePrismaError(error));
  }

  revalidatePath("/admin/email-templates");
  buildRedirect("success", "Vorlage gespeichert.");
}

export async function deleteEmailTemplate(formData: FormData) {
  await requireAdmin();

  const parsed = parseForm(DeleteTemplateSchema, formData);
  if (!parsed.success) {
    buildRedirect("error", parsed.message);
  }

  const { id } = parsed.data!;

  // Check if template is used by any triggers
  const triggersUsingTemplate = await prisma.emailTrigger.count({
    where: { templateId: id },
  });

  if (triggersUsingTemplate > 0) {
    buildRedirect(
      "error",
      `Vorlage kann nicht gelöscht werden. Sie wird von ${triggersUsingTemplate} Trigger(n) verwendet. Bitte löschen Sie zuerst die zugehörigen Trigger.`
    );
  }

  try {
    await prisma.emailTemplate.delete({
      where: { id },
    });
  } catch (error) {
    buildRedirect("error", handlePrismaError(error));
  }

  revalidatePath("/admin/email-templates");
  buildRedirect("success", "Vorlage gelöscht.");
}

export async function updateEmailSignature(formData: FormData) {
  await requireAdmin();

  const parsed = parseForm(SignatureSchema, formData);
  if (!parsed.success) {
    buildRedirect("error", parsed.message);
  }

  const { body, agencyId } = parsed.data!;
  const normalizedAgencyId = agencyId ?? null;
  const key = normalizedAgencyId ? `agency_${normalizedAgencyId}` : DEFAULT_SIGNATURE_KEY;

  await prisma.emailSignature.upsert({
    where: { key },
    update: { body, agencyId: normalizedAgencyId },
    create: { key, body, agencyId: normalizedAgencyId },
  });

  revalidatePath("/admin/email-templates");
  buildRedirect("success", "Signatur gespeichert.");
}
