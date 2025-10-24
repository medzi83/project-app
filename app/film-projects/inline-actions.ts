"use server";

import { prisma } from "@/lib/prisma";
import type {
  Prisma,
  FilmScope,
  FilmPriority,
  FilmProjectStatus,
} from "@prisma/client";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processTriggers } from "@/lib/email/trigger-service";

const FilmKey = z.enum([
  "scope",
  "priority",
  "filmerId",
  "cutterId",
  "contractStart",
  "scouting",
  "scriptToClient",
  "scriptApproved",
  "shootDate",
  "firstCutToClient",
  "finalToClient",
  "finalLink",
  "onlineDate",
  "onlineLink",
  "lastContact",
  "status",
  "reminderAt",
  "note",
]);

const FormSchema = z.object({
  target: z.literal("film"),
  id: z.string().min(1), // projectId
  key: z.string().min(1),
  value: z.string().optional(),
  finalLink: z.string().optional(),
  onlineLink: z.string().optional(),
});

const dateKeys = new Set([
  "contractStart",
  "scriptToClient",
  "scriptApproved",
  "firstCutToClient",
  "finalToClient",
  "onlineDate",
  "lastContact",
  "reminderAt",
]);

const dateTimeKeys = new Set([
  "scouting",
  "shootDate",
]);

function coerce(key: string, v: string | undefined) {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === "") return null;

  // For datetime fields (with time component), parse as Berlin time
  if (dateTimeKeys.has(key)) {
    // Input format: "2025-10-24T14:30" (datetime-local from browser)
    // User enters this time in Berlin timezone, but browser sends it without timezone info
    // We need to interpret it as Berlin time, not UTC

    // Parse the components
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return new Date(s); // Fallback to default parsing

    const [, year, month, day, hours, minutes] = match;

    // Create a date string in Berlin timezone using ISO format with explicit timezone
    // We use 'Europe/Berlin' offset which handles DST automatically
    const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

    // Get the timezone offset for Berlin at this specific date
    const berlinDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offset = (berlinDate.getTime() - utcDate.getTime());

    // Adjust the date by the offset to store it correctly in UTC
    return new Date(date.getTime() - offset);
  }

  // For date-only fields, create date at midnight Berlin time
  if (dateKeys.has(key)) {
    // Input format: "2025-10-24" (date from browser)
    // Create at midnight Berlin time
    const date = new Date(s + 'T00:00:00');
    const berlinDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offset = (berlinDate.getTime() - utcDate.getTime());
    return new Date(date.getTime() - offset);
  }

  return s;
}

function normalizeLink(raw?: string | null) {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return trimmed;
}

export async function updateFilmInlineField(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    return { success: false, error: "Keine Berechtigung" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Ungültige Anfrage" };
  const { id, key, value, finalLink: finalLinkRaw, onlineLink: onlineLinkRaw } = parsed.data;

  const filmKey = FilmKey.parse(key);
  const parsedValue = coerce(filmKey, value);
  const normalizedFinalLinkInput = normalizeLink(finalLinkRaw);
  const normalizedOnlineLinkInput = normalizeLink(onlineLinkRaw);
  const existingFilm = await prisma.projectFilm.findUnique({
    where: { projectId: id },
    select: {
      finalLink: true,
      onlineDate: true,
      onlineLink: true,
    },
  });
  const updateData: Prisma.ProjectFilmUncheckedUpdateInput = {};
  const createData: Prisma.ProjectFilmUncheckedCreateInput = { projectId: id };

  switch (filmKey) {
    case "scope": {
      const nextValue = (typeof parsedValue === "string" ? parsedValue : "FILM") as FilmScope;
      updateData.scope = nextValue;
      createData.scope = nextValue;
      break;
    }
    case "priority": {
      const nextValue = (typeof parsedValue === "string" ? parsedValue : "NONE") as FilmPriority;
      updateData.priority = nextValue;
      createData.priority = nextValue;
      break;
    }
    case "filmerId": {
      const nextValue = typeof parsedValue === "string" ? parsedValue : null;
      updateData.filmerId = nextValue;
      createData.filmerId = nextValue;
      break;
    }
    case "cutterId": {
      const nextValue = typeof parsedValue === "string" ? parsedValue : null;
      updateData.cutterId = nextValue;
      createData.cutterId = nextValue;
      break;
    }
    case "contractStart":
    case "scouting":
    case "scriptToClient":
    case "scriptApproved":
    case "shootDate":
    case "firstCutToClient":
    case "onlineDate":
    case "lastContact":
    case "reminderAt": {
      const nextValue = parsedValue instanceof Date ? parsedValue : null;
      updateData[filmKey] = nextValue;
      createData[filmKey] = nextValue;
      break;
    }
    case "finalToClient": {
      const nextValue = parsedValue instanceof Date ? parsedValue : null;
      const incomingLink = normalizedFinalLinkInput !== undefined ? normalizedFinalLinkInput : existingFilm?.finalLink;
      if (nextValue && !incomingLink) {
        return { success: false, error: "Bitte auch einen Finalversion-Link hinterlegen." };
      }
      updateData.finalToClient = nextValue;
      createData.finalToClient = nextValue;
      if (incomingLink !== undefined) {
        updateData.finalLink = incomingLink ?? null;
        createData.finalLink = incomingLink ?? undefined;
      }
      if (!nextValue && normalizedFinalLinkInput === null) {
        updateData.finalLink = null;
        createData.finalLink = undefined;
      }
      if (nextValue) {
        const linkForOnline =
          incomingLink !== undefined
            ? incomingLink
            : existingFilm?.finalLink ?? existingFilm?.onlineLink ?? null;
        if (existingFilm?.onlineDate && linkForOnline) {
          updateData.onlineLink = linkForOnline;
          createData.onlineLink = linkForOnline;
        }
      }
      break;
    }
    case "finalLink": {
      const linkValue =
        typeof parsedValue === "string"
          ? parsedValue
          : normalizedFinalLinkInput !== undefined
            ? normalizedFinalLinkInput
            : null;
      updateData.finalLink = linkValue;
      createData.finalLink = linkValue ?? undefined;
      if (existingFilm?.onlineDate) {
        updateData.onlineLink = linkValue;
        createData.onlineLink = linkValue ?? undefined;
      }
      break;
    }
    case "onlineDate": {
      const nextValue = parsedValue instanceof Date ? parsedValue : null;
      updateData.onlineDate = nextValue;
      createData.onlineDate = nextValue;
      if (nextValue) {
        const linkCandidate =
          normalizedOnlineLinkInput !== undefined
            ? normalizedOnlineLinkInput
            : normalizedFinalLinkInput !== undefined
              ? normalizedFinalLinkInput
              : updateData.finalLink && typeof updateData.finalLink === "string"
                ? updateData.finalLink
                : existingFilm?.finalLink ?? existingFilm?.onlineLink ?? null;
        if (!linkCandidate) {
          return { success: false, error: "Bitte den Finalversion-Link hinterlegen, bevor ein Online-Datum gesetzt wird." };
        }
        updateData.onlineLink = linkCandidate;
        createData.onlineLink = linkCandidate;
      } else {
        if (normalizedOnlineLinkInput !== undefined) {
          updateData.onlineLink = normalizedOnlineLinkInput;
          createData.onlineLink = normalizedOnlineLinkInput ?? undefined;
        } else {
          updateData.onlineLink = null;
          createData.onlineLink = undefined;
        }
      }
      break;
    }
    case "onlineLink": {
      const linkValue =
        typeof parsedValue === "string"
          ? parsedValue
          : normalizedOnlineLinkInput !== undefined
            ? normalizedOnlineLinkInput
            : null;
      updateData.onlineLink = linkValue;
      createData.onlineLink = linkValue ?? undefined;
      break;
    }
    case "status": {
      const nextValue = (typeof parsedValue === "string" ? parsedValue : "AKTIV") as FilmProjectStatus;
      updateData.status = nextValue;
      createData.status = nextValue;
      break;
    }
    case "note": {
      const nextValue = typeof parsedValue === "string" ? parsedValue : null;
      updateData.note = nextValue;
      createData.note = nextValue ?? undefined;
      break;
    }
  }

  await prisma.projectFilm.upsert({
    where: { projectId: id },
    update: updateData,
    create: createData,
  });

  revalidatePath("/film-projects");
  revalidatePath(`/film-projects/${id}`);
  revalidatePath(`/film-projects/${id}/edit`);

  return { success: true };
}

const PreviewVersionSchema = z.object({
  projectId: z.string().min(1),
  version: z.coerce.number().int().positive(),
  sentDate: z.string().min(1),
  link: z.string().url("Link muss eine gültige URL sein").min(1, "Link ist erforderlich"),
});

export async function addPreviewVersion(formData: FormData) {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    throw new Error("FORBIDDEN");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = PreviewVersionSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Bad request");

  const { projectId, version, sentDate, link } = parsed.data;

  const parsedSentDate = new Date(sentDate);

  // Check if this preview version existed before (to determine old value for triggers)
  const existingPreview = await prisma.filmPreviewVersion.findUnique({
    where: {
      projectId_version: {
        projectId,
        version,
      },
    },
  });

  await prisma.filmPreviewVersion.upsert({
    where: {
      projectId_version: {
        projectId,
        version,
      },
    },
    update: {
      sentDate: parsedSentDate,
      link,
    },
    create: {
      projectId,
      version,
      sentDate: parsedSentDate,
      link,
    },
  });

  // Process email triggers for preview version
  // Pass the old date if updating, null if creating new version
  const queueIds = await processTriggers(
    projectId,
    { previewDate: parsedSentDate },
    { previewDate: existingPreview?.sentDate ?? null }
  );

  revalidatePath("/film-projects");

  // Return queue IDs for confirmation dialog
  return queueIds;
}
