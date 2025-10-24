"use server";

import { prisma } from "@/lib/prisma";
import { normalizeAgentIdForDB } from "@/lib/agent-helpers";
import type {
  Prisma,
  FilmScope,
  FilmPriority,
  FilmProjectStatus,
} from "@prisma/client";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProjectKey = z.enum(["title"]); // bei Bedarf erweitern
const FilmKey = z.enum([
  "scope","priority","status","note",
  "scouting","scriptToClient","scriptApproved","shootDate",
  "firstCutToClient","finalToClient","onlineDate","lastContact","reminderAt",
  "filmerId","onlineLink","finalLink",
]);

const FormSchema = z.object({
  target: z.enum(["project","film"]),
  id: z.string().min(1),          // projectId
  key: z.string().min(1),
  value: z.string().optional(),
});

const dateKeys = new Set([
  "scouting","scriptToClient","scriptApproved","shootDate",
  "firstCutToClient","finalToClient","onlineDate","lastContact","reminderAt"
]);

function coerce(key: string, v: string | undefined) {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === "") return null;
  if (dateKeys.has(key)) return new Date(s);
  return s;
}

export async function updateFilmInlineField(formData: FormData): Promise<void> {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN","AGENT"].includes(session.user.role || "")) {
    throw new Error("FORBIDDEN");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Bad request");
  const { target, id, key, value } = parsed.data;

  if (target === "project") {
    const projectKey = ProjectKey.parse(key);
    if (projectKey === "title") {
      const nextValue = value && value.trim() !== "" ? value.trim() : null;
      await prisma.project.update({
        where: { id },
        data: { title: nextValue },
      });
    }
  } else {
    const filmKey = FilmKey.parse(key);
    const parsedValue = coerce(filmKey, value);

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
      case "status": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "AKTIV") as FilmProjectStatus;
        updateData.status = nextValue;
        createData.status = nextValue;
        break;
      }
      case "filmerId": {
        const nextAgentId = value && value !== "" ? value : null;
        const { baseAgentId } = normalizeAgentIdForDB(nextAgentId);
        updateData.filmerId = baseAgentId;
        createData.filmerId = baseAgentId;
        break;
      }
      case "scouting":
      case "scriptToClient":
      case "scriptApproved":
      case "shootDate":
      case "firstCutToClient":
      case "finalToClient":
      case "onlineDate":
      case "lastContact":
      case "reminderAt": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData[filmKey] = nextValue;
        createData[filmKey] = nextValue;
        break;
      }
      case "note":
      case "onlineLink":
      case "finalLink": {
        const nextValue = typeof parsedValue === "string" ? parsedValue : null;
        updateData[filmKey] = nextValue;
        createData[filmKey] = nextValue ?? undefined;
        break;
      }
    }

    await prisma.projectFilm.upsert({
      where: { projectId: id },
      update: updateData,
      create: createData,
    });
  }

  revalidatePath("/film-projects");
  revalidatePath(`/film-projects/${id}`);
}
