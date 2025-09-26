"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deriveProjectStatus, PROJECT_STATUS_VALUES } from "@/lib/project-status";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Helpers */
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

const ProjectStatus = z.enum(PROJECT_STATUS_VALUES);
const WebsitePriority = z.enum(["LOW","NORMAL","HIGH","CRITICAL"]);
const CMS = z.enum(["SHOPWARE","WORDPRESS","TYPO3","JOOMLA","WEBFLOW","WIX","CUSTOM","OTHER"]);
const ProductionStatus = z.enum(["NONE","TODO","IN_PROGRESS","WITH_CUSTOMER","BLOCKED","READY_FOR_LAUNCH","DONE"]);
const SEOStatus = z.enum(["NONE","QUESTIONNAIRE","ANALYSIS","DONE"]);
const TextitStatus = z.enum(["NONE","SENT_OUT","DONE"]);

function getPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const possible = (error as { code?: unknown }).code;
    return typeof possible === "string" ? possible : undefined;
  }
  return undefined;
}


/* ---------- Client anlegen ---------- */
const ClientSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
  customerNo: z.string().optional().transform(v => v?.trim() || null),
  contact: z.string().optional().transform(v => v?.trim() || null),
  phone: z.string().optional().transform(v => v?.trim() || null),
  notes: z.string().optional().transform(v => v?.trim() || null),
});

export async function createClient(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN","AGENT"].includes(session.user.role || "")) {
    redirect("/projects");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = ClientSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`/projects/new?clientError=${encodeURIComponent(msg)}`);
  }

  let clientId: string;
  try {
    const client = await prisma.client.create({ data: parsed.data });
    clientId = client.id;
  } catch (error: unknown) {
    // z. B. doppelte Kundennummer
    const code = getPrismaErrorCode(error);
    if (code === "P2002") {
      redirect(`/projects/new?clientError=${encodeURIComponent("Kundennummer ist bereits vergeben.")}`);
    }
    // generisch
    redirect(`/projects/new?clientError=${encodeURIComponent("Anlegen fehlgeschlagen.")}`);
  }

  // WICHTIG: redirect NACH dem try/catch, damit er nicht abgefangen wird
  revalidatePath("/projects");
  redirect(`/projects/new?cid=${clientId}`);
}

/* ---------- Projekt anlegen (Website) ---------- */
const ProjectFormSchema = z.object({
  title: z.string().min(1, "Titel fehlt"),
  status: ProjectStatus.default("WEBTERMIN"),
  clientId: z.string().min(1, "Kunde fehlt"),
  agentId: z.string().optional().transform((v) => (v ? v : null)),

  domain: z.string().optional().transform((v) => v?.trim() || null),
  priority: WebsitePriority.default("NORMAL"),
  cms: CMS.default("SHOPWARE"),
  cmsOther: z.string().optional().transform((v) => v?.trim() || null),
  pStatus: ProductionStatus.default("NONE"),

  webDate: z.string().optional().transform(toDate),
  demoDate: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastMaterialAt: z.string().optional().transform(toDate),

  effortBuildMin: z.string().optional().transform(toMinutesFromHours),
  effortDemoMin: z.string().optional().transform(toMinutesFromHours),

  materialAvailable: triState.default("unknown"),
  seo: SEOStatus.default("NONE"),
  textit: TextitStatus.default("NONE"),
  accessible: triState.default("unknown"),

  note: z.string().optional().transform((v) => v?.trim() || null),
  demoLink: z.string().optional().transform((v) => v?.trim() || null),
});

export async function createProject(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN","AGENT"].includes(session.user.role || "")) {
    redirect("/projects");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = ProjectFormSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`/projects/new?projectError=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;

  const nextStatus = deriveProjectStatus({
    pStatus: data.pStatus,
    webDate: data.webDate,
    demoDate: data.demoDate,
    onlineDate: data.onlineDate,
  });

  // cmsOther nur bei OTHER/CUSTOM
  const cmsOther = ["OTHER","CUSTOM"].includes(data.cms) ? data.cmsOther : null;

  // existiert der Kunde?
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) redirect(`/projects/new?projectError=${encodeURIComponent("AusgewÃ¤hlter Kunde existiert nicht.")}`);

  const project = await prisma.project.create({
    data: {
      title: data.title,
      type: "WEBSITE",
      status: nextStatus,
      clientId: data.clientId,
      agentId: data.agentId,
      website: {
        create: {
          domain: data.domain,
          priority: data.priority,
          cms: data.cms,
          cmsOther,
          pStatus: data.pStatus,
          webDate: data.webDate,
          demoDate: data.demoDate,
          onlineDate: data.onlineDate,
          lastMaterialAt: data.lastMaterialAt,
          effortBuildMin: data.effortBuildMin,
          effortDemoMin: data.effortDemoMin,
          materialAvailable: data.materialAvailable,
          seo: data.seo,
          textit: data.textit,
          accessible: data.accessible,
          note: data.note,
          demoLink: data.demoLink,
        },
      },
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}





