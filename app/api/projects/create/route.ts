import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FilmProjectStatus, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveProjectStatus } from "@/lib/project-status";
import { getAuthSession } from "@/lib/authz";
import { normalizeAgentIdForDB } from "@/lib/agent-helpers";
import { processTriggers } from "@/lib/email/trigger-service";

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
const FilmScope = z.enum(["FILM", "DROHNE", "NACHDREH", "FILM_UND_DROHNE", "FOTO", "GRAD_360"]);
const FilmPriority = z.enum(["NONE", "FILM_SOLO", "PRIO_1", "PRIO_2"]);
const FilmStatus = z.enum(["AKTIV", "BEENDET", "WARTEN", "VERZICHT", "MMW"]);

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

const UnifiedProjectSchema = z.object({
  selectedProjectTypes: z.string().transform((v) => JSON.parse(v) as string[]),
  title: z.string().optional().transform((v) => v?.trim() || null),
  clientId: z.string().min(1, "Kunde fehlt"),

  // Website-spezifische Felder
  websiteAgentId: z.string().optional().transform((v) => (v ? v : null)),
  cms: CMS.optional(),
  cmsOther: z.string().optional().transform((v) => v?.trim() || null),
  textit: TextitStatus.optional(),
  webDate: z.string().optional().transform(toDate),
  webterminType: z.string().optional().transform((v) => v && v.trim() ? v as "TELEFONISCH" | "BEIM_KUNDEN" | "IN_DER_AGENTUR" : null),
  isRelaunch: z.string().optional().transform((v) => v === "on"),

  // Film-spezifische Felder
  filmAgentId: z.string().optional().transform((v) => (v ? v : null)),
  scope: FilmScope.optional(),
  scouting: z.string().optional().transform(toDate),

  // Social Media-spezifische Felder
  socialAgentId: z.string().optional().transform((v) => (v ? v : null)),
  socialPlatforms: z.string().optional().transform((v) => v?.trim() || null),
  socialFrequency: z.string().optional().transform((v) => v?.trim() || null),

  // Weitere Website-Felder (aus versteckten Details)
  domain: z.string().optional().transform((v) => v?.trim() || null),
  priority: WebsitePriority.optional(),
  pStatus: ProductionStatus.optional(),
  demoDate: z.string().optional().transform(toDate),
  onlineDate: z.string().optional().transform(toDate),
  lastMaterialAt: z.string().optional().transform(toDate),
  effortBuildMin: z.string().optional().transform(toMinutesFromHours),
  effortDemoMin: z.string().optional().transform(toMinutesFromHours),
  materialStatus: MaterialStatus.optional(),
  seo: SEOStatus.optional(),
  accessible: triState.optional(),
  websiteNote: z.string().optional().transform((v) => v?.trim() || null),
  demoLink: z.string().optional().transform((v) => v?.trim() || null),

  // Weitere Film-Felder (aus versteckten Details)
  filmPriority: FilmPriority.optional(),
  status: FilmStatus.optional(),
  filmerId: z.string().optional().transform((v) => (v ? v : null)),
  cutterId: z.string().optional().transform((v) => (v ? v : null)),
  contractStart: z.string().optional().transform(toDate),
  scriptToClient: z.string().optional().transform(toDate),
  scriptApproved: z.string().optional().transform(toDate),
  shootDate: z.string().optional().transform(toDate),
  firstCutToClient: z.string().optional().transform(toDate),
  finalToClient: z.string().optional().transform(toDate),
  finalLink: z.string().optional().transform((v) => v?.trim() || null),
  filmOnlineDate: z.string().optional().transform(toDate),
  onlineLink: z.string().optional().transform((v) => v?.trim() || null),
  lastContact: z.string().optional().transform(toDate),
  reminderAt: z.string().optional().transform(toDate),
  filmNote: z.string().optional().transform((v) => v?.trim() || null),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UnifiedProjectSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const data = parsed.data;
    const projectTypes = data.selectedProjectTypes;

    // Validate client exists
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const createdProjectIds: string[] = [];
    const allQueueIds: string[] = [];

    // Create Website project
    if (projectTypes.includes("WEBSITE")) {
      const nextStatus = deriveProjectStatus({
        pStatus: data.pStatus ?? "NONE",
        webDate: data.webDate ?? null,
        demoDate: data.demoDate ?? null,
        onlineDate: data.onlineDate ?? null,
        materialStatus: data.materialStatus ?? "ANGEFORDERT",
      });

      const cmsOther = (data.cms && ["OTHER", "CUSTOM"].includes(data.cms)) ? data.cmsOther : null;
      const { baseAgentId, isWTAssignment } = normalizeAgentIdForDB(data.websiteAgentId);

      const websiteProject = await prisma.project.create({
        data: {
          title: projectTypes.length > 1 && data.title ? `${data.title} (Website)` : data.title,
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
              isRelaunch: data.isRelaunch ?? false,
            },
          },
        },
      });

      createdProjectIds.push(websiteProject.id);

      // Check for email triggers if webDate was set
      if (data.webDate) {
        const queueIds = await processTriggers(
          websiteProject.id,
          { webDate: data.webDate, webterminType: data.webterminType },
          { webDate: null, webterminType: null }
        );
        allQueueIds.push(...queueIds);
      }
    }

    // Create Film project
    if (projectTypes.includes("FILM")) {
      const filmStatus = mapFilmStatusToProjectStatus(data.status ?? "AKTIV");
      const { baseAgentId } = normalizeAgentIdForDB(data.filmAgentId);
      const filmerId = data.filmerId || baseAgentId;
      const filmFinalLink = data.finalLink ?? null;
      const filmOnlineLink = data.onlineLink ?? (data.filmOnlineDate ? filmFinalLink : null);

      const filmProject = await prisma.project.create({
        data: {
          title: projectTypes.length > 1 && data.title ? `${data.title} (Film)` : data.title,
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

      createdProjectIds.push(filmProject.id);

      // Check for email triggers if scouting was set
      if (data.scouting) {
        const queueIds = await processTriggers(
          filmProject.id,
          { scouting: data.scouting },
          { scouting: null }
        );
        allQueueIds.push(...queueIds);
      }
    }

    // Create Social Media project (placeholder - needs proper schema)
    if (projectTypes.includes("SOCIAL_MEDIA")) {
      // TODO: Implement Social Media project creation
      // For now, we'll skip it or create a basic project
    }

    return NextResponse.json({
      success: true,
      projectIds: createdProjectIds,
      queueIds: allQueueIds,
      clientId: client.id,
    });

  } catch (error) {
    console.error("Error creating projects:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Anlegen des Projekts" },
      { status: 500 }
    );
  }
}
