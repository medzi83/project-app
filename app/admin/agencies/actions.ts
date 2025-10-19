"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import path from "path";
import fs from "fs/promises";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type ParsedAgencyData = {
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
};

const SUPPORTED_LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp"] as const;
const MIME_EXTENSION_MAP: Record<string, typeof SUPPORTED_LOGO_EXTENSIONS[number]> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  return session;
}

function baseRedirect(params?: Record<string, string | undefined>): never {
  if (!params || Object.keys(params).length === 0) {
    redirect("/admin/agencies");
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      search.set(key, value);
    }
  }
  redirect(`/admin/agencies?${search.toString()}`);
}

function sanitizeString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNullable(value: FormDataEntryValue | null): string | null {
  const trimmed = sanitizeString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function validateEmail(email: string): boolean {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_REGEX.test(email);
}

function validateWebsite(url: string): boolean {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function parseAgencyForm(formData: FormData): ParsedAgencyData | { error: string } {
  const name = sanitizeString(formData.get("name"));
  if (!name) {
    return { error: "Name der Agentur fehlt." };
  }

  const contactName = toNullable(formData.get("contactName"));
  const contactEmailRaw = toNullable(formData.get("contactEmail"));
  if (contactEmailRaw && !validateEmail(contactEmailRaw)) {
    return { error: "Kontakt-E-Mail ist ungültig." };
  }
  const contactPhone = toNullable(formData.get("contactPhone"));
  const street = toNullable(formData.get("street"));
  const postalCode = toNullable(formData.get("postalCode"));
  const city = toNullable(formData.get("city"));
  const country = toNullable(formData.get("country"));

  const websiteRaw = toNullable(formData.get("website"));
  if (websiteRaw && !validateWebsite(websiteRaw)) {
    return { error: "Website-URL ist ungültig." };
  }

  const notes = toNullable(formData.get("notes"));

  return {
    name,
    contactName,
    contactEmail: contactEmailRaw,
    contactPhone,
    street,
    postalCode,
    city,
    country,
    website: websiteRaw ? (websiteRaw.includes("://") ? websiteRaw : `https://${websiteRaw}`) : null,
    notes,
  };
}

async function ensureLogoDirectory(): Promise<string> {
  const target = path.join(process.cwd(), "public", "uploads", "agencies");
  await fs.mkdir(target, { recursive: true });
  return target;
}

function deduceExtension(file: File): typeof SUPPORTED_LOGO_EXTENSIONS[number] {
  const type = file.type?.toLowerCase();
  if (type && MIME_EXTENSION_MAP[type]) {
    return MIME_EXTENSION_MAP[type];
  }
  const ext = path.extname(file.name || "").toLowerCase().replace(".", "");
  if (SUPPORTED_LOGO_EXTENSIONS.includes(ext as typeof SUPPORTED_LOGO_EXTENSIONS[number])) {
    return ext === "jpeg" ? "jpg" : (ext as typeof SUPPORTED_LOGO_EXTENSIONS[number]);
  }
  throw new Error("Nur PNG, JPG, SVG oder WEBP werden als Logo akzeptiert.");
}

async function saveAgencyLogo(agencyId: string, file: File, type: "logo" | "icon"): Promise<string> {
  if (!file.size) {
    throw new Error("Hochgeladene Datei ist leer.");
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error("Logo darf maximal 5 MB gross sein.");
  }

  const ext = deduceExtension(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const directory = await ensureLogoDirectory();
  const filename = `${agencyId}-${type}.${ext}`;
  const filePath = path.join(directory, filename);

  await fs.writeFile(filePath, buffer);
  return path.join("uploads", "agencies", filename);
}

async function removeLogoIfExists(relativePath: string | null | undefined) {
  if (!relativePath) return;
  const absolute = path.join(process.cwd(), "public", relativePath);
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "ENOENT") {
      return;
    }
    console.error("Logo konnte nicht entfernt werden:", error);
  }
}

async function revalidateAgencyDependencies() {
  revalidatePath("/admin/agencies");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/projects/new");
  revalidatePath("/admin/email-templates");
  revalidatePath("/admin/statistics");
}

export async function createAgency(formData: FormData) {
  await requireAdmin();

  const parsed = parseAgencyForm(formData);
  if ("error" in parsed) {
    baseRedirect({ error: parsed.error });
  }

  const agency = await prisma.agency.create({
    data: parsed as ParsedAgencyData,
  });

  const logoErrors: string[] = [];
  let logoPath: string | undefined;
  let logoIconPath: string | undefined;

  // Handle main logo
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    try {
      logoPath = await saveAgencyLogo(agency.id, logo, "logo");
    } catch (error) {
      logoErrors.push(error instanceof Error ? error.message : "Haupt-Logo konnte nicht gespeichert werden.");
    }
  }

  // Handle icon logo
  const logoIcon = formData.get("logoIcon");
  if (logoIcon instanceof File && logoIcon.size > 0) {
    try {
      logoIconPath = await saveAgencyLogo(agency.id, logoIcon, "icon");
    } catch (error) {
      logoErrors.push(error instanceof Error ? error.message : "Icon-Logo konnte nicht gespeichert werden.");
    }
  }

  // Update agency with logo paths if any were uploaded
  if (logoPath || logoIconPath) {
    await prisma.agency.update({
      where: { id: agency.id },
      data: {
        ...(logoPath ? { logoPath } : {}),
        ...(logoIconPath ? { logoIconPath } : {}),
      },
    });
  }

  await revalidateAgencyDependencies();
  baseRedirect({
    success: "Agentur wurde angelegt.",
    ...(logoErrors.length > 0 ? { warning: logoErrors.join(" ") } : {}),
  });
}

export async function updateAgency(formData: FormData) {
  await requireAdmin();
  const agencyId = sanitizeString(formData.get("agencyId"));
  if (!agencyId) {
    baseRedirect({ error: "Agentur-ID fehlt." });
  }

  const existing = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!existing) {
    baseRedirect({ error: "Agentur wurde nicht gefunden." });
  }

  const parsed = parseAgencyForm(formData);
  if ("error" in parsed) {
    baseRedirect({ error: parsed.error });
  }

  await prisma.agency.update({
    where: { id: existing.id },
    data: parsed as ParsedAgencyData,
  });

  await revalidateAgencyDependencies();
  baseRedirect({
    success: "Agentur wurde aktualisiert.",
  });
}

export async function deleteAgency(formData: FormData) {
  await requireAdmin();
  const agencyId = sanitizeString(formData.get("agencyId"));
  if (!agencyId) {
    baseRedirect({ error: "Agentur-ID fehlt." });
  }

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, logoPath: true, logoIconPath: true, clients: { select: { id: true } } },
  });

  if (!agency) {
    baseRedirect({ error: "Agentur wurde nicht gefunden." });
  }

  if (agency.clients.length > 0) {
    baseRedirect({ error: "Agentur kann nicht gelöscht werden, solange Kunden zugeordnet sind." });
  }

  await prisma.agency.delete({ where: { id: agency.id } });
  await removeLogoIfExists(agency.logoPath);
  await removeLogoIfExists(agency.logoIconPath);

  await revalidateAgencyDependencies();
  baseRedirect({ success: "Agentur wurde gelöscht." });
}
