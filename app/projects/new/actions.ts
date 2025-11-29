"use server";

import { z } from "zod";
import type { FilmProjectStatus, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveProjectStatus } from "@/lib/project-status";
import { getAuthSession } from "@/lib/authz";
import { normalizeAgentIdForDB } from "@/lib/agent-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Helpers */
// Naive Date-Speicherung: Die eingegebene Zeit wird exakt so gespeichert wie eingegeben,
// ohne Zeitzonenkonvertierung. "16:00" eingegeben → "16:00:00.000Z" gespeichert.
// Das Z am Ende macht den String zu einem UTC-String, sodass keine lokale Konvertierung stattfindet.
const toDate = (s?: string | null) => {
  if (!s || !s.trim()) return null;
  const trimmed = s.trim();
  // Wenn der String bereits ein Z oder Timezone-Offset hat, direkt parsen
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  // Ansonsten Z anhängen, damit die Zeit als UTC interpretiert wird (keine lokale Konvertierung)
  // Falls nur Datum ohne Zeit, Mitternacht anhängen
  if (!trimmed.includes('T')) {
    return new Date(trimmed + 'T00:00:00.000Z');
  }
  return new Date(trimmed + ':00.000Z');
};
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
const CMS = z.enum(["SHOPWARE", "WORDPRESS", "JOOMLA", "CUSTOM", "OTHER"]);
const ProductionStatus = z.enum(["NONE", "BEENDET", "MMW", "VOLLST_A_K", "VOLLST_K_E_S"]);
const SEOStatus = z.string().optional().transform((v) => {
  if (!v || v.trim() === "") return "NEIN";
  const val = v.trim();
  if (["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA", "JA"].includes(val)) {
    return val as "NEIN" | "NEIN_NEIN" | "JA_NEIN" | "JA_JA" | "JA";
  }
  return "NEIN"; // Fallback to default if invalid value
});
const TextitStatus = z.string().optional().transform((v) => {
  if (!v || v.trim() === "") return "NEIN";
  const val = v.trim();
  if (["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA", "JA"].includes(val)) {
    return val as "NEIN" | "NEIN_NEIN" | "JA_NEIN" | "JA_JA" | "JA";
  }
  return "NEIN"; // Fallback to default if invalid value
});
const WebterminType = z.enum(["TELEFONISCH", "BEIM_KUNDEN", "IN_DER_AGENTUR", "OHNE_TERMIN"]).nullable();
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
  customerNo: z.string().min(1, "Kundennummer fehlt").trim(),
  salutation: z.string().optional().transform((v) => v?.trim() || null),
  firstname: z.string().optional().transform((v) => v?.trim() || null),
  lastname: z.string().optional().transform((v) => v?.trim() || null),
  email: z.string().optional().transform((v) => v?.trim() || null),
  phone: z.string().optional().transform((v) => v?.trim() || null),
  agencyId: z.string().optional().transform((v) => v?.trim() || null),
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
    const { agencyId, ...clientData } = parsed.data;
    const client = await prisma.client.create({
      data: {
        ...clientData,
        agencyId: agencyId || null,
      },
    });
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
  title: z.string().optional().transform((v) => v?.trim() || null),
  clientId: z.string().min(1, "Kunde fehlt"),
  agentId: z.string().optional().transform((v) => (v ? v : null)),

  domain: z.string().optional().transform((v) => v?.trim() || null),
  priority: WebsitePriority.default("NONE"),
  cms: CMS.default("SHOPWARE"),
  cmsOther: z.string().optional().transform((v) => v?.trim() || null),
  pStatus: ProductionStatus.default("NONE"),

  webDate: z.string().optional().transform(toDate),
  webterminType: z.string().optional().transform((v) => v && v.trim() ? v as "TELEFONISCH" | "BEIM_KUNDEN" | "IN_DER_AGENTUR" | "OHNE_TERMIN" : null),
  demoDate: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastMaterialAt: z.string().optional().transform(toDate),

  effortBuildMin: z.string().optional().transform(toMinutesFromHours),
  effortDemoMin: z.string().optional().transform(toMinutesFromHours),

  materialStatus: MaterialStatus.default("ANGEFORDERT"),
  seo: SEOStatus,
  textit: TextitStatus,
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
  const { tab: ignoredTab, ...raw } = entries;
  void ignoredTab;

  const parsed = WebsiteProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`${redirectBase}&projectError=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;

  const nextStatus = deriveProjectStatus({
    pStatus: data.pStatus,
    webDate: data.webDate,
    webterminType: data.webterminType || null,
    demoDate: data.demoDate,
    onlineDate: data.onlineDate,
    materialStatus: data.materialStatus,
  });

  const cmsOther = ["OTHER", "CUSTOM"].includes(data.cms) ? data.cmsOther : null;

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    redirect(`${redirectBase}&projectError=${encodeURIComponent("Ausgewählter Kunde existiert nicht.")}`);
  }

  const { baseAgentId, isWTAssignment } = normalizeAgentIdForDB(data.agentId);

  const project = await prisma.project.create({
    data: {
      title: data.title,
      type: "WEBSITE",
      status: nextStatus,
      clientId: data.clientId,
      agentId: baseAgentId,
      website: {
        create: {
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
      },
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}

/* ---------- Projekt anlegen (Film) ---------- */
const FilmProjectSchema = z.object({
  title: z.string().optional().transform((v) => v?.trim() || null),
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
  finalLink: z.string().optional().transform((v) => v?.trim() || null),
  onlineDate: z.string().optional().transform(toDate),
  onlineLink: z.string().optional().transform((v) => v?.trim() || null),
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
  const cid = typeof entries.clientId === "string" ? entries.clientId : undefined;
  const redirectBase = buildProjectRedirectBase("film", cid);
  const { tab: ignoredTab, ...raw } = entries;
  void ignoredTab;

  const parsed = FilmProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`${redirectBase}&projectError=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;
  const finalLink = data.finalLink ?? null;
  if (data.finalToClient && !finalLink) {
    const msg = "Finalversion-Link ist erforderlich, wenn eine Finalversion gesetzt wird.";
    redirect(`${redirectBase}&projectError=${encodeURIComponent(msg)}`);
  }
  const resolvedOnlineLink = data.onlineLink ?? (data.onlineDate ? finalLink : null);
  if (data.onlineDate && !resolvedOnlineLink) {
    const msg = "Bitte einen Hauptlink hinterlegen, wenn ein Online-Datum gesetzt wird.";
    redirect(`${redirectBase}&projectError=${encodeURIComponent(msg)}`);
  }

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    redirect(`${redirectBase}&projectError=${encodeURIComponent("Ausgewählter Kunde existiert nicht.")}`);
  }

  const projectStatus = mapFilmStatusToProjectStatus(data.status);

  const { baseAgentId } = normalizeAgentIdForDB(data.agentId);

  const project = await prisma.project.create({
    data: {
      title: data.title,
      type: "FILM",
      status: projectStatus,
      clientId: data.clientId,
      agentId: baseAgentId,
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
          finalLink,
          onlineDate: data.onlineDate,
          onlineLink: resolvedOnlineLink,
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
  title: z.string().optional().transform((v) => v?.trim() || null),
  clientId: z.string().min(1, "Kunde fehlt"),
  agentId: z.string().optional().transform((v) => (v ? v : null)),

  // Website fields
  domain: z.string().optional().transform((v) => v?.trim() || null),
  priority: WebsitePriority.optional(),
  cms: CMS.optional(),
  cmsOther: z.string().optional().transform((v) => v?.trim() || null),
  pStatus: ProductionStatus.optional(),
  webDate: z.string().optional().transform(toDate),
  webterminType: z.string().optional().transform((v) => v && v.trim() ? v as "TELEFONISCH" | "BEIM_KUNDEN" | "IN_DER_AGENTUR" | "OHNE_TERMIN" : null),
  demoDate: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastMaterialAt: z.string().optional().transform(toDate),
  effortBuildMin: z.string().optional().transform(toMinutesFromHours),
  effortDemoMin: z.string().optional().transform(toMinutesFromHours),
  materialStatus: MaterialStatus.optional(),
  seo: SEOStatus,
  textit: TextitStatus,
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
  finalLink: z.string().optional().transform((v) => v?.trim() || null),
  filmOnlineDate: z.string().optional().transform(toDate),
  onlineLink: z.string().optional().transform((v) => v?.trim() || null),
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
  type TabKey = "website" | "film" | "both";
  const requestedTypeRaw = typeof entries.projectType === "string" ? entries.projectType : undefined;
  const defaultTab: TabKey =
    requestedTypeRaw === "FILM" ? "film" : requestedTypeRaw === "BOTH" ? "both" : "website";
  const sendError = (msg: string, tab: "website" | "film" | "both") => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (cid) params.set("cid", cid);
    params.set("projectError", msg);
    redirect(`/projects/new?${params.toString()}`);
  };

  const parsed = UnifiedProjectSchema.safeParse(entries);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    sendError(msg, defaultTab);
    return; // This line will never be reached, but TypeScript needs it
  }

  const data = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    sendError("Ausgewählter Kunde existiert nicht.", defaultTab);
  }

  const projectType = data.projectType;

  if (projectType === "WEBSITE") {
    const nextStatus = deriveProjectStatus({
      pStatus: data.pStatus ?? "NONE",
      webDate: data.webDate ?? null,
      webterminType: data.webterminType || null,
      demoDate: data.demoDate ?? null,
      onlineDate: data.onlineDate ?? null,
      materialStatus: data.materialStatus ?? "ANGEFORDERT",
    });

    const cmsOther = (data.cms && ["OTHER", "CUSTOM"].includes(data.cms)) ? data.cmsOther : null;
    const { baseAgentId, isWTAssignment } = normalizeAgentIdForDB(data.agentId);

    const project = await prisma.project.create({
      data: {
        title: data.title,
        type: "WEBSITE",
        status: nextStatus,
        clientId: data.clientId,
        agentId: baseAgentId,
        website: {
          create: {
            domain: data.domain,
            priority: data.priority ?? "NONE",
            cms: data.cms ?? "JOOMLA",
            cmsOther,
            pStatus: data.pStatus ?? "NONE",
            webDate: data.webDate,
            webterminType: data.webterminType,
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
            isWTAssignment,
          },
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    revalidatePath(`/clients/${project.clientId}`);
    redirect(`/clients/${project.clientId}`);
  } else if (projectType === "FILM") {
    const projectStatus = mapFilmStatusToProjectStatus(data.status ?? "AKTIV");

    const { baseAgentId } = normalizeAgentIdForDB(data.agentId);
    // Wenn kein Filmer explizit angegeben ist, verwende den Agent als Filmer
    const filmerId = data.filmerId || baseAgentId;
    const filmFinalLink = data.finalLink ?? null;
    if (data.finalToClient && !filmFinalLink) {
      sendError("Finalversion-Link ist erforderlich, wenn eine Finalversion gesetzt wird.", "film");
    }
    const filmOnlineLink = data.onlineLink ?? (data.filmOnlineDate ? filmFinalLink : null);
    if (data.filmOnlineDate && !filmOnlineLink) {
      sendError("Bitte einen Hauptlink hinterlegen, wenn ein Online-Datum gesetzt wird.", "film");
    }

    const project = await prisma.project.create({
      data: {
        title: data.title,
        type: "FILM",
        status: projectStatus,
        clientId: data.clientId,
        agentId: baseAgentId,
        film: {
          create: {
            scope: data.scope ?? "FILM",
            priority: data.filmPriority ?? "NONE",
            filmerId: filmerId,
            cutterId: data.cutterId,
            contractStart: data.contractStart,
            scouting: data.scouting,
            scriptToClient: data.scriptToClient,
            scriptApproved: data.scriptApproved,
            shootDate: data.shootDate,
            firstCutToClient: data.firstCutToClient,
            finalToClient: data.finalToClient,
            finalLink: filmFinalLink,
            onlineDate: data.filmOnlineDate,
            onlineLink: filmOnlineLink,
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
    revalidatePath(`/clients/${project.clientId}`);
    redirect(`/clients/${project.clientId}`);
  } else if (projectType === "BOTH") {
    // Erstelle zwei separate Projekte: Website und Film
    const { baseAgentId, isWTAssignment } = normalizeAgentIdForDB(data.agentId);

    // Fetch client for redirect
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return sendError("Client not found", "both");
    }

    // Validierung für Film-Daten
    const filmFinalLink = data.finalLink ?? null;
    if (data.finalToClient && !filmFinalLink) {
      sendError("Finalversion-Link ist erforderlich, wenn eine Finalversion gesetzt wird.", "both");
    }
    const filmOnlineLink = data.onlineLink ?? (data.filmOnlineDate ? filmFinalLink : null);
    if (data.filmOnlineDate && !filmOnlineLink) {
      sendError("Bitte einen Hauptlink hinterlegen, wenn ein Online-Datum gesetzt wird.", "both");
    }

    // Website-Projekt erstellen
    const websiteStatus = deriveProjectStatus({
      pStatus: data.pStatus ?? "NONE",
      webDate: data.webDate ?? null,
      webterminType: data.webterminType || null,
      demoDate: data.demoDate ?? null,
      onlineDate: data.onlineDate ?? null,
      materialStatus: data.materialStatus ?? "ANGEFORDERT",
    });

    const cmsOther = (data.cms && ["OTHER", "CUSTOM"].includes(data.cms)) ? data.cmsOther : null;

    const websiteProject = await prisma.project.create({
      data: {
        title: data.title ? `${data.title} (Website)` : null,
        type: "WEBSITE",
        status: websiteStatus,
        clientId: data.clientId,
        agentId: baseAgentId,
        website: {
          create: {
            domain: data.domain,
            priority: data.priority ?? "NONE",
            cms: data.cms ?? "JOOMLA",
            cmsOther,
            pStatus: data.pStatus ?? "NONE",
            webDate: data.webDate,
            webterminType: data.webterminType,
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
            isWTAssignment,
          },
        },
      },
    });

    // Film-Projekt erstellen
    const filmStatus = mapFilmStatusToProjectStatus(data.status ?? "AKTIV");
    const filmerId = data.filmerId || baseAgentId;

    const filmProject = await prisma.project.create({
      data: {
        title: data.title ? `${data.title} (Film)` : null,
        type: "FILM",
        status: filmStatus,
        clientId: data.clientId,
        agentId: baseAgentId,
        film: {
          create: {
            scope: data.scope ?? "FILM",
            priority: data.filmPriority ?? "NONE",
            filmerId: filmerId,
            cutterId: data.cutterId,
            contractStart: data.contractStart,
            scouting: data.scouting,
            scriptToClient: data.scriptToClient,
            scriptApproved: data.scriptApproved,
            shootDate: data.shootDate,
            firstCutToClient: data.firstCutToClient,
            finalToClient: data.finalToClient,
            finalLink: filmFinalLink,
            onlineDate: data.filmOnlineDate,
            onlineLink: filmOnlineLink,
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
    revalidatePath(`/projects/${websiteProject.id}`);
    revalidatePath(`/projects/${filmProject.id}`);
    revalidatePath(`/clients/${client.id}`);
    redirect(`/clients/${client.id}`);
  }

  redirect("/projects");
}
