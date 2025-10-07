// /app/dashboard/page.tsx
import Link from "next/link";
import type { Prisma, ProjectStatus, ProjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildWebsiteStatusWhere, DONE_PRODUCTION_STATUSES } from "@/lib/project-status";

export const metadata = { title: "Dashboard" };


const STATUSES: ProjectStatus[] = ["WEBTERMIN", "MATERIAL", "UMSETZUNG", "DEMO", "ONLINE"];
const STATUS_LABELS: Record<ProjectStatus, string> = {
  WEBTERMIN: "Webtermin",
  MATERIAL: "Material",
  UMSETZUNG: "Umsetzung",
  DEMO: "Demo",
  ONLINE: "Online",
};

const PROJECT_TYPES: Array<{ key: ProjectType; label: string; href: string }> = [
  { key: "WEBSITE", label: "Webseitenprojekte", href: "/projects" },
  { key: "FILM", label: "Filmprojekte", href: "/film-projects" },
  { key: "SOCIAL", label: "Social Media Projekte", href: "/social-projects" },
];

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
type DashboardSearchParams = {
  scope?: string | string[];
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  // Kennzahlen parallel laden (Clients = distinct clientId aus Projekten)

  const now = new Date();

  const params = await searchParams;

  const scopeParam = Array.isArray(params?.scope)
    ? params.scope[0]
    : params?.scope;
  const scope: "all" | "active" = scopeParam === "active" ? "active" : "all";
  const activeEnabled = scope === "active";

  const websiteActiveWhere: Prisma.ProjectWhereInput = {
    type: "WEBSITE",
    website: { is: { pStatus: { notIn: DONE_PRODUCTION_STATUSES } } },
  };

  const nonWebsiteActiveWhere: Prisma.ProjectWhereInput = {
    AND: [{ type: { not: "WEBSITE" } }, { status: { not: "ONLINE" } }],
  };

  const activeProjectWhere: Prisma.ProjectWhereInput | undefined = activeEnabled
    ? { OR: [websiteActiveWhere, nonWebsiteActiveWhere] }
    : undefined;

  const [
    totalProjects,
    websiteCount,
    filmCount,
    socialCount,
    nonWebsiteStatusCountsRaw,
    overdueCandidates,
  ] = await Promise.all([
    prisma.project.count({ where: activeProjectWhere }),
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
        ? { AND: [activeProjectWhere, { type: "SOCIAL" }] }
        : { type: "SOCIAL" },
    }),
    prisma.project.groupBy({
      by: ["type", "status"],
      where: activeEnabled
        ? { AND: [{ type: { not: "WEBSITE" } }, { status: { not: "ONLINE" } }] }
        : { type: { not: "WEBSITE" } },
      _count: { _all: true },
    }),
    prisma.project.findMany({
      where: {
        type: "WEBSITE",
        status: "UMSETZUNG",
        website: {
          is: {
            materialStatus: "VOLLSTAENDIG",
            lastMaterialAt: { not: null },
          },
        },
      },
      select: {
        id: true,
        status: true,
        website: { select: { lastMaterialAt: true, demoDate: true } },
      },
    }),
  ]);

  const activeWebsiteConstraint: Prisma.ProjectWhereInput = {
    type: "WEBSITE",
    website: { is: { pStatus: { notIn: DONE_PRODUCTION_STATUSES } } },
  };

  const websiteStatusCountEntries = await Promise.all(
    STATUSES.map(async (status) => {
      const baseWhere = buildWebsiteStatusWhere(status, now);
      if (!baseWhere) return [status, 0] as const;
      const scopedWhere = activeEnabled ? { AND: [baseWhere, activeWebsiteConstraint] } : baseWhere;
      const count = await prisma.project.count({ where: scopedWhere });
      return [status, count] as const;
    })
  );

  // Film-spezifische Kacheln basierend auf Daten
  const filmActiveWhere = activeEnabled
    ? { film: { isNot: null, is: { status: { not: "BEENDET" } } } }
    : { film: { isNot: null } };

  // Load all film projects and derive their status
  const filmProjects = await prisma.project.findMany({
    where: filmActiveWhere,
    select: {
      film: {
        select: {
          status: true,
          onlineDate: true,
          finalToClient: true,
          shootDate: true,
          scriptApproved: true,
          scriptToClient: true,
          scouting: true,
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
  const deriveFilmStatus = (film: any) => {
    if (!film) return "SCOUTING";
    if (film.status === "BEENDET") return "BEENDET";
    if (film.onlineDate) return "ONLINE";
    if (film.finalToClient) return "FINALVERSION";
    if (isInPast(film.shootDate)) return "SCHNITT";
    if (film.scriptApproved) return "DREH";
    if (film.scriptToClient) return "SKRIPTFREIGABE";
    if (isInPast(film.scouting)) return "SKRIPT";
    return "SCOUTING";
  };

  // Count projects by derived status
  const filmStatusCounts = filmProjects.reduce((acc, project) => {
    const status = deriveFilmStatus(project.film);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filmScoutingCount = filmStatusCounts["SCOUTING"] || 0;
  const filmScriptCount = filmStatusCounts["SKRIPT"] || 0;
  const filmScriptApprovalCount = filmStatusCounts["SKRIPTFREIGABE"] || 0;
  const filmShootCount = filmStatusCounts["DREH"] || 0;
  const filmCutCount = filmStatusCounts["SCHNITT"] || 0;
  const filmPreviewCount = filmStatusCounts["FINALVERSION"] || 0;
  const filmOnlineCount = filmStatusCounts["ONLINE"] || 0;
  const filmBeendetCount = filmStatusCounts["BEENDET"] || 0;

  const typeCountMap = new Map<ProjectType, number>([
    ["WEBSITE", websiteCount],
    ["FILM", filmCount],
    ["SOCIAL", socialCount],
  ]);

  const nonWebsiteStatusMap = new Map<ProjectType, Map<ProjectStatus, number>>();
  for (const entry of nonWebsiteStatusCountsRaw) {
    const type = entry.type as ProjectType;
    const status = entry.status as ProjectStatus;
    if (!nonWebsiteStatusMap.has(type)) nonWebsiteStatusMap.set(type, new Map<ProjectStatus, number>());
    nonWebsiteStatusMap.get(type)!.set(status, entry._count._all);
  }

  const websiteStatusCountMap = new Map<ProjectStatus, number>(websiteStatusCountEntries);

  const scopeLinks = [
    { key: "all", label: "Alle Projekte", href: "/dashboard" },
    { key: "active", label: "Aktive Projekte", href: "/dashboard?scope=active" },
  ] as const;

  const withScope = (href: string) => {
    if (!activeEnabled) return href;
    return `${href}${href.includes("?") ? "&" : "?"}scope=active`;
  };

  const overviewTiles = [
    { key: "ALL", label: activeEnabled ? "Aktive Projekte" : "Projekte gesamt", count: totalProjects, href: withScope("/projects") },
    ...PROJECT_TYPES.map((type) => ({
      key: type.key,
      label: type.label,
      count: typeCountMap.get(type.key) ?? 0,
      href: withScope(type.href),
    })),
  ];

  const overdueProjectsCount = overdueCandidates.reduce((count, project) => {
    if (project.status !== "UMSETZUNG") return count;
    const last = project.website?.lastMaterialAt;
    if (!last) return count;
    const demo = project.website?.demoDate;
    const days = workingDaysSince(last, demo);
    return days !== null && days >= 60 ? count + 1 : count;
  }, 0);
  const statusSections = PROJECT_TYPES.map((type) => {
    if (type.key === "WEBSITE") {
      const tiles = [
        ...STATUSES.map((status) => ({
          key: status,
          label: STATUS_LABELS[status],
          count: websiteStatusCountMap.get(status) ?? 0,
          href: withScope(`${type.href}&status=${status}`),
        })),
        {
          key: "OVERDUE",
          label: "\u00DCberf\u00E4llige Projekte (60+ Tage)",
          count: overdueProjectsCount,
          href: withScope(`${type.href}&overdue=1`),
        },
      ];
      return { ...type, tiles };
    }

    if (type.key === "FILM") {
      const tiles = [
        {
          key: "SCOUTING",
          label: "Scouting",
          count: filmScoutingCount,
          href: withScope("/film-projects?status=SCOUTING"),
        },
        {
          key: "SCRIPT",
          label: "Skript",
          count: filmScriptCount,
          href: withScope("/film-projects?status=SKRIPT"),
        },
        {
          key: "SCRIPT_APPROVAL",
          label: "Skriptfreigabe",
          count: filmScriptApprovalCount,
          href: withScope("/film-projects?status=SKRIPTFREIGABE"),
        },
        {
          key: "SHOOT",
          label: "Dreh",
          count: filmShootCount,
          href: withScope("/film-projects?status=DREH"),
        },
        {
          key: "CUT",
          label: "Schnitt",
          count: filmCutCount,
          href: withScope("/film-projects?status=SCHNITT"),
        },
        {
          key: "PREVIEW",
          label: "Finalversion",
          count: filmPreviewCount,
          href: withScope("/film-projects?status=FINALVERSION"),
        },
        {
          key: "ONLINE",
          label: "Online",
          count: filmOnlineCount,
          href: withScope("/film-projects?status=ONLINE"),
        },
        {
          key: "BEENDET",
          label: "Beendet",
          count: filmBeendetCount,
          href: withScope("/film-projects?status=BEENDET"),
        },
      ];
      return { ...type, tiles };
    }

    const statusMap = nonWebsiteStatusMap.get(type.key) ?? new Map<ProjectStatus, number>();
    const tiles = STATUSES.map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      count: statusMap.get(status) ?? 0,
      href: withScope(`${type.href}&status=${status}`),
    }));
    return { ...type, tiles };
  });

  // Zuletzt aktualisierte Projekte
  const recentProjects = await prisma.project.findMany({
    where: activeEnabled ? activeProjectWhere : undefined,
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      client: { select: { name: true, customerNo: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          text: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  // Helper fuer Aktivitaetslabel
  function activityInfo(p: (typeof recentProjects)[number]) {
    const lastNote = p.notes[0];
    if (lastNote) {
      // Heuristik: wenn updatedAt ~ letzte Notiz (+/-2 Minuten)
      const diff = Math.abs(new Date(p.updatedAt).getTime() - new Date(lastNote.createdAt).getTime());
      if (diff <= 2 * 60 * 1000) {
        return {
          label: "Notiz hinzugefuegt",
          detail:
            (lastNote.author?.name ? `${lastNote.author.name}: ` : "") +
            (lastNote.text.length > 80 ? `${lastNote.text.slice(0, 80)}...` : lastNote.text),
        };
      }
    }
    return { label: "Projekt aktualisiert", detail: `Status: ${p.status}` };
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          {scopeLinks.map((link) => {
            const active = link.key === scope;
            return (
              <Link
                key={link.key}
                href={link.href}
                className={
                  active
                    ? "px-3 py-1.5 rounded bg-black text-white"
                    : "px-3 py-1.5 rounded border text-gray-700 hover:bg-gray-50"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* KPI-Kacheln */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {overviewTiles.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm transition hover:border-black"
          >
            <div className="text-xs uppercase tracking-wide text-gray-500">{tile.label}</div>
            <div className="mt-2 text-2xl font-semibold sm:text-3xl">{tile.count}</div>
          </Link>
        ))}

        <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Letztes Projekt-Update</div>
          <div className="mt-2 text-sm font-medium sm:text-lg">
            {formatDate(recentProjects[0]?.updatedAt)}
          </div>
        </div>
      </section>

      {/* Statusuebersicht */}
      <section className="rounded-2xl border">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium">Projektstatus</h2>
        </div>
        <div className="space-y-6 p-4">
          {statusSections.map((section) => (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{section.label}</h3>
                <Link href={withScope(section.href)} className="text-xs text-blue-600 underline">
                  Alle anzeigen
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {section.tiles.map((tile) => (
                  <Link
                    key={`${section.key}-${tile.key}`}
                    href={tile.href}
                    className="rounded-xl border bg-white p-3 shadow-sm transition hover:border-black"
                  >
                    <div className="text-xs uppercase tracking-wide text-gray-500">{tile.label}</div>
                    <div className="mt-1 text-2xl font-semibold">{tile.count}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Zuletzt aktualisierte Projekte */}
      <section className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium">Zuletzt aktualisierte Projekte</h2>
        </div>
        <div className="divide-y">
          {recentProjects.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Noch keine Projekte vorhanden.</div>
          ) : (
            recentProjects.map((p) => {
              const { label, detail } = activityInfo(p);
              const customerLabel = [p.client?.customerNo, p.client?.name].filter(Boolean).join(" - ");
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
                      <div className="font-semibold truncate">{customerLabel || "Kunde unbekannt"}</div>
                      <div className="font-medium text-sm text-gray-600 truncate">{p.title ?? `Projekt #${p.id}`}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {label} - {detail} - aktualisiert: {formatDate(p.updatedAt)} - erstellt: {formatDate(p.createdAt)}
                    </div>
                  </div>
                  <span className="text-sm text-blue-600 shrink-0">Details</span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}








