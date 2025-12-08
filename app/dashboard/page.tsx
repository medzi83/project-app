// /app/dashboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, ProjectStatus, ProjectType, AgentCategory, FilmScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildWebsiteStatusWhere, DONE_PRODUCTION_STATUSES, deriveProjectStatus, STATUS_LABELS } from "@/lib/project-status";
import { deriveFilmStatus as deriveFilmStatusFromLib } from "@/lib/film-status";
import { derivePrintDesignStatus, getPrintDesignStatusDate, PRINT_DESIGN_STATUS_LABELS, type PrintDesignStatus } from "@/lib/print-design-status";
import { getEffectiveUser, getAuthSession } from "@/lib/authz";
import { NoticeBoard, type NoticeBoardEntry } from "@/components/NoticeBoard";
import { InstallationWarningsSlideout } from "./InstallationWarningsSlideout";
import WorkStoppedProjectsAccordion from "./WorkStoppedProjectsAccordion";
import { SalesDashboard } from "./SalesDashboard";
import { getFavoriteClients } from "@/app/actions/favorites";

export const metadata = { title: "Dashboard" };


const STATUSES: ProjectStatus[] = ["WEBTERMIN", "MATERIAL", "UMSETZUNG", "DEMO", "ONLINE"];

const FILM_SCOPE_LABELS: Record<FilmScope, string> = {
  FILM: "Film",
  DROHNE: "Drohne",
  NACHDREH: "Nachdreh",
  FILM_UND_DROHNE: "F + D",
  FOTO: "Foto",
  GRAD_360: "360°",
  K_A: "k.A.",
};

const PROJECT_TYPES: Array<{ key: ProjectType; label: string; href: string }> = [
  { key: "WEBSITE", label: "Webseitenprojekte", href: "/projects" },
  { key: "FILM", label: "Filmprojekte", href: "/film-projects" },
  { key: "PRINT_DESIGN", label: "Print & Design", href: "/print-design" },
  { key: "SOCIAL", label: "Social Media Projekte", href: "/social-projects" },
];

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function formatDate(d?: Date | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatDateOnly(d?: Date | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

const buildNoticeTargetLabel = (
  visibility: "GLOBAL" | "TARGETED",
  role: string | undefined,
  recipients: Array<{ user: { name: string | null } }>,
) => {
  if (visibility === "GLOBAL") return undefined;
  if (role === "AGENT") return "Für dich";
  const names = recipients.map((entry) => entry.user.name).filter(Boolean) as string[];
  if (names.length === 0) return "Spezifische Agenten";
  if (names.length > 2) {
    const displayed = names.slice(0, 2).join(", ");
    return `${displayed} (+${names.length - 2} weitere)`;
  }
  return names.join(", ");
};

// Helper: Check if a date is older than 4 weeks (28 days)
const isOlderThan4Weeks = (date: Date | null | undefined) => {
  if (!date) return false;
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  return new Date(date).getTime() < fourWeeksAgo.getTime();
};


const startOfDay = (input: Date) => {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isWorkingDay = (date: Date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

const workingDaysBetween = (from: Date, to: Date) => {
  if (from.getTime() === to.getTime()) return 0;
  const step = from < to ? 1 : -1;
  const current = new Date(from);
  let count = 0;
  while (current.getTime() !== to.getTime()) {
    current.setDate(current.getDate() + step);
    if (isWorkingDay(current)) count += step;
  }
  return count;
};

const workingDaysSince = (
  lastMaterialAt: Date | string,
  demoDate?: Date | string | null,
) => {
  const start = startOfDay(new Date(lastMaterialAt));
  if (Number.isNaN(start.getTime())) return null;
  const today = startOfDay(new Date());
  let end = today;
  if (demoDate) {
    const demo = startOfDay(new Date(demoDate));
    if (!Number.isNaN(demo.getTime()) && demo < end) {
      end = demo;
    }
  }
  let days = workingDaysBetween(start, end);
  if (days < 0) days = 0;
  return days;
};

const isActiveProductionStatus = (value?: string | null) => {
  if (!value) return true;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return true;
  // Exclude "BEENDET" and "VOLLST_K_E_S" (vollständig kontrolliert, erwartet Setzen)
  return normalized !== "BEENDET" && normalized !== "VOLLST_K_E_S";
};

const relevantWebsiteDate = (
  status: ProjectStatus,
  website?: {
    webDate?: Date | null;
    demoDate?: Date | null;
    onlineDate?: Date | null;
    lastMaterialAt?: Date | null;
  },
) => {
  if (!website) return null;
  switch (status) {
    case "WEBTERMIN":
      return toDate(website.webDate);
    case "MATERIAL":
      return toDate(website.lastMaterialAt) ?? toDate(website.webDate);
    case "UMSETZUNG":
      return toDate(website.lastMaterialAt) ?? toDate(website.webDate);
    case "DEMO":
      return (
        toDate(website.demoDate) ??
        toDate(website.lastMaterialAt) ??
        toDate(website.webDate)
      );
    case "ONLINE":
      return toDate(website.onlineDate);
    default:
      return null;
  }
};
type DashboardSearchParams = {
  scope?: string | string[];
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  // Require authentication - redirect to login if not authenticated
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const userRole = (session.user.role ?? "CUSTOMER") as "ADMIN" | "AGENT" | "SALES" | "CUSTOMER";
  const sessionUserId = session.user.id ?? null;

  // Special dashboard for SALES users
  if (userRole === "SALES") {
    // Fetch favorite clients
    const favoriteClients = await getFavoriteClients();

    // Fetch latest completed website projects
    const latestWebsites = await prisma.project.findMany({
      where: {
        type: "WEBSITE",
        website: {
          is: {
            onlineDate: { not: null },
          },
        },
      },
      include: {
        client: {
          select: {
            name: true,
            agency: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        website: {
          select: {
            domain: true,
            onlineDate: true,
          },
        },
      },
      orderBy: {
        website: {
          onlineDate: "desc",
        },
      },
      take: 10,
    });

    // Fetch latest completed film projects
    const latestFilms = await prisma.project.findMany({
      where: {
        type: "FILM",
        film: {
          is: {
            onlineDate: { not: null },
          },
        },
      },
      include: {
        client: {
          select: {
            name: true,
            agency: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        film: {
          select: {
            onlineLink: true,
            finalLink: true,
            onlineDate: true,
            scope: true,
          },
        },
      },
      orderBy: {
        film: {
          onlineDate: "desc",
        },
      },
      take: 10,
    });

    // Fetch all agencies for filter
    const agencies = await prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        logoIconPath: true,
      },
    });

    // Fetch notices for SALES (only active, not archived)
    const notices = await prisma.notice.findMany({
      where: {
        isActive: true,
        OR: [
          { visibility: "GLOBAL" },
          {
            visibility: "TARGETED",
            recipients: {
              some: { userId: sessionUserId ?? undefined },
            },
          },
        ],
      },
      include: {
        recipients: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const noticeBoardEntries: NoticeBoardEntry[] = notices.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      createdAt: n.createdAt.toISOString(),
      isPinned: false, // SALES users don't have pinning functionality
      requireAcknowledgement: n.requireAcknowledgement,
      visibility: n.visibility,
      targetLabel: buildNoticeTargetLabel(n.visibility, "SALES", n.recipients),
    }));

    return (
      <main className="p-6 space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-100 dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent">
          Dashboard - Vertrieb
        </h1>

        <section className="space-y-4 rounded-2xl border border-purple-100 dark:border-purple-900/50 bg-gradient-to-br from-white to-purple-50/30 dark:from-slate-800 dark:to-purple-950/30 p-5 sm:p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent">
              Wichtige Hinweise
            </h2>
            <Link href="/notices" className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors">
              Hinweis-Historie →
            </Link>
          </div>
          <NoticeBoard notices={noticeBoardEntries} canAcknowledge={false} />
        </section>

        <SalesDashboard
          websiteProjects={latestWebsites.map((p) => ({
            id: p.id,
            title: p.title,
            clientName: p.client.name,
            domain: p.website?.domain ?? null,
            onlineDate: p.website?.onlineDate ?? null,
            agencyId: p.client.agency?.id ?? null,
            agencyName: p.client.agency?.name ?? null,
          }))}
          filmProjects={latestFilms.map((p) => ({
            id: p.id,
            title: p.title,
            clientName: p.client.name,
            onlineLink: p.film?.onlineLink ?? null,
            finalLink: p.film?.finalLink ?? null,
            onlineDate: p.film?.onlineDate ?? null,
            scope: p.film?.scope ?? null,
            agencyId: p.client.agency?.id ?? null,
            agencyName: p.client.agency?.name ?? null,
          }))}
          agencies={agencies}
          favoriteClients={favoriteClients.map((client) => ({
            id: client.id,
            name: client.name,
            customerNo: client.customerNo,
            agencyId: client.agency?.id ?? null,
            agencyName: client.agency?.name ?? null,
            agencyLogoIconPath: client.agency?.logoIconPath ?? null,
            projectsCount: client.projects.length,
            websiteProjectsCount: client.projects.filter(p => p.type === "WEBSITE").length,
            filmProjectsCount: client.projects.filter(p => p.type === "FILM").length,
            activeProjectsCount: client.projects.filter(p => p.status !== "ONLINE").length,
          }))}
        />
      </main>
    );
  }

  // Get effective user (could be an agent in dev mode)
  const effectiveUser = await getEffectiveUser();

  // Determine if we should filter by agent (only for AGENT role)
  const isAgentView = effectiveUser?.role === "AGENT";
  const agentId = isAgentView ? effectiveUser?.id : null;
  const userCategories = effectiveUser?.categories ?? [];

  // Map user categories to project types (applies to all users, not just agents)
  const allowedProjectTypes: ProjectType[] = [];
  if (userCategories.includes("WEBSEITE" as AgentCategory)) allowedProjectTypes.push("WEBSITE");
  if (userCategories.includes("FILM" as AgentCategory)) allowedProjectTypes.push("FILM");
  if (userCategories.includes("PRINT_DESIGN" as AgentCategory)) allowedProjectTypes.push("PRINT_DESIGN");
  if (userCategories.includes("SOCIALMEDIA" as AgentCategory)) allowedProjectTypes.push("SOCIAL");

  const now = new Date();

  const params = await searchParams;

  const scopeParam = Array.isArray(params?.scope)
    ? params.scope[0]
    : params?.scope;
  const scope: "all" | "active" = scopeParam === "all" ? "all" : "active";
  const activeEnabled = scope === "active";

  const websiteActiveWhere: Prisma.ProjectWhereInput = {
    type: "WEBSITE",
    website: { is: { pStatus: { notIn: DONE_PRODUCTION_STATUSES } } },
  };

  const filmActiveWhere: Prisma.ProjectWhereInput = {
    type: "FILM",
    film: { is: { status: { not: "BEENDET" } } },
  };

  const socialActiveWhere: Prisma.ProjectWhereInput = {
    type: "SOCIAL",
    status: { not: "ONLINE" },
  };

  const printDesignActiveWhere: Prisma.ProjectWhereInput = {
    type: "PRINT_DESIGN",
    printDesign: { is: { pStatus: { not: "BEENDET" } } },
  };

  const baseActiveProjectWhere: Prisma.ProjectWhereInput = {
    OR: [websiteActiveWhere, filmActiveWhere, printDesignActiveWhere, socialActiveWhere],
  };

  const activeProjectWhere: Prisma.ProjectWhereInput | undefined = activeEnabled
    ? baseActiveProjectWhere
    : undefined;

  // Add agent filter if in agent view AND agent has categories
  // Agents without categories should see all projects in statistics (like admins)
  // Agent can be assigned via:
  // 1. Project.agentId (for website/social projects)
  // 2. ProjectFilm.filmerId or ProjectFilm.cutterId (for film projects)
  const agentFilterWhere: Prisma.ProjectWhereInput | undefined = agentId && userCategories.length > 0
    ? {
        OR: [
          { agentId }, // Direct assignment
          { film: { is: { filmerId: agentId } } }, // Film assignment as filmer
          { film: { is: { cutterId: agentId } } }, // Film assignment as cutter
        ],
      }
    : undefined;

  // For agenda: ALWAYS filter by agent assignment, regardless of categories
  const agentAgendaFilterWhere: Prisma.ProjectWhereInput | undefined = agentId
    ? {
        OR: [
          { agentId }, // Direct assignment
          { film: { is: { filmerId: agentId } } }, // Film assignment as filmer
          { film: { is: { cutterId: agentId } } }, // Film assignment as cutter
        ],
      }
    : undefined;

  // Combine active filter with agent filter
  const baseWhere: Prisma.ProjectWhereInput | undefined =
    activeProjectWhere && agentFilterWhere
      ? { AND: [activeProjectWhere, agentFilterWhere] }
      : activeProjectWhere ?? agentFilterWhere;

  const noticeTargetUserId = agentId ?? sessionUserId;

  let noticeWhere: Prisma.NoticeWhereInput = { isActive: true };
  if (!(userRole === "ADMIN" && !isAgentView)) {
    if (noticeTargetUserId) {
      noticeWhere = {
        isActive: true,
        OR: [
          { visibility: "GLOBAL" as const },
          { visibility: "TARGETED" as const, recipients: { some: { userId: noticeTargetUserId } } },
        ],
      };
    } else {
      noticeWhere = {
        isActive: true,
        visibility: "GLOBAL" as const,
      };
    }
  }
  const acknowledgementUserId = noticeTargetUserId ?? sessionUserId ?? "";

  const [
    scopedProjectsCount,
    activeProjectsCount,
    allProjectsCount,
    websiteCount,
    filmCount,
    printDesignCount,
    socialCount,
    websiteCountUnfiltered,
    filmCountUnfiltered,
    printDesignCountUnfiltered,
    socialCountUnfiltered,
    nonWebsiteStatusCountsRaw,
    overdueCandidates,
    dashboardNotices,
  ] = await Promise.all([
    prisma.project.count({ where: baseWhere }),
    prisma.project.count({
      where: agentFilterWhere
        ? { AND: [baseActiveProjectWhere, agentFilterWhere] }
        : baseActiveProjectWhere,
    }),
    prisma.project.count({
      where: agentFilterWhere ?? {},
    }),
    prisma.project.count({
      where: baseWhere
        ? { AND: [baseWhere, { website: { isNot: null } }] }
        : { website: { isNot: null } },
    }),
    prisma.project.count({
      where: baseWhere
        ? { AND: [baseWhere, { film: { isNot: null } }] }
        : { film: { isNot: null } },
    }),
    prisma.project.count({
      where: baseWhere
        ? { AND: [baseWhere, { printDesign: { isNot: null } }] }
        : { printDesign: { isNot: null } },
    }),
    prisma.project.count({
      where: baseWhere
        ? { AND: [baseWhere, { type: "SOCIAL" }] }
        : { type: "SOCIAL" },
    }),
    // Unfiltered counts (without agent filter) for info tiles
    prisma.project.count({
      where: activeProjectWhere
        ? { AND: [activeProjectWhere, { website: { isNot: null } }] }
        : { website: { isNot: null } },
    }),
    prisma.project.count({
      where: activeProjectWhere
        ? { AND: [activeProjectWhere, { film: { isNot: null } }] }
        : { film: { isNot: null } },
    }),
    prisma.project.count({
      where: activeProjectWhere
        ? { AND: [activeProjectWhere, { printDesign: { isNot: null } }] }
        : { printDesign: { isNot: null } },
    }),
    prisma.project.count({
      where: activeProjectWhere
        ? { AND: [activeProjectWhere, { type: "SOCIAL" }] }
        : { type: "SOCIAL" },
    }),
    prisma.project.groupBy({
      by: ["type", "status"],
      where: (() => {
        const typeFilter: Prisma.ProjectWhereInput = { type: { not: "WEBSITE" } };
        const statusFilter: Prisma.ProjectWhereInput | undefined = activeEnabled
          ? { status: { not: "ONLINE" } }
          : undefined;
        const filters: Prisma.ProjectWhereInput[] = [
          typeFilter,
          ...(statusFilter ? [statusFilter] : []),
          ...(agentFilterWhere ? [agentFilterWhere] : []),
        ];
        return filters.length > 1 ? { AND: filters } : filters[0];
      })(),
      _count: { _all: true },
    }),
    prisma.project.findMany({
      where: (() => {
        const overdueWhere: Prisma.ProjectWhereInput = {
          type: "WEBSITE",
          status: "UMSETZUNG",
          website: {
            is: {
              materialStatus: "VOLLSTAENDIG",
              lastMaterialAt: { not: null },
            },
          },
        };
        return agentFilterWhere
          ? { AND: [overdueWhere, agentFilterWhere] }
          : overdueWhere;
      })(),
      select: {
        id: true,
        status: true,
        website: { select: { lastMaterialAt: true, demoDate: true } },
      },
    }),
    prisma.notice.findMany({
      where: noticeWhere,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        recipients: {
          select: {
            user: { select: { name: true } },
          },
        },
        acknowledgements: {
          where: { userId: acknowledgementUserId },
          select: { readAt: true, userId: true },
        },
      },
    }),
  ]);

  const noticeBoardEntries: NoticeBoardEntry[] = dashboardNotices.map((notice) => {
    const acknowledgement = notice.acknowledgements?.[0];
    return {
      id: notice.id,
      title: notice.title,
      message: notice.message,
      createdAt: notice.createdAt.toISOString(),
      requireAcknowledgement: notice.requireAcknowledgement,
      acknowledgedAt: acknowledgement?.readAt
        ? acknowledgement.readAt.toISOString()
        : null,
      visibility: notice.visibility,
      targetLabel: buildNoticeTargetLabel(
        notice.visibility,
        isAgentView ? "AGENT" : userRole,
        notice.recipients,
      ),
      authorName: notice.createdBy.name,
    };
  });

  const activeWebsiteConstraint: Prisma.ProjectWhereInput = {
    type: "WEBSITE",
    website: { is: { pStatus: { notIn: DONE_PRODUCTION_STATUSES } } },
  };

  const websiteStatusCountEntries = await Promise.all(
    STATUSES.map(async (status) => {
      const baseWhere = buildWebsiteStatusWhere(status, now);
      if (!baseWhere) return [status, 0, 0] as const;
      const filters: Prisma.ProjectWhereInput[] = [
        baseWhere,
        ...(activeEnabled ? [activeWebsiteConstraint] : []),
        ...(agentFilterWhere ? [agentFilterWhere] : []),
      ];
      const scopedWhere = filters.length > 1 ? { AND: filters } : filters[0];

      // Load projects to count total and stale
      const projects = await prisma.project.findMany({
        where: scopedWhere,
        select: {
          id: true,
          status: true,
          client: {
            select: {
              workStopped: true,
              finished: true,
            },
          },
          website: {
            select: {
              webDate: true,
              demoDate: true,
              onlineDate: true,
              lastMaterialAt: true,
              pStatus: true,
            }
          }
        }
      });

      const count = projects.length;

      // Count stale projects (older than 4 weeks based on relevant date)
      // Skip for "ONLINE" status as it's not relevant there
      const staleCount = status === "ONLINE" ? 0 : projects.filter((project) => {
        const website = project.website;
        if (!website) return false;
        if (project.client?.workStopped || project.client?.finished) return false;
        if (!isActiveProductionStatus(website.pStatus)) return false;
        const relevantDate = relevantWebsiteDate(status, website);
        return isOlderThan4Weeks(relevantDate ?? undefined);
      }).length;

      return [status, count, staleCount] as const;
    })
  );

  // Film-spezifische Kacheln basierend auf Daten
  const filmProjectsWhere: Prisma.ProjectWhereInput = activeEnabled
    ? { film: { isNot: null, is: { status: { not: "BEENDET" } } } }
    : { film: { isNot: null } };

  const filmWhereWithAgent = agentFilterWhere
    ? { AND: [filmProjectsWhere, agentFilterWhere] }
    : filmProjectsWhere;

  // Load all film projects and derive their status
  const filmProjects = await prisma.project.findMany({
    where: filmWhereWithAgent,
    select: {
      film: {
        select: {
          status: true,
          scope: true,
          onlineDate: true,
          finalToClient: true,
          firstCutToClient: true,
          shootDate: true,
          scriptApproved: true,
          scriptToClient: true,
          scouting: true,
          contractStart: true,
          lastContact: true,
          previewVersions: {
            orderBy: { sentDate: "desc" },
            take: 1,
            select: { sentDate: true },
          },
        }
      }
    }
  });

  // Helper function to check if date is in the past
  const isInPast = (date: Date | null | undefined) => {
    if (!date) return false;
    return new Date(date).getTime() < Date.now();
  };

  // Derive status for each film project (same logic as in film-projects/page.tsx)
  const deriveFilmStatus = (film: {
    status?: string | null;
    onlineDate?: Date | null;
    finalToClient?: Date | null;
    firstCutToClient?: Date | null;
    shootDate?: Date | null;
    scriptApproved?: Date | null;
    scriptToClient?: Date | null;
    scouting?: Date | null;
  } | null) => {
    if (!film) return "SCOUTING";
    if (film.status === "BEENDET") return "BEENDET";
    if (film.onlineDate) return "ONLINE";
    if (film.finalToClient) return "FINALVERSION";
    if (film.firstCutToClient) return "VORABVERSION";
    if (isInPast(film.shootDate)) return "SCHNITT";
    if (film.scriptApproved) return "DREH";
    if (film.scriptToClient) return "SKRIPTFREIGABE";
    if (isInPast(film.scouting)) return "SKRIPT";
    return "SCOUTING";
  };

  // Count projects by derived status and track stale projects
  const filmStatusCounts: Record<string, number> = {};
  const filmStaleCounts: Record<string, number> = {};

  filmProjects.forEach((project) => {
    const film = project.film;
    const latestPreview = film?.previewVersions?.[0];
    const mergedFirstCut = latestPreview?.sentDate ?? film?.firstCutToClient;
    const status = deriveFilmStatus({
      ...film,
      firstCutToClient: mergedFirstCut,
    });

    const isActiveFilm = !film?.status || film.status === "AKTIV";
    if (activeEnabled && !isActiveFilm) {
      return;
    }

    // Count total
    filmStatusCounts[status] = (filmStatusCounts[status] || 0) + 1;

    // Determine relevant date for this status
    let relevantDate: Date | null | undefined = null;
    switch (status) {
      case "SCOUTING":
        relevantDate = film?.scouting || film?.contractStart;
        break;
      case "SKRIPT":
        relevantDate = film?.scouting;
        break;
      case "SKRIPTFREIGABE":
        relevantDate = film?.scriptToClient;
        break;
      case "DREH":
        relevantDate = film?.scriptApproved;
        break;
      case "SCHNITT":
        relevantDate = film?.shootDate;
        break;
      case "VORABVERSION":
        relevantDate = mergedFirstCut;
        break;
      case "FINALVERSION":
        relevantDate = film?.finalToClient;
        break;
      case "ONLINE":
        relevantDate = film?.onlineDate;
        break;
      case "BEENDET":
        relevantDate = film?.onlineDate || film?.lastContact;
        break;
    }

    const lastContactDate = film?.lastContact ? new Date(film.lastContact) : null;
    const normalizedRelevant =
      relevantDate instanceof Date ? relevantDate : relevantDate ? new Date(relevantDate) : null;
    let effectiveDate = normalizedRelevant ?? null;
    if (lastContactDate && (!effectiveDate || lastContactDate > effectiveDate)) {
      effectiveDate = lastContactDate;
    }

    // Count stale (older than 4 weeks) only for active film projects
    if (isActiveFilm && isOlderThan4Weeks(effectiveDate)) {
      filmStaleCounts[status] = (filmStaleCounts[status] || 0) + 1;
    }
  });

  const filmScoutingCount = filmStatusCounts["SCOUTING"] || 0;
  const filmScriptCount = filmStatusCounts["SKRIPT"] || 0;
  const filmScriptApprovalCount = filmStatusCounts["SKRIPTFREIGABE"] || 0;
  const filmShootCount = filmStatusCounts["DREH"] || 0;
  const filmCutCount = filmStatusCounts["SCHNITT"] || 0;
  const filmVorabCount = filmStatusCounts["VORABVERSION"] || 0;
  const filmPreviewCount = filmStatusCounts["FINALVERSION"] || 0;
  const filmOnlineCount = filmStatusCounts["ONLINE"] || 0;

  // Count film projects by scope (only for agents with film category)
  const filmScopeCounts: Record<string, number> = {};
  if (isAgentView && allowedProjectTypes.includes("FILM")) {
    filmProjects.forEach((project) => {
      const scope = project.film?.scope;
      if (scope) {
        filmScopeCounts[scope] = (filmScopeCounts[scope] || 0) + 1;
      }
    });
  }

  // Print Design-spezifische Kacheln basierend auf Daten
  const printDesignProjectsWhere: Prisma.ProjectWhereInput = activeEnabled
    ? { printDesign: { isNot: null, is: { pStatus: { not: "BEENDET" } } } }
    : { printDesign: { isNot: null } };

  const printDesignWhereWithAgent = agentFilterWhere
    ? { AND: [printDesignProjectsWhere, agentFilterWhere] }
    : printDesignProjectsWhere;

  // Load all print design projects and derive their status
  const printDesignProjects = await prisma.project.findMany({
    where: printDesignWhereWithAgent,
    select: {
      printDesign: {
        select: {
          pStatus: true,
          webtermin: true,
          designToClient: true,
          designApproval: true,
          finalVersionToClient: true,
          printRequired: true,
          printOrderPlaced: true,
        }
      },
      client: {
        select: {
          workStopped: true,
          finished: true,
        }
      }
    }
  });

  // Count projects by derived status and track stale projects
  const printDesignStatusCounts: Record<string, number> = {};
  const printDesignStaleCounts: Record<string, number> = {};

  printDesignProjects.forEach((project) => {
    const printDesign = project.printDesign;
    const status = derivePrintDesignStatus({
      status: printDesign?.pStatus,
      webtermin: printDesign?.webtermin,
      designToClient: printDesign?.designToClient,
      designApproval: printDesign?.designApproval,
      finalVersionToClient: printDesign?.finalVersionToClient,
      printRequired: printDesign?.printRequired,
      printOrderPlaced: printDesign?.printOrderPlaced,
    });

    const isActivePrintDesign = !printDesign?.pStatus || printDesign.pStatus !== "BEENDET";
    if (activeEnabled && !isActivePrintDesign) {
      return;
    }

    // Count total
    printDesignStatusCounts[status] = (printDesignStatusCounts[status] || 0) + 1;

    // Determine relevant date for this status
    const relevantDate = getPrintDesignStatusDate(status, {
      webtermin: printDesign?.webtermin,
      designToClient: printDesign?.designToClient,
      designApproval: printDesign?.designApproval,
      finalVersionToClient: printDesign?.finalVersionToClient,
      printOrderPlaced: printDesign?.printOrderPlaced,
    });

    // Count stale (older than 4 weeks) only for active projects and skip ABGESCHLOSSEN
    if (isActivePrintDesign && status !== "ABGESCHLOSSEN" && !project.client?.workStopped && !project.client?.finished && isOlderThan4Weeks(relevantDate)) {
      printDesignStaleCounts[status] = (printDesignStaleCounts[status] || 0) + 1;
    }
  });

  const printDesignWebterminCount = printDesignStatusCounts["WEBTERMIN"] || 0;
  const printDesignUmsetzungCount = printDesignStatusCounts["UMSETZUNG"] || 0;
  const printDesignDesignAnKundenCount = printDesignStatusCounts["DESIGN_AN_KUNDEN"] || 0;
  const printDesignDesignabnahmeCount = printDesignStatusCounts["DESIGNABNAHME"] || 0;
  const printDesignFinalversionCount = printDesignStatusCounts["FINALVERSION"] || 0;
  const printDesignDruckCount = printDesignStatusCounts["DRUCK"] || 0;
  const printDesignAbgeschlossenCount = printDesignStatusCounts["ABGESCHLOSSEN"] || 0;

  const typeCountMap = new Map<ProjectType, number>([
    ["WEBSITE", websiteCount],
    ["FILM", filmCount],
    ["PRINT_DESIGN", printDesignCount],
    ["SOCIAL", socialCount],
  ]);

  // Unfiltered counts for info tiles (without agent filter)
  const typeCountMapUnfiltered = new Map<ProjectType, number>([
    ["WEBSITE", websiteCountUnfiltered],
    ["FILM", filmCountUnfiltered],
    ["PRINT_DESIGN", printDesignCountUnfiltered],
    ["SOCIAL", socialCountUnfiltered],
  ]);

  const nonWebsiteStatusMap = new Map<ProjectType, Map<ProjectStatus, number>>();
  for (const entry of nonWebsiteStatusCountsRaw) {
    const type = entry.type as ProjectType;
    const status = entry.status as ProjectStatus;
    if (!nonWebsiteStatusMap.has(type)) nonWebsiteStatusMap.set(type, new Map<ProjectStatus, number>());
    const count = typeof entry._count === 'object' && entry._count !== null ? entry._count._all : 0;
    nonWebsiteStatusMap.get(type)!.set(status, count);
  }

  const websiteStatusCountMap = new Map<ProjectStatus, number>(
    websiteStatusCountEntries.map(([status, count]) => [status, count])
  );
  const websiteStaleCountMap = new Map<ProjectStatus, number>(
    websiteStatusCountEntries.map(([status, , staleCount]) => [status, staleCount])
  );

  const scopeLinks = [
    { key: "active", label: `Aktive Projekte (${activeProjectsCount})`, href: "/dashboard" },
    { key: "all", label: `Alle Projekte (${allProjectsCount})`, href: "/dashboard?scope=all" },
  ] as const;

  const appendQueryParam = (href: string, key: string, value: string | number | boolean) => {
    const separator = href.includes("?") ? "&" : "?";
    return `${href}${separator}${key}=${encodeURIComponent(String(value))}`;
  };

  const withScope = (href: string) => {
    let url = href;

    // Don't add scope parameter to project pages - it's only for dashboard filtering
    // Just add agent filter if in agent view
    if (isAgentView && agentId) {
      url = `${url}${url.includes("?") ? "&" : "?"}agent=${agentId}`;
    }

    return url;
  };

  // Filter project types by user categories (if any categories are assigned)
  const visibleProjectTypes = allowedProjectTypes.length > 0
    ? PROJECT_TYPES.filter((type) => allowedProjectTypes.includes(type.key))
    : PROJECT_TYPES;

  // Build overview tiles
  // For agents with categories: show assigned types (with agent name) + all types (with "Alle")
  // For agents without categories or admins: show visible types only
  const overviewTiles: Array<{ key: string; label: string; count: number; href: string }> = [];

  // Add tiles for assigned project types
  visibleProjectTypes.forEach((type) => {
    // For agents with categories: add agent-filtered tile + all-projects tile
    if (isAgentView && allowedProjectTypes.length > 0) {
      // Agent-specific tile
      overviewTiles.push({
        key: type.key,
        label: `${type.label} (${effectiveUser?.name ?? "Agent"})`,
        count: typeCountMap.get(type.key) ?? 0,
        href: withScope(type.href),
      });

      // All-projects tile for this type
      overviewTiles.push({
        key: `${type.key}_ALL`,
        label: `${type.label} (Alle)`,
        count: typeCountMapUnfiltered.get(type.key) ?? 0,
        href: type.href, // Without agent filter
      });
    } else {
      // For admins/agents without categories: just show the type
      overviewTiles.push({
        key: type.key,
        label: type.label,
        count: typeCountMap.get(type.key) ?? 0,
        href: withScope(type.href),
      });
    }
  });

  // For agents with specific categories: show OTHER project types as info (clickable to all projects)
  if (isAgentView && allowedProjectTypes.length > 0) {
    const otherProjectTypes = PROJECT_TYPES.filter(
      (type) => !allowedProjectTypes.includes(type.key)
    );

    otherProjectTypes.forEach((type) => {
      overviewTiles.push({
        key: `${type.key}_INFO`,
        label: `${type.label} (Alle)`,
        count: typeCountMapUnfiltered.get(type.key) ?? 0, // Use unfiltered count for info tiles
        href: type.href, // Link to all projects of this type (without agent filter)
      });
    });
  }

  const overdueProjectsCount = overdueCandidates.reduce((count, project) => {
    if (project.status !== "UMSETZUNG") return count;
    const last = project.website?.lastMaterialAt;
    if (!last) return count;
    const demo = project.website?.demoDate;
    const days = workingDaysSince(last, demo);
    return days !== null && days >= 60 ? count + 1 : count;
  }, 0);
  const statusSections = visibleProjectTypes.map((type) => {
    // Build label with agent name if in agent view
    const sectionLabel = isAgentView && allowedProjectTypes.length > 0
      ? `${type.label} von ${effectiveUser?.name ?? "Agent"}`
      : type.label;

    if (type.key === "WEBSITE") {
      const tiles = [
        ...STATUSES.map((status) => ({
          key: status,
          label: STATUS_LABELS[status],
          count: websiteStatusCountMap.get(status) ?? 0,
          staleCount: websiteStaleCountMap.get(status) ?? 0,
          href: withScope(appendQueryParam(type.href, "status", status)),
        })),
        {
          key: "OVERDUE",
          label: "\u00DCberf\u00E4llige Projekte (60+ Tage)",
          count: overdueProjectsCount,
          staleCount: 0,
          href: withScope(appendQueryParam(type.href, "overdue", 1)),
        },
      ];
      return { ...type, label: sectionLabel, tiles };
    }

    if (type.key === "FILM") {
      const tiles = [
        {
          key: "SCOUTING",
          label: "Scouting",
          count: filmScoutingCount,
          staleCount: filmStaleCounts["SCOUTING"] || 0,
          href: withScope("/film-projects?status=SCOUTING"),
        },
        {
          key: "SCRIPT",
          label: "Skript",
          count: filmScriptCount,
          staleCount: filmStaleCounts["SKRIPT"] || 0,
          href: withScope("/film-projects?status=SKRIPT"),
        },
        {
          key: "SCRIPT_APPROVAL",
          label: "Skriptfreigabe",
          count: filmScriptApprovalCount,
          staleCount: filmStaleCounts["SKRIPTFREIGABE"] || 0,
          href: withScope("/film-projects?status=SKRIPTFREIGABE"),
        },
        {
          key: "SHOOT",
          label: "Dreh",
          count: filmShootCount,
          staleCount: filmStaleCounts["DREH"] || 0,
          href: withScope("/film-projects?status=DREH"),
        },
        {
          key: "CUT",
          label: "Schnitt",
          count: filmCutCount,
          staleCount: filmStaleCounts["SCHNITT"] || 0,
          href: withScope("/film-projects?status=SCHNITT"),
        },
        {
          key: "VORABVERSION",
          label: "Vorabversion",
          count: filmVorabCount,
          staleCount: filmStaleCounts["VORABVERSION"] || 0,
          href: withScope("/film-projects?status=VORABVERSION"),
        },
        {
          key: "PREVIEW",
          label: "Finalversion",
          count: filmPreviewCount,
          staleCount: filmStaleCounts["FINALVERSION"] || 0,
          href: withScope("/film-projects?status=FINALVERSION"),
        },
        {
          key: "ONLINE",
          label: "Online",
          count: filmOnlineCount,
          staleCount: 0,
          href: withScope("/film-projects?status=ONLINE"),
        },
      ];
      return { ...type, label: sectionLabel, tiles };
    }

    if (type.key === "PRINT_DESIGN") {
      const tiles = [
        {
          key: "WEBTERMIN",
          label: PRINT_DESIGN_STATUS_LABELS["WEBTERMIN"],
          count: printDesignWebterminCount,
          staleCount: printDesignStaleCounts["WEBTERMIN"] || 0,
          href: withScope("/print-design?status=WEBTERMIN"),
        },
        {
          key: "UMSETZUNG",
          label: PRINT_DESIGN_STATUS_LABELS["UMSETZUNG"],
          count: printDesignUmsetzungCount,
          staleCount: printDesignStaleCounts["UMSETZUNG"] || 0,
          href: withScope("/print-design?status=UMSETZUNG"),
        },
        {
          key: "DESIGN_AN_KUNDEN",
          label: PRINT_DESIGN_STATUS_LABELS["DESIGN_AN_KUNDEN"],
          count: printDesignDesignAnKundenCount,
          staleCount: printDesignStaleCounts["DESIGN_AN_KUNDEN"] || 0,
          href: withScope("/print-design?status=DESIGN_AN_KUNDEN"),
        },
        {
          key: "DESIGNABNAHME",
          label: PRINT_DESIGN_STATUS_LABELS["DESIGNABNAHME"],
          count: printDesignDesignabnahmeCount,
          staleCount: printDesignStaleCounts["DESIGNABNAHME"] || 0,
          href: withScope("/print-design?status=DESIGNABNAHME"),
        },
        {
          key: "FINALVERSION",
          label: PRINT_DESIGN_STATUS_LABELS["FINALVERSION"],
          count: printDesignFinalversionCount,
          staleCount: printDesignStaleCounts["FINALVERSION"] || 0,
          href: withScope("/print-design?status=FINALVERSION"),
        },
        {
          key: "DRUCK",
          label: PRINT_DESIGN_STATUS_LABELS["DRUCK"],
          count: printDesignDruckCount,
          staleCount: printDesignStaleCounts["DRUCK"] || 0,
          href: withScope("/print-design?status=DRUCK"),
        },
        {
          key: "ABGESCHLOSSEN",
          label: PRINT_DESIGN_STATUS_LABELS["ABGESCHLOSSEN"],
          count: printDesignAbgeschlossenCount,
          staleCount: 0,
          href: withScope("/print-design?status=ABGESCHLOSSEN"),
        },
      ];
      return { ...type, label: sectionLabel, tiles };
    }

    const statusMap = nonWebsiteStatusMap.get(type.key) ?? new Map<ProjectStatus, number>();
    const tiles = STATUSES.map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      count: statusMap.get(status) ?? 0,
      staleCount: 0, // Social media projects don't track stale for now
      href: withScope(appendQueryParam(type.href, "status", status)),
    }));
    return { ...type, label: sectionLabel, tiles };
  });

  const workStoppedProjects = isAgentView && agentId
    ? await prisma.project.findMany({
        where: (() => {
          const filters: Prisma.ProjectWhereInput[] = [
            { client: { is: { workStopped: true } } },
            // Exclude finished projects based on type
            {
              OR: [
                // Website projects: exclude if status is ONLINE or pStatus is BEENDET
                {
                  type: "WEBSITE",
                  status: { not: "ONLINE" },
                  website: {
                    is: {
                      pStatus: { notIn: DONE_PRODUCTION_STATUSES },
                    },
                  },
                },
                // Film projects: exclude if film.status is BEENDET
                {
                  type: "FILM",
                  film: {
                    is: {
                      status: { not: "BEENDET" },
                    },
                  },
                },
                // Print Design projects: exclude if pStatus is BEENDET
                {
                  type: "PRINT_DESIGN",
                  printDesign: {
                    is: {
                      pStatus: { not: "BEENDET" },
                    },
                  },
                },
                // Social projects: exclude if status is ONLINE
                {
                  type: "SOCIAL",
                  status: { not: "ONLINE" },
                },
              ],
            },
          ];
          if (agentFilterWhere) filters.push(agentFilterWhere);
          return filters.length > 1 ? { AND: filters } : filters[0];
        })(),
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          client: {
            select: {
              name: true,
              customerNo: true,
            },
          },
          film: {
            select: {
              status: true,
              onlineDate: true,
              finalToClient: true,
              firstCutToClient: true,
              shootDate: true,
              scriptApproved: true,
              scriptToClient: true,
              scouting: true,
              previewVersions: {
                orderBy: { sentDate: "desc" },
                take: 1,
                select: { sentDate: true },
              },
            },
          },
          website: {
            select: {
              pStatus: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : [];

  // Admin only: Projects that need installation attention
  // Use buildWebsiteStatusWhere to get projects that are dynamically in UMSETZUNG status
  const umsetzungWhere = buildWebsiteStatusWhere("UMSETZUNG", new Date());
  const projectsNeedingInstallation = userRole === "ADMIN" && umsetzungWhere
    ? await prisma.project.findMany({
        where: {
          AND: [
            umsetzungWhere,
            {
              joomlaInstallations: {
                none: {},
              },
            },
            {
              website: {
                is: {
                  OR: [
                    { demoLink: null },
                    { demoLink: "" },
                  ],
                },
              },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          client: {
            select: {
              id: true,
              name: true,
              customerNo: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  // Removed: unassignedInstallations - no longer showing standalone installations in dashboard

  type AgentAgendaEntry = {
    id: string;
    projectUrl: string;
    customerLabel: string;
    typeLabel: string;
    title: string;
    taskType: string;
    taskDate: Date | null;
    isWorkStopped: boolean;
    category: "appointment" | "task";
    hasInstallation: boolean;
    installationUrl?: string | null;
  };

  const upcomingAgendaConditions: Prisma.ProjectWhereInput[] = [];

  // If agent has no categories, show all project types
  const showAllTypes = userCategories.length === 0;

  if (showAllTypes || userCategories.includes("WEBSEITE" as AgentCategory)) {
    upcomingAgendaConditions.push(
      {
        type: "WEBSITE",
        website: {
          is: {
            AND: [
              { pStatus: { notIn: DONE_PRODUCTION_STATUSES } },
              { onlineDate: null },
              { demoDate: null },
              {
                OR: [
                  { webDate: null },
                  { webDate: { gt: now } },
                ],
              },
            ],
          },
        },
      },
      {
        type: "WEBSITE",
        website: {
          is: {
            AND: [
              { pStatus: { notIn: DONE_PRODUCTION_STATUSES } },
              { onlineDate: null },
              { demoDate: null },
              { webDate: { lte: now } },
              {
                OR: [
                  { pStatus: "VOLLST_A_K" },
                  { materialStatus: "VOLLSTAENDIG" },
                ],
              },
            ],
          },
        },
      },
    );
  }

  if (showAllTypes || userCategories.includes("FILM" as AgentCategory)) {
    upcomingAgendaConditions.push(
      // Termine: Scouting (zukünftig, nur AKTIV)
      {
        type: "FILM",
        film: {
          is: {
            scouting: {
              gte: now,
            },
            status: "AKTIV",
          },
        },
      },
      // Termine: Dreh (zukünftig, nur AKTIV)
      {
        type: "FILM",
        film: {
          is: {
            shootDate: {
              gte: now,
            },
            status: "AKTIV",
          },
        },
      },
      // Aufgaben: Skript (scouting in Vergangenheit, kein scriptToClient, nur AKTIV)
      {
        type: "FILM",
        film: {
          is: {
            scouting: {
              lt: now,
            },
            scriptToClient: null,
            status: "AKTIV",
          },
        },
      },
      // Aufgaben: Schnitt (shootDate in Vergangenheit, kein firstCutToClient, nur AKTIV)
      {
        type: "FILM",
        film: {
          is: {
            shootDate: {
              lt: now,
            },
            firstCutToClient: null,
            status: "AKTIV",
          },
        },
      },
    );
  }

  const upcomingAgentProjects = isAgentView && agentId
    ? await prisma.project.findMany({
        where: (() => {
          const filters: Prisma.ProjectWhereInput[] = [{ OR: upcomingAgendaConditions }];
          if (agentAgendaFilterWhere) filters.push(agentAgendaFilterWhere);
          return filters.length > 1 ? { AND: filters } : filters[0];
        })(),
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          client: {
            select: {
              name: true,
              customerNo: true,
              workStopped: true,
            },
          },
          website: {
            select: {
              webDate: true,
              webterminType: true,
              demoDate: true,
              onlineDate: true,
              materialStatus: true,
              pStatus: true,
              webDocumentation: {
                select: {
                  confirmedAt: true,
                },
              },
            },
          },
          film: {
            select: {
              scouting: true,
              shootDate: true,
              scriptToClient: true,
              scriptApproved: true,
              firstCutToClient: true,
              finalToClient: true,
              onlineDate: true,
              status: true,
              previewVersions: {
                orderBy: { sentDate: "desc" },
                take: 1,
                select: { sentDate: true },
              },
            },
          },
          joomlaInstallations: {
            select: {
              id: true,
              folderName: true,
              installUrl: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      })
    : [];

  const agentAgendaEntries = upcomingAgentProjects
    .map((project): AgentAgendaEntry | null => {
      const typeLabel = project.type === "WEBSITE"
        ? "Webseite"
        : project.type === "FILM"
        ? "Film"
        : project.type === "SOCIAL"
        ? "Social Media"
        : project.type;
      const customerLabel = [project.client?.customerNo, project.client?.name].filter(Boolean).join(" - ") || "Kunde unbekannt";
      const projectUrl = project.type === "FILM" ? `/film-projects/${project.id}` : `/projects/${project.id}`;

      let taskType = "";
      let taskDate: Date | null = null;
      let category: "appointment" | "task" = "task";

      if (project.type === "WEBSITE" && project.website) {
        const derivedStatus = deriveProjectStatus({
          pStatus: project.website.pStatus,
          webDate: project.website.webDate,
          webterminType: project.website.webterminType,
          demoDate: project.website.demoDate,
          onlineDate: project.website.onlineDate,
          materialStatus: project.website.materialStatus,
          webDokuConfirmedAt: project.website.webDocumentation?.confirmedAt,
          now,
        });

        if (derivedStatus === "WEBTERMIN" && project.website.webDate) {
          const typeLabel = project.website.webterminType === "TELEFONISCH"
            ? " (Telefonisch)"
            : project.website.webterminType === "BEIM_KUNDEN"
            ? " (Beim Kunden)"
            : project.website.webterminType === "IN_DER_AGENTUR"
            ? " (In der Agentur)"
            : "";
          taskType = `Webtermin${typeLabel}`;
          taskDate = new Date(project.website.webDate);
          category = "appointment";
        } else if (derivedStatus === "UMSETZUNG") {
          taskType = "In Umsetzung";
          taskDate = project.website.demoDate ? new Date(project.website.demoDate) : null;
          category = "task";
        } else {
          return null;
        }
      } else if (project.type === "FILM") {
        // Nur AKTIVE Filmprojekte anzeigen
        if (project.film?.status !== "AKTIV") {
          return null;
        }

        // Derive the actual film status to check if project is already further along
        const latestPreview = project.film?.previewVersions?.[0];
        const mergedFirstCut = latestPreview?.sentDate ?? project.film?.firstCutToClient;
        const derivedFilmStatus = deriveFilmStatusFromLib({
          status: project.film?.status,
          onlineDate: project.film?.onlineDate,
          finalToClient: project.film?.finalToClient,
          firstCutToClient: mergedFirstCut,
          shootDate: project.film?.shootDate,
          scriptApproved: project.film?.scriptApproved,
          scriptToClient: project.film?.scriptToClient,
          scouting: project.film?.scouting,
          previewVersions: project.film?.previewVersions,
        });

        // Termine: Scouting (zukünftig, nur wenn Status noch SCOUTING ist)
        if (
          derivedFilmStatus === "SCOUTING" &&
          project.film?.scouting &&
          new Date(project.film.scouting) >= now
        ) {
          taskType = "Scouting";
          taskDate = new Date(project.film.scouting);
          category = "appointment";
        }
        // Termine: Dreh (zukünftig, nur wenn Status DREH ist)
        else if (
          derivedFilmStatus === "DREH" &&
          project.film?.shootDate &&
          new Date(project.film.shootDate) >= now
        ) {
          taskType = "Dreh";
          taskDate = new Date(project.film.shootDate);
          category = "appointment";
        }
        // Aufgaben: Skript (nur wenn Status SKRIPT ist)
        else if (derivedFilmStatus === "SKRIPT") {
          const scoutingDate = project.film?.scouting ? new Date(project.film.scouting) : null;
          taskType = scoutingDate
            ? `Skript erstellen - Scouting war am ${formatDateOnly(scoutingDate)}`
            : "Skript erstellen";
          taskDate = null; // Kein separates Datum mehr anzeigen
          category = "task";
        }
        // Aufgaben: Schnitt (nur wenn Status SCHNITT ist)
        else if (derivedFilmStatus === "SCHNITT") {
          const shootDate = project.film?.shootDate ? new Date(project.film.shootDate) : null;
          taskType = shootDate
            ? `Schnitt erstellen - Dreh war am ${formatDateOnly(shootDate)}`
            : "Schnitt erstellen";
          taskDate = null; // Kein separates Datum mehr anzeigen
          category = "task";
        }
        else {
          return null;
        }
      } else {
        return null;
      }

      if (!taskType) {
        return null;
      }

      const hasInstallation = project.joomlaInstallations && project.joomlaInstallations.length > 0;
      const installationUrl = hasInstallation ? project.joomlaInstallations[0].installUrl : null;

      return {
        id: project.id,
        projectUrl,
        customerLabel,
        typeLabel,
        title: project.title ?? "Projekt ohne Titel",
        taskType,
        taskDate,
        isWorkStopped: Boolean(project.client?.workStopped),
        category,
        hasInstallation,
        installationUrl,
      } satisfies AgentAgendaEntry;
    })
    .filter((entry): entry is AgentAgendaEntry => entry !== null);

  const agentAppointments = agentAgendaEntries.filter((entry) => entry.category === "appointment");
  const agentTasks = agentAgendaEntries.filter((entry) => entry.category === "task");

  const agentAgendaGroups = [
    agentAppointments.length > 0
      ? { key: "appointments", title: `Termine (${agentAppointments.length})`, items: agentAppointments }
      : null,
    agentTasks.length > 0
      ? { key: "tasks", title: `Aufgaben (${agentTasks.length})`, items: agentTasks }
      : null,
  ].filter((group): group is { key: string; title: string; items: AgentAgendaEntry[] } => group !== null);

  // Zähle Projekte mit zu prüfendem Material (eingereichte Texte oder Bilder ohne Bewertung)
  const projectsNeedingMaterialReview = await prisma.project.count({
    where: {
      type: "WEBSITE",
      website: {
        webDocumentation: {
          OR: [
            // Allgemeiner Text eingereicht aber nicht geprüft
            {
              generalTextSubmission: {
                submittedAt: { not: null },
                suitable: null,
              },
            },
            // MenuItem-Texte eingereicht aber nicht geprüft
            {
              menuItems: {
                some: {
                  textSubmission: {
                    submittedAt: { not: null },
                    suitable: null,
                  },
                },
              },
            },
            // MenuItem-Bilder vom Kunden eingereicht aber noch nicht vom Agenten geprüft
            {
              menuItems: {
                some: {
                  needsImages: true,
                  imagesSubmittedAt: { not: null },
                  imagesReviewedAt: null,
                },
              },
            },
            // Logo-Bilder vom Kunden eingereicht aber noch nicht vom Agenten geprüft
            {
              materialLogoNeeded: true,
              logoImagesSubmittedAt: { not: null },
              logoImagesReviewedAt: null,
            },
            // Sonstige Bilder vom Kunden eingereicht aber noch nicht vom Agenten geprüft
            {
              materialNotesNeedsImages: true,
              generalImagesSubmittedAt: { not: null },
              generalImagesReviewedAt: null,
            },
          ],
        },
      },
    },
  });

  const renderAgendaEntry = (entry: AgentAgendaEntry) => {
    // Nur Installation-Status für Website-Projekte in Umsetzung anzeigen
    const showInstallationStatus = entry.category === "task" && entry.taskType === "In Umsetzung";

    return (
      <Link
        key={entry.id}
        href={entry.projectUrl}
        className={`block rounded-lg border p-3 transition-colors ${
          entry.isWorkStopped
            ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 hover:border-orange-400 dark:hover:border-orange-600"
            : "border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-600"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{entry.customerLabel}</span>
              {entry.isWorkStopped && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-300 bg-orange-200 dark:bg-orange-900/50 rounded">
                  ARBEITSSTOPP
                </span>
              )}
              {showInstallationStatus && (
                entry.hasInstallation ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 border-2 border-green-300 dark:border-green-700 rounded-full shadow-sm">
                    ✓ Demo installiert
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/50 dark:to-yellow-900/50 border-2 border-amber-400 dark:border-amber-600 rounded-full shadow-sm">
                    ⚠ Demo fehlt
                  </span>
                )
              )}
            </div>
            {entry.title && entry.title !== entry.typeLabel && entry.title !== "Website" && entry.title !== "Film" && entry.title !== "Social Media" && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                {entry.title}
              </div>
            )}
            <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-1">
              {entry.taskType}
              {entry.taskDate && ` · ${formatDateOnly(entry.taskDate)}`}
            </div>
            {showInstallationStatus && entry.hasInstallation && entry.installationUrl && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1 truncate">
                Demo-URL: {entry.installationUrl}
              </div>
            )}
          </div>
          <span className="text-xs text-blue-700 dark:text-blue-400 whitespace-nowrap">Details →</span>
        </div>
      </Link>
    );
  };

  return (
    <main className="p-6 space-y-6">
      {(isAgentView || allowedProjectTypes.length > 0) && (
        <div className="rounded-xl border border-blue-200/50 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-blue-900">
            {effectiveUser?.isDevMode ? "🔧 Dev-Modus: " : ""}
            {isAgentView
              ? `Hallo ${effectiveUser?.name ?? "Agent"}, schön dass du da bist!`
              : `Gefilterte Ansicht: ${effectiveUser?.name ?? "-"}`}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-100 dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          {scopeLinks.map((link) => {
            const active = link.key === scope;
            return (
              <Link
                key={link.key}
                href={link.href}
                className={
                  active
                    ? "px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white shadow-md font-medium transition-all"
                    : "px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-purple-100 dark:border-purple-900/50 bg-gradient-to-br from-white to-purple-50/30 dark:from-slate-800 dark:to-purple-950/30 p-5 sm:p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold bg-gradient-to-r from-purple-700 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">Wichtige Hinweise</h2>
            <Link href="/notices" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium transition-colors">
              Hinweis-Historie →
            </Link>
          </div>
          <NoticeBoard notices={noticeBoardEntries} canAcknowledge={isAgentView} />
        </section>

        {/* Admin: Installation Warnings - Slideout */}
        {userRole === "ADMIN" && (
          <InstallationWarningsSlideout
            projectsNeedingInstallation={projectsNeedingInstallation}
          />
        )}

        {isAgentView && workStoppedProjects.length > 0 && (
          <WorkStoppedProjectsAccordion projects={workStoppedProjects} />
        )}

        {/* Aktuelle Termine und Aufgaben - moved into grid */}
        {isAgentView && agentAgendaGroups.length > 0 && (
          <section className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-cyan-50/50 dark:from-blue-950/30 dark:to-cyan-950/30 p-5 sm:p-6 shadow-lg lg:col-span-2">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">📅</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-700 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent mb-2">
                Aktuelle Termine und Aufgaben ({agentAgendaEntries.length})
              </h2>
              <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-4">
                {userCategories.includes("WEBSEITE" as AgentCategory) && userCategories.includes("FILM" as AgentCategory)
                  ? "Webtermine, Projekte in Umsetzung, Scouting-/Drehtermine sowie Skript- und Schnitt-Aufgaben."
                  : userCategories.includes("FILM" as AgentCategory)
                  ? "Scouting-/Drehtermine sowie Skript- und Schnitt-Aufgaben."
                  : "Anstehende Webtermine und Projekte in Umsetzung."}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {agentAgendaGroups.map((group) => (
                  <div key={group.key}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-900 dark:text-blue-200 mb-2">
                      {group.title}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((entry) => renderAgendaEntry(entry))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}
      </div>

      {/* KPI-Kacheln */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {overviewTiles.map((tile, index) => {
          const gradients = [
            "from-blue-500 to-indigo-600",
            "from-purple-500 to-pink-600",
            "from-green-500 to-emerald-600",
            "from-orange-500 to-red-600",
            "from-cyan-500 to-blue-600"
          ];
          const gradient = gradients[index % gradients.length];

          // Check tile type for visual styling
          const isAllTile = tile.key.endsWith("_ALL"); // Agent's assigned type, showing all projects
          const isInfoTile = tile.key.endsWith("_INFO"); // Other types the agent isn't assigned to

          return (
            <Link
              key={tile.key}
              href={tile.href}
              className={`group rounded-2xl bg-gradient-to-br ${gradient} p-5 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 ${isAllTile || isInfoTile ? 'opacity-75' : ''}`}
            >
              <div className="text-xs uppercase tracking-wide text-white/80 font-semibold">{tile.label}</div>
              <div className="mt-3 text-3xl sm:text-4xl font-bold text-white">{tile.count}</div>
            </Link>
          );
        })}

        <Link
          href="/projects?needsReview=1"
          className={`group rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 ${
            projectsNeedingMaterialReview > 0
              ? "bg-gradient-to-br from-amber-500 to-orange-600"
              : "bg-gradient-to-br from-slate-500 to-gray-600"
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-white/80 font-semibold">Material prüfen</div>
          <div className="mt-3 text-3xl sm:text-4xl font-bold text-white">{projectsNeedingMaterialReview}</div>
          {projectsNeedingMaterialReview > 0 && (
            <div className="mt-2 text-xs text-white/90">Eingereichtes Material prüfen →</div>
          )}
        </Link>
      </section>

      {/* Statusuebersicht */}
      <section className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50">
          <h2 className="font-bold text-lg bg-gradient-to-r from-indigo-700 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Projektstatus</h2>
        </div>
        <div className="space-y-6 p-5">
          {statusSections.map((section) => (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">{section.label}</h3>
                <Link href={withScope(section.href)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">
                  Alle anzeigen →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {section.tiles.map((tile) => (
                  <Link
                    key={`${section.key}-${tile.key}`}
                    href={tile.href}
                    className="group rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 p-3 shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition-all transform hover:-translate-y-0.5"
                  >
                    <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{tile.label}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{tile.count}</div>
                      {tile.staleCount > 0 && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-orange-700 bg-gradient-to-r from-orange-100 to-red-100 rounded-full border-2 border-orange-300">
                          <span title="Projekte, die länger als 4 Wochen in diesem Status sind">⚠️ {tile.staleCount}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Film Scopes - nur für Filmagenten */}
      {isAgentView && allowedProjectTypes.includes("FILM") && Object.keys(filmScopeCounts).length > 0 && (
        <section className="rounded-2xl border border-cyan-100 dark:border-cyan-900/50 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-cyan-100 dark:border-cyan-900/50 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50">
            <h2 className="font-bold text-lg bg-gradient-to-r from-cyan-700 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
              Filmprojekte nach Umfang
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {Object.entries(FILM_SCOPE_LABELS)
                .filter(([scope]) => scope !== "K_A") // Filter out "k.A."
                .map(([scope, label]) => {
                  const count = filmScopeCounts[scope] || 0;
                  return (
                    <Link
                      key={scope}
                      href={withScope(`/film-projects?scope=${scope}`)}
                      className="group rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 p-3 shadow-sm hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-600 transition-all transform hover:-translate-y-0.5"
                    >
                      <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors">
                        {label}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {count}
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
