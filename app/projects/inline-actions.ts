"use server";

import { prisma } from "@/lib/prisma";
import { deriveProjectStatus } from "@/lib/project-status";
import { normalizeAgentIdForDB } from "@/lib/agent-helpers";
import { processTriggers } from "@/lib/email/trigger-service";
import type {
  Prisma,
  WebsitePriority,
  ProductionStatus,
  CMS,
  MaterialStatus,
  SEOStatus,
  TextitStatus,
} from "@prisma/client";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProjectKey = z.enum(["agentId"]); // bei Bedarf erweitern (z.B. "title")
const WebsiteKey = z.enum([
  "domain","priority","pStatus","cms",
  "webDate","demoDate","onlineDate","lastMaterialAt",
  "effortBuildMin","effortDemoMin",
  "materialStatus","seo","textit","accessible","note",
]);

const FormSchema = z.object({
  target: z.enum(["project","website"]),
  id: z.string().min(1),          // projectId
  key: z.string().min(1),
  value: z.string().optional(),
  extraValue: z.string().optional(), // For datetime-with-type: webterminType
});

const dateKeys = new Set(["webDate","demoDate","onlineDate","lastMaterialAt"]);
const hourKeys  = new Set(["effortBuildMin","effortDemoMin"]);
const triKeys  = new Set(["accessible"]);
const statusRelevantWebsiteKeys = new Set(["pStatus","webDate","demoDate","onlineDate","materialStatus"]);

function coerce(key: string, v: string | undefined) {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === "") return null;
  if (dateKeys.has(key)) return new Date(s);
  if (hourKeys.has(key)) {
    const numeric = Number(s.replace(",", "."));
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 60);
  }
  if (triKeys.has(key))  return s === "yes" ? true : s === "no" ? false : null;
  return s;
}

export async function updateInlineField(formData: FormData): Promise<{ emailTriggered: boolean }> {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN","AGENT"].includes(session.user.role || "")) {
    throw new Error("FORBIDDEN");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Bad request");
  const { target, id, key, value, extraValue } = parsed.data;

  let emailTriggered = false;

  if (target === "project") {
    const projectKey = ProjectKey.parse(key);
    const nextAgentId = value && value !== "" ? value : null;
    if (projectKey === "agentId") {
      const { baseAgentId, isWTAssignment } = normalizeAgentIdForDB(nextAgentId);

      // Update both the project's agentId and the website's isWTAssignment flag
      await prisma.$transaction([
        prisma.project.update({ where: { id }, data: { agentId: baseAgentId } }),
        prisma.projectWebsite.upsert({
          where: { projectId: id },
          update: { isWTAssignment },
          create: { projectId: id, isWTAssignment },
        }),
      ]);
    }
  } else {
    const websiteKey = WebsiteKey.parse(key);
    const parsedValue = coerce(websiteKey, value);

    // Fetch old values for trigger comparison
    const oldProject = await prisma.project.findUnique({
      where: { id },
      include: { website: true },
    });
    const oldValue = oldProject?.website?.[websiteKey as keyof typeof oldProject.website];

    const updateData: Prisma.ProjectWebsiteUncheckedUpdateInput = {};
    const createData: Prisma.ProjectWebsiteUncheckedCreateInput = { projectId: id };

    switch (websiteKey) {
      case "domain": {
        const nextValue = typeof parsedValue === "string" ? parsedValue : null;
        updateData.domain = nextValue;
        createData.domain = nextValue ?? undefined;
        break;
      }
      case "priority": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NONE") as WebsitePriority;
        updateData.priority = nextValue;
        createData.priority = nextValue;
        break;
      }
      case "pStatus": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NONE") as ProductionStatus;
        updateData.pStatus = nextValue;
        createData.pStatus = nextValue;
        break;
      }
      case "cms": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "SHOPWARE") as CMS;
        updateData.cms = nextValue;
        createData.cms = nextValue;
        break;
      }
      case "webDate": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.webDate = nextValue;
        createData.webDate = nextValue;
        // Also handle webterminType if extraValue is provided
        if (extraValue !== undefined) {
          const nextType = extraValue.trim() !== "" ? extraValue as "TELEFONISCH" | "BEIM_KUNDEN" | "IN_DER_AGENTUR" : null;
          updateData.webterminType = nextType;
          createData.webterminType = nextType;
        }
        break;
      }
      case "demoDate": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.demoDate = nextValue;
        createData.demoDate = nextValue;
        break;
      }
      case "onlineDate": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.onlineDate = nextValue;
        createData.onlineDate = nextValue;
        break;
      }
      case "lastMaterialAt": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.lastMaterialAt = nextValue;
        createData.lastMaterialAt = nextValue;
        break;
      }
      case "effortBuildMin": {
        const nextValue = typeof parsedValue === "number" ? parsedValue : null;
        updateData.effortBuildMin = nextValue;
        createData.effortBuildMin = nextValue;
        break;
      }
      case "effortDemoMin": {
        const nextValue = typeof parsedValue === "number" ? parsedValue : null;
        updateData.effortDemoMin = nextValue;
        createData.effortDemoMin = nextValue;
        break;
      }
      case "materialStatus": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "ANGEFORDERT") as MaterialStatus;
        updateData.materialStatus = nextValue;
        createData.materialStatus = nextValue;
        break;
      }
      case "seo": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NEIN") as SEOStatus;
        updateData.seo = nextValue;
        createData.seo = nextValue;
        break;
      }
      case "textit": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NEIN") as TextitStatus;
        updateData.textit = nextValue;
        createData.textit = nextValue;
        break;
      }
      case "accessible": {
        const nextValue = typeof parsedValue === "boolean" ? parsedValue : null;
        updateData.accessible = nextValue;
        createData.accessible = nextValue;
        break;
      }
      case "note": {
        const nextValue = typeof parsedValue === "string" ? parsedValue : null;
        updateData.note = nextValue;
        createData.note = nextValue ?? undefined;
        break;
      }
    }

    await prisma.projectWebsite.upsert({
      where: { projectId: id },
      update: updateData,
      create: createData,
    });

    // Process email triggers and get confirmation queue IDs
    try {
      const queueIds = await processTriggers(
        id,
        { [websiteKey]: parsedValue },
        { [websiteKey]: oldValue }
      );
      if (queueIds && queueIds.length > 0) {
        emailTriggered = true;
      }
    } catch (error) {
      console.error("Error processing triggers:", error);
      // Don't fail the update if trigger processing fails
    }

    if (statusRelevantWebsiteKeys.has(websiteKey)) {
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          status: true,
          website: {
            select: {
              pStatus: true,
              webDate: true,
              demoDate: true,
              onlineDate: true,
              materialStatus: true,
            },
          },
        },
      });
      if (project) {
        const nextStatus = deriveProjectStatus({
          pStatus: project.website?.pStatus,
          webDate: project.website?.webDate,
          demoDate: project.website?.demoDate,
          onlineDate: project.website?.onlineDate,
          materialStatus: project.website?.materialStatus,
        });
        if (project.status !== nextStatus) {
          await prisma.project.update({ where: { id }, data: { status: nextStatus } });
        }
      }
    }
  }

  revalidatePath("/projects");
  return { emailTriggered };
}
















