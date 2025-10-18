"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deriveProjectStatus } from "@/lib/project-status";
import { normalizeAgentIdForDB } from "@/lib/agent-helpers";
import { requireRole } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Hilfsfunktionen */
const toDate = (s?: string | null) => (s && s.trim() ? new Date(s) : null);
const toMinutesFromHours = (s?: string | null) => {
  if (!s) return null;
  const normalized = s.replace(",", ".").trim();
  if (!normalized) return null;
  const hours = Number(normalized);
  if (!Number.isFinite(hours)) return null;
  return Math.round(hours * 60);
};
const triState = z.enum(["unknown", "yes", "no"]).transform((v) =>
  v === "unknown" ? null : v === "yes"
);

const MaterialStatus = z.enum(["ANGEFORDERT", "TEILWEISE", "VOLLSTAENDIG", "NV"]);

const WebsitePriority = z.enum(["NONE", "PRIO_1", "PRIO_2", "PRIO_3"]);
const CMS = z.enum(["SHOPWARE", "WORDPRESS", "JOOMLA", "LOGO", "PRINT", "CUSTOM", "OTHER"]);
const ProductionStatus = z.enum(["NONE", "BEENDET", "MMW", "VOLLST_A_K"]);
const SEOStatus = z.enum(["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"]);
const TextitStatus = z.enum(["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"]);

const FormSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Titel fehlt"),
  agentId: z.string().optional().transform((v) => (v ? v : null)),

  domain: z.string().optional().transform((v) => v?.trim() || null),
  priority: WebsitePriority,
  cms: CMS,
  cmsOther: z.string().optional().transform((v) => v?.trim() || null),
  pStatus: ProductionStatus,

  webDate: z.string().optional().transform(toDate),
  webterminType: z.string().optional().transform((v) => v && v.trim() ? v as "TELEFONISCH" | "BEIM_KUNDEN" | "IN_DER_AGENTUR" : null),
  demoDate: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastMaterialAt: z.string().optional().transform(toDate),

  effortBuildMin: z.string().optional().transform(toMinutesFromHours),
  effortDemoMin: z.string().optional().transform(toMinutesFromHours),

  materialStatus: MaterialStatus,
  seo: SEOStatus,
  textit: TextitStatus,
  accessible: triState,

  note: z.string().optional().transform((v) => v?.trim() || null),
  demoLink: z.string().optional().transform((v) => v?.trim() || null),
});

export async function updateWebsite(formData: FormData) {
  try {
    await requireRole(["ADMIN", "AGENT"]);
  } catch {
    throw new Error("FORBIDDEN");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Validation failed: ${msg}`);
  }
  const data = parsed.data;

  const nextStatus = deriveProjectStatus({
    pStatus: data.pStatus,
    webDate: data.webDate,
    demoDate: data.demoDate,
    onlineDate: data.onlineDate,
    materialStatus: data.materialStatus,
  });

  // cmsOther nur speichern, wenn cms OTHER oder CUSTOM ist
  const cmsOther = ["OTHER", "CUSTOM"].includes(data.cms) ? data.cmsOther : null;

  // Normalize agent ID and get WT assignment flag
  const { baseAgentId, isWTAssignment } = normalizeAgentIdForDB(data.agentId);

  // 1) Project (Titel/Status/Agent)
  await prisma.project.update({
    where: { id: data.projectId },
    data: {
      title: data.title,
      status: nextStatus,
      agentId: baseAgentId,
    },
  });

  // 2) Website-Details (1:1 upsert)
  await prisma.projectWebsite.upsert({
    where: { projectId: data.projectId },
    update: {
      domain: data.domain,
      priority: data.priority,
      cms: data.cms,
      cmsOther,
      pStatus: data.pStatus,
      webDate: data.webDate,
      webterminType: data.webterminType,
      demoDate: data.demoDate,
      onlineDate: data.onlineDate,
      lastMaterialAt: data.lastMaterialAt,
      effortBuildMin: data.effortBuildMin,
      effortDemoMin: data.effortDemoMin,
      materialStatus: data.materialStatus,
      seo: data.seo,
      textit: data.textit,
      accessible: data.accessible,
      note: data.note,
      demoLink: data.demoLink,
      isWTAssignment,
    },
    create: {
      projectId: data.projectId,
      domain: data.domain,
      priority: data.priority,
      cms: data.cms,
      cmsOther,
      pStatus: data.pStatus,
      webDate: data.webDate,
      webterminType: data.webterminType,
      demoDate: data.demoDate,
      onlineDate: data.onlineDate,
      lastMaterialAt: data.lastMaterialAt,
      effortBuildMin: data.effortBuildMin,
      effortDemoMin: data.effortDemoMin,
      materialStatus: data.materialStatus,
      seo: data.seo,
      textit: data.textit,
      accessible: data.accessible,
      note: data.note,
      demoLink: data.demoLink,
      isWTAssignment,
    },
  });

  revalidatePath(`/projects/${data.projectId}`);
  redirect(`/projects/${data.projectId}`);
}






