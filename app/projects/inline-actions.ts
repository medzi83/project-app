"use server";

import { prisma } from "@/lib/prisma";
import { deriveProjectStatus } from "@/lib/project-status";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProjectKey = z.enum(["agentId"]); // bei Bedarf erweitern (z.B. "title")
const WebsiteKey = z.enum([
  "domain","priority","pStatus","cms",
  "webDate","demoDate","onlineDate","lastMaterialAt",
  "effortBuildMin","effortDemoMin",
  "materialStatus","seo","textit","accessible",
]);

const FormSchema = z.object({
  target: z.enum(["project","website"]),
  id: z.string().min(1),          // projectId
  key: z.string().min(1),
  value: z.string().optional(),
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

export async function updateInlineField(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN","AGENT"].includes(session.user.role || "")) {
    throw new Error("FORBIDDEN");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Bad request");
  const { target, id, key, value } = parsed.data;

  if (target === "project") {
    const projectKey = ProjectKey.parse(key);
    const nextAgentId = value && value !== "" ? value : null;
    if (projectKey === "agentId") {
      await prisma.project.update({ where: { id }, data: { agentId: nextAgentId } });
    }
  } else {
    const websiteKey = WebsiteKey.parse(key);
    const parsedValue = coerce(websiteKey, value);
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
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NONE") as Prisma.$Enums.WebsitePriority;
        updateData.priority = nextValue;
        createData.priority = nextValue;
        break;
      }
      case "pStatus": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NONE") as Prisma.$Enums.ProductionStatus;
        updateData.pStatus = nextValue;
        createData.pStatus = nextValue;
        break;
      }
      case "cms": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "SHOPWARE") as Prisma.$Enums.CMS;
        updateData.cms = nextValue;
        createData.cms = nextValue;
        break;
      }
      case "webDate": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.webDate = nextValue;
        createData.webDate = nextValue;
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
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "ANGEFORDERT") as Prisma.$Enums.MaterialStatus;
        updateData.materialStatus = nextValue;
        createData.materialStatus = nextValue;
        break;
      }
      case "seo": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NEIN") as Prisma.$Enums.SEOStatus;
        updateData.seo = nextValue;
        createData.seo = nextValue;
        break;
      }
      case "textit": {
        const nextValue = (typeof parsedValue === "string" ? parsedValue : "NEIN") as Prisma.$Enums.TextitStatus;
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
    }

    await prisma.projectWebsite.upsert({
      where: { projectId: id },
      update: updateData,
      create: createData,
    });
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
}














