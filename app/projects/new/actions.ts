"use server";

import { z } from "zod";
import type { FilmProjectStatus, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveProjectStatus } from "@/lib/project-status";
import { getAuthSession } from "@/lib/authz";
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

const MaterialStatus = z.enum(["ANGEFORDERT", "TEILWEISE", "VOLLSTAENDIG", "NV"]);
const WebsitePriority = z.enum(["NONE", "PRIO_1", "PRIO_2", "PRIO_3"]);
const CMS = z.enum(["SHOPWARE", "WORDPRESS", "JOOMLA", "LOGO", "PRINT", "CUSTOM", "OTHER"]);
const ProductionStatus = z.enum(["NONE", "BEENDET", "MMW", "VOLLST_A_K"]);
const SEOStatus = z.enum(["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"]);
const TextitStatus = z.enum(["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"]);
const FilmScope = z.enum(["FILM", "DROHNE", "NACHDREH", "FILM_UND_DROHNE"]);
const FilmPriority = z.enum(["NONE", "FILM_SOLO", "PRIO_1", "PRIO_2"]);
const FilmStatus = z.enum(["AKTIV", "BEENDET", "WARTEN", "VERZICHT", "MMW"]);

function getPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const possible = (error as { code?: unknown }).code;
    return typeof possible === "string" ? possible : undefined;
  }
  return undefined;
}

function buildProjectRedirectBase(tab: "website" | "film", cid?: string | null) {
  const params = new URLSearchParams({ tab });
  if (cid) params.set("cid", cid);
  return `/projects/new?${params.toString()}`;
}

function mapFilmStatusToProjectStatus(status: FilmProjectStatus): ProjectStatus {
  switch (status) {
    case "BEENDET":
      return "ONLINE";
    case "WARTEN":
      return "MATERIAL";
    case "MMW":
      return "UMSETZUNG";
    case "VERZICHT":
      return "WEBTERMIN";
    default:
      return "UMSETZUNG";
  }
}

/* ---------- Client anlegen ---------- */
const ClientSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
  customerNo: z.string().optional().transform((v) => v?.trim() || null),
  contact: z.string().optional().transform((v) => v?.trim() || null),
  phone: z.string().optional().transform((v) => v?.trim() || null),
  notes: z.string().optional().transform((v) => v?.trim() || null),
});

export async function createClient(formData: FormData) {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    redirect("/projects");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = ClientSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`/projects/new?clientError=${encodeURIComponent(msg)}`);
  }

  let clientId: string;
  try {
    const client = await prisma.client.create({ data: parsed.data });
    clientId = client.id;
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "P2002") {
      redirect(`/projects/new?clientError=${encodeURIComponent("Kundennummer ist bereits vergeben.")}`);
    }
    redirect(`/projects/new?clientError=${encodeURIComponent("Anlegen fehlgeschlagen.")}`);
  }

  revalidatePath("/projects");
  redirect(`/projects/new?cid=${clientId}`);
}

/* ---------- Projekt anlegen (Website) ---------- */
const WebsiteProjectSchema = z.object({
  title: z.string().optional().transform((v) => (v ?? "").trim()),
  clientId: z.string().min(1, "Kunde fehlt"),
  agentId: z.string().optional().transform((v) => (v ? v : null)),

  domain: z.string().optional().transform((v) => v?.trim() || null),
  priority: WebsitePriority.default("NONE"),
  cms: CMS.default("SHOPWARE"),
  cmsOther: z.string().optional().transform((v) => v?.trim() || null),
  pStatus: ProductionStatus.default("NONE"),

  webDate: z.string().optional().transform(toDate),
  demoDate: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastMaterialAt: z.string().optional().transform(toDate),

  effortBuildMin: z.string().optional().transform(toMinutesFromHours),
  effortDemoMin: z.string().optional().transform(toMinutesFromHours),

  materialStatus: MaterialStatus.default("ANGEFORDERT"),
  seo: SEOStatus.default("NEIN"),
  textit: TextitStatus.default("NEIN"),
  accessible: triState.default(null),

  note: z.string().optional().transform((v) => v?.trim() || null),
  demoLink: z.string().optional().transform((v) => v?.trim() || null),
});

export async function createWebsiteProject(formData: FormData) {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    redirect("/projects");
  }

  const entries = Object.fromEntries(formData.entries());
  const tab = entries.tab === "film" ? "film" : "website";
  const cid = typeof entries.clientId === "string" ? entries.clientId : undefined;
  const redirectBase = buildProjectRedirectBase(tab, cid);
  const { tab: _tab, ...raw } = entries;

  const parsed = WebsiteProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`${redirectBase}&projectError=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;

  const nextStatus = deriveProjectStatus({
    pStatus: data.pStatus,
    webDate: data.webDate,
    demoDate: data.demoDate,
    onlineDate: data.onlineDate,
    materialStatus: data.materialStatus,
  });

  const cmsOther = ["OTHER", "CUSTOM"].includes(data.cms) ? data.cmsOther : null;

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    redirect(`${redirectBase}&projectError=${encodeURIComponent("Ausgewählter Kunde existiert nicht.")}`);
  }

  const project = await prisma.project.create({
    data: {
      title: data.title || "",
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
          materialStatus: data.materialStatus,
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

/* ---------- Projekt anlegen (Film) ---------- */
const FilmProjectSchema = z.object({
  title: z.string().optional().transform((v) => (v ?? "").trim()),
  clientId: z.string().min(1, "Kunde fehlt"),
  agentId: z.string().optional().transform((v) => (v ? v : null)),
  scope: FilmScope.default("FILM"),
  priority: FilmPriority.default("NONE"),
  filmerId: z.string().optional().transform((v) => (v ? v : null)),
  cutterId: z.string().optional().transform((v) => (v ? v : null)),
  contractStart: z.string().optional().transform(toDate),
  scouting: z.string().optional().transform(toDate),
  scriptToClient: z.string().optional().transform(toDate),
  scriptApproved: z.string().optional().transform(toDate),
  shootDate: z.string().optional().transform(toDate),
  firstCutToClient: z.string().optional().transform(toDate),
  finalToClient: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastContact: z.string().optional().transform(toDate),
  status: FilmStatus.default("AKTIV"),
  reminderAt: z.string().optional().transform(toDate),
  note: z.string().optional().transform((v) => v?.trim() || null),
});

export async function createFilmProject(formData: FormData) {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    redirect("/projects");
  }

  const entries = Object.fromEntries(formData.entries());
  const tab = entries.tab === "website" ? "website" : "film";
  const cid = typeof entries.clientId === "string" ? entries.clientId : undefined;
  const redirectBase = buildProjectRedirectBase("film", cid);
  const { tab: _tab, ...raw } = entries;

  const parsed = FilmProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`${redirectBase}&projectError=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    redirect(`${redirectBase}&projectError=${encodeURIComponent("Ausgewählter Kunde existiert nicht.")}`);
  }

  const projectStatus = mapFilmStatusToProjectStatus(data.status);

  const project = await prisma.project.create({
    data: {
      title: data.title || "",
      type: "FILM",
      status: projectStatus,
      clientId: data.clientId,
      agentId: data.agentId,
      film: {
        create: {
          scope: data.scope,
          priority: data.priority,
          filmerId: data.filmerId,
          cutterId: data.cutterId,
          contractStart: data.contractStart,
          scouting: data.scouting,
          scriptToClient: data.scriptToClient,
          scriptApproved: data.scriptApproved,
          shootDate: data.shootDate,
          firstCutToClient: data.firstCutToClient,
          finalToClient: data.finalToClient,
          onlineDate: data.onlineDate,
          lastContact: data.lastContact,
          status: data.status,
          reminderAt: data.reminderAt,
          note: data.note,
        },
      },
    },
  });

  revalidatePath("/projects");
  revalidatePath("/film-projects");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}

/* ---------- Unified Projekt anlegen ---------- */
const UnifiedProjectSchema = z.object({
  projectType: z.enum(["WEBSITE", "FILM", "BOTH"]),
  title: z.string().optional().transform((v) => (v ?? "").trim()),
  clientId: z.string().min(1, "Kunde fehlt"),
  agentId: z.string().optional().transform((v) => (v ? v : null)),

  // Website fields
  domain: z.string().optional().transform((v) => v?.trim() || null),
  priority: WebsitePriority.optional(),
  cms: CMS.optional(),
  cmsOther: z.string().optional().transform((v) => v?.trim() || null),
  pStatus: ProductionStatus.optional(),
  webDate: z.string().optional().transform(toDate),
  demoDate: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastMaterialAt: z.string().optional().transform(toDate),
  effortBuildMin: z.string().optional().transform(toMinutesFromHours),
  effortDemoMin: z.string().optional().transform(toMinutesFromHours),
  materialStatus: MaterialStatus.optional(),
  seo: SEOStatus.optional(),
  textit: TextitStatus.optional(),
  accessible: triState.optional(),
  websiteNote: z.string().optional().transform((v) => v?.trim() || null),
  demoLink: z.string().optional().transform((v) => v?.trim() || null),

  // Film fields
  scope: FilmScope.optional(),
  filmPriority: FilmPriority.optional(),
  filmerId: z.string().optional().transform((v) => (v ? v : null)),
  cutterId: z.string().optional().transform((v) => (v ? v : null)),
  contractStart: z.string().optional().transform(toDate),
  scouting: z.string().optional().transform(toDate),
  scriptToClient: z.string().optional().transform(toDate),
  scriptApproved: z.string().optional().transform(toDate),
  shootDate: z.string().optional().transform(toDate),
  firstCutToClient: z.string().optional().transform(toDate),
  finalToClient: z.string().optional().transform(toDate),
  filmOnlineDate: z.string().optional().transform(toDate),
  lastContact: z.string().optional().transform(toDate),
  status: FilmStatus.optional(),
  reminderAt: z.string().optional().transform(toDate),
  filmNote: z.string().optional().transform((v) => v?.trim() || null),
});

export async function createProject(formData: FormData) {
  const session = await getAuthSession();
  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
    redirect("/projects");
  }

  const entries = Object.fromEntries(formData.entries());
  const cid = typeof entries.clientId === "string" ? entries.clientId : undefined;

  const parsed = UnifiedProjectSchema.safeParse(entries);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    const params = new URLSearchParams();
    if (cid) params.set("cid", cid);
    params.set("projectError", msg);
    redirect(`/projects/new?${params.toString()}`);
  }

  const data = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    const params = new URLSearchParams();
    if (cid) params.set("cid", cid);
    params.set("projectError", "Ausgewählter Kunde existiert nicht.");
    redirect(`/projects/new?${params.toString()}`);
  }

  const projectType = data.projectType;

  if (projectType === "WEBSITE") {
    const nextStatus = deriveProjectStatus({
      pStatus: data.pStatus ?? "NONE",
      webDate: data.webDate ?? null,
      demoDate: data.demoDate ?? null,
      onlineDate: data.onlineDate ?? null,
      materialStatus: data.materialStatus ?? "ANGEFORDERT",
    });

    const cmsOther = (data.cms && ["OTHER", "CUSTOM"].includes(data.cms)) ? data.cmsOther : null;

    const project = await prisma.project.create({
      data: {
        title: data.title || "",
        type: "WEBSITE",
        status: nextStatus,
        clientId: data.clientId,
        agentId: data.agentId,
        website: {
          create: {
            domain: data.domain,
            priority: data.priority ?? "NONE",
            cms: data.cms ?? "JOOMLA",
            cmsOther,
            pStatus: data.pStatus ?? "NONE",
            webDate: data.webDate,
            demoDate: data.demoDate,
            onlineDate: data.onlineDate,
            lastMaterialAt: data.lastMaterialAt,
            effortBuildMin: data.effortBuildMin,
            effortDemoMin: data.effortDemoMin,
            materialStatus: data.materialStatus ?? "ANGEFORDERT",
            seo: data.seo ?? "NEIN",
            textit: data.textit ?? "NEIN",
            accessible: data.accessible ?? null,
            note: data.websiteNote,
            demoLink: data.demoLink,
          },
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    redirect(`/projects/${project.id}`);
  } else if (projectType === "FILM") {
    const projectStatus = mapFilmStatusToProjectStatus(data.status ?? "AKTIV");

    const project = await prisma.project.create({
      data: {
        title: data.title || "",
        type: "FILM",
        status: projectStatus,
        clientId: data.clientId,
        agentId: data.agentId,
        film: {
          create: {
            scope: data.scope ?? "FILM",
            priority: data.filmPriority ?? "NONE",
            filmerId: data.filmerId,
            cutterId: data.cutterId,
            contractStart: data.contractStart,
            scouting: data.scouting,
            scriptToClient: data.scriptToClient,
            scriptApproved: data.scriptApproved,
            shootDate: data.shootDate,
            firstCutToClient: data.firstCutToClient,
            finalToClient: data.finalToClient,
            onlineDate: data.filmOnlineDate,
            lastContact: data.lastContact,
            status: data.status ?? "AKTIV",
            reminderAt: data.reminderAt,
            note: data.filmNote,
          },
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath("/film-projects");
    revalidatePath(`/projects/${project.id}`);
    redirect(`/projects/${project.id}`);
  } else if (projectType === "BOTH") {
    // Bestimme den Status basierend auf Website-Daten, da das Projekt primär als Website geführt wird
    const nextStatus = deriveProjectStatus({
      pStatus: data.pStatus ?? "NONE",
      webDate: data.webDate ?? null,
      demoDate: data.demoDate ?? null,
      onlineDate: data.onlineDate ?? null,
      materialStatus: data.materialStatus ?? "ANGEFORDERT",
    });

    const cmsOther = (data.cms && ["OTHER", "CUSTOM"].includes(data.cms)) ? data.cmsOther : null;

    const project = await prisma.project.create({
      data: {
        title: data.title || "",
        type: "WEBSITE",
        status: nextStatus,
        clientId: data.clientId,
        agentId: data.agentId,
        website: {
          create: {
            domain: data.domain,
            priority: data.priority ?? "NONE",
            cms: data.cms ?? "JOOMLA",
            cmsOther,
            pStatus: data.pStatus ?? "NONE",
            webDate: data.webDate,
            demoDate: data.demoDate,
            onlineDate: data.onlineDate,
            lastMaterialAt: data.lastMaterialAt,
            effortBuildMin: data.effortBuildMin,
            effortDemoMin: data.effortDemoMin,
            materialStatus: data.materialStatus ?? "ANGEFORDERT",
            seo: data.seo ?? "NEIN",
            textit: data.textit ?? "NEIN",
            accessible: data.accessible ?? null,
            note: data.websiteNote,
            demoLink: data.demoLink,
          },
        },
        film: {
          create: {
            scope: data.scope ?? "FILM",
            priority: data.filmPriority ?? "NONE",
            filmerId: data.filmerId,
            cutterId: data.cutterId,
            contractStart: data.contractStart,
            scouting: data.scouting,
            scriptToClient: data.scriptToClient,
            scriptApproved: data.scriptApproved,
            shootDate: data.shootDate,
            firstCutToClient: data.firstCutToClient,
            finalToClient: data.finalToClient,
            onlineDate: data.filmOnlineDate,
            lastContact: data.lastContact,
            status: data.status ?? "AKTIV",
            reminderAt: data.reminderAt,
            note: data.filmNote,
          },
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath("/film-projects");
    revalidatePath(`/projects/${project.id}`);
    redirect(`/projects/${project.id}`);
  }

  redirect("/projects");
}


