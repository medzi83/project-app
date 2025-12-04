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

  // For datetime fields: "2025-10-24T14:30" -> store as "2025-10-24T14:30:00.000Z" (naive, no timezone conversion)
  if (dateTimeKeys.has(key)) {
    // Simply append seconds and treat as UTC (naive storage)
    return new Date(s + ':00.000Z');
  }

  // For date-only fields: "2025-10-24" -> store as "2025-10-24T00:00:00.000Z" (naive, no timezone conversion)
  if (dateKeys.has(key)) {
    return new Date(s + 'T00:00:00.000Z');
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

  // Load existing film data including the field being updated (for trigger comparison)
  const existingFilm = await prisma.projectFilm.findUnique({
    where: { projectId: id },
    select: {
      finalLink: true,
      onlineDate: true,
      onlineLink: true,
      finalToClient: true,
      firstCutToClient: true,
      scouting: true,
      scriptToClient: true,
      scriptApproved: true,
      shootDate: true,
    },
  });

  // Store old value for trigger comparison
  const oldValue = existingFilm?.[filmKey as keyof typeof existingFilm] ?? null;
  const updateData: Prisma.ProjectFilmUncheckedUpdateInput = {};

  switch (filmKey) {
    case "scope": {
      const nextValue = (typeof parsedValue === "string" ? parsedValue : "FILM") as FilmScope;
      updateData.scope = nextValue;
      break;
    }
    case "priority": {
      const nextValue = (typeof parsedValue === "string" ? parsedValue : "NONE") as FilmPriority;
      updateData.priority = nextValue;
      break;
    }
    case "filmerId": {
      const nextValue = typeof parsedValue === "string" ? parsedValue : null;
      updateData.filmerId = nextValue;
      break;
    }
    case "cutterId": {
      const nextValue = typeof parsedValue === "string" ? parsedValue : null;
      updateData.cutterId = nextValue;
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
      break;
    }
    case "finalToClient": {
      const nextValue = parsedValue instanceof Date ? parsedValue : null;
      const incomingLink = normalizedFinalLinkInput !== undefined ? normalizedFinalLinkInput : existingFilm?.finalLink;
      if (nextValue && !incomingLink) {
        return { success: false, error: "Bitte auch einen Finalversion-Link hinterlegen." };
      }
      updateData.finalToClient = nextValue;
      if (incomingLink !== undefined) {
        updateData.finalLink = incomingLink ?? null;
      }
      if (!nextValue && normalizedFinalLinkInput === null) {
        updateData.finalLink = null;
      }
      if (nextValue) {
        const linkForOnline =
          incomingLink !== undefined
            ? incomingLink
            : existingFilm?.finalLink ?? existingFilm?.onlineLink ?? null;
        if (existingFilm?.onlineDate && linkForOnline) {
          updateData.onlineLink = linkForOnline;
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
      if (existingFilm?.onlineDate) {
        updateData.onlineLink = linkValue;
      }
      break;
    }
    case "onlineDate": {
      const nextValue = parsedValue instanceof Date ? parsedValue : null;
      updateData.onlineDate = nextValue;
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
      } else {
        if (normalizedOnlineLinkInput !== undefined) {
          updateData.onlineLink = normalizedOnlineLinkInput;
        } else {
          updateData.onlineLink = null;
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
      break;
    }
    case "status": {
      const nextValue = typeof parsedValue === "string" ? (parsedValue as FilmProjectStatus) : null;
      updateData.status = nextValue;
      break;
    }
    case "note": {
      const nextValue = typeof parsedValue === "string" ? parsedValue : null;
      updateData.note = nextValue;
      break;
    }
  }

  await prisma.projectFilm.update({
    where: { projectId: id },
    data: updateData,
  });

  // Process email triggers for date changes (like finalToClient, onlineDate, etc.)
  const dateFieldsForTriggers = [
    'finalToClient', 'onlineDate', 'firstCutToClient',
    'scouting', 'scriptToClient', 'scriptApproved', 'shootDate'
  ];

  if (dateFieldsForTriggers.includes(filmKey)) {
    try {
      await processTriggers(
        id,
        { [filmKey]: parsedValue },
        { [filmKey]: oldValue }
      );
    } catch (error) {
      console.error("Error processing triggers:", error);
      // Don't fail the update if trigger processing fails
    }
  }

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
