import type { FilmPriority, FilmProjectStatus, FilmScope, Prisma } from "@prisma/client";
import type { CSSProperties, SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import FilmInlineCell from "@/components/FilmInlineCell";
import FilmPreviewCell from "@/components/FilmPreviewCell";
import DangerActionButton from "@/components/DangerActionButton";
import CheckboxFilterGroup from "@/components/CheckboxFilterGroup";
import { SaveFilterButton } from "@/components/SaveFilterButton";
import { deleteFilmProject, deleteAllFilmProjects } from "./actions";
import { deriveFilmStatus, getFilmStatusDate, FILM_STATUS_LABELS, type FilmStatus } from "@/lib/film-status";

type Search = {
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  agent?: string[];
  cutter?: string[];
  status?: string[];
  pstatus?: string[];
  scope?: string[];
  page?: string;
  ps?: string;
};

const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M6 7v8m4-8v8m4-8v8M4 5h12m-1 0-.867 10.404A2 2 0 0 1 12.142 17H7.858a2 2 0 0 1-1.991-1.596L5 5m3-2h4a1 1 0 0 1 1 1v1H7V4a1 1 0 0 1 1-1z"
    />
  </svg>
);

const SCOPE_LABELS: Record<FilmScope, string> = {
  FILM: "Film",
  DROHNE: "Drohne",
  NACHDREH: "Nachdreh",
  FILM_UND_DROHNE: "F + D",
  FOTO: "Foto",
  GRAD_360: "360°",
  K_A: "k.A.",
};

const PRIORITY_LABELS: Record<FilmPriority, string> = {
  NONE: "-",
  FILM_SOLO: "Film solo",
  PRIO_1: "Prio 1",
  PRIO_2: "Prio 2",
};

const P_STATUS_LABELS: Record<FilmProjectStatus, string> = {
  AKTIV: "aktiv",
  BEENDET: "beendet",
  WARTEN: "warten",
  VERZICHT: "verzicht",
  MMW: "MMW",
};

// FilmStatus types and labels are now imported from lib/film-status.ts

const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;
const AGENT_BADGE_BASE_CLASS = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";
const AGENT_BADGE_EMPTY_CLASS = `${AGENT_BADGE_BASE_CLASS} border-gray-200 bg-gray-100 text-gray-800`;

const agentBadgeStyle = (color?: string | null): CSSProperties | undefined => {
  if (!color || !HEX_COLOR_REGEX.test(color)) return undefined;
  const hex = color.toUpperCase();
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.6 ? "#111827" : "#FFFFFF";
  return { backgroundColor: hex, color: textColor, borderColor: hex };
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    const date = new Date(value);
    // Use UTC to avoid timezone issues - dates without time should be displayed as-is
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeZone: "UTC"
    }).format(date);
  } catch {
    return "-";
  }
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    // Use Europe/Berlin timezone for datetime values
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Berlin"
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

const isInPast = (value?: Date | string | null) => {
  if (!value) return false;
  try {
    const date = new Date(value);
    return date.getTime() < Date.now();
  } catch {
    return false;
  }
};

// deriveFilmStatus is now imported from lib/film-status.ts
// But we need a local wrapper that handles firstCutToClient for backwards compatibility
const deriveFilmStatusLocal = (film: {
  status?: FilmProjectStatus | null;
  onlineDate?: Date | string | null;
  finalToClient?: Date | string | null;
  firstCutToClient?: Date | string | null;
  shootDate?: Date | string | null;
  scriptApproved?: Date | string | null;
  scriptToClient?: Date | string | null;
  scouting?: Date | string | null;
  previewVersions?: Array<{ sentDate: Date | string }>;
}): FilmStatus => {
  // Use preview versions if available, otherwise use the central logic
  return deriveFilmStatus(film);
};

const labelForScope = (value?: FilmScope | null) => {
  if (!value) return "-";
  return SCOPE_LABELS[value] ?? value;
};

const labelForPriority = (value?: FilmPriority | null) => {
  if (!value) return "-";
  return PRIORITY_LABELS[value] ?? value;
};

const labelForPStatus = (value?: FilmProjectStatus | null) => {
  if (!value) return "-";
  return P_STATUS_LABELS[value] ?? value;
};

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isOlderThan4Weeks = (value: Date | null | undefined) => {
  if (!value) return false;
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  return value.getTime() < fourWeeksAgo.getTime();
};

const relevantDateForStatus = (
  film: NonNullable<Awaited<ReturnType<typeof loadFilmProjects>>[number]["film"]>,
  status: FilmStatus,
  previewDate?: Date | null,
) => {
  switch (status) {
    case "SCOUTING":
      return toDate(film.scouting) ?? toDate(film.contractStart);
    case "SKRIPT":
      return toDate(film.scouting);
    case "SKRIPTFREIGABE":
      return toDate(film.scriptToClient);
    case "DREH":
      return toDate(film.scriptApproved);
    case "SCHNITT":
      return toDate(film.shootDate);
    case "VORABVERSION":
      return toDate(previewDate);
    case "FINALVERSION":
      return toDate(film.finalToClient);
    case "ONLINE":
      return toDate(film.onlineDate);
    case "BEENDET":
      return toDate(film.onlineDate) ?? toDate(film.lastContact);
    default:
      return null;
  }
};

const SCOPE_OPTIONS = (Object.keys(SCOPE_LABELS) as FilmScope[])
  .filter((value) => value !== "K_A")
  .map((value) => ({
    value,
    label: SCOPE_LABELS[value],
  }));

const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as FilmPriority[]).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

const P_STATUS_OPTIONS = (Object.keys(P_STATUS_LABELS) as FilmProjectStatus[]).map((value) => ({
  value,
  label: P_STATUS_LABELS[value],
}));

type FilmProjectRow = {
  id: string;
  customerNo: string;
  clientName: string;
  scope: string;
  priority: string;
  filmer: string;
  cutter: string;
  contractStart: string;
  scouting: string;
  scriptToClient: string;
  scriptApproved: string;
  shootDate: string;
  firstCutToClient: string;
  finalToClient: string;
  finalLinkLabel: string;
  finalLinkHref: string;
  onlineDate: string;
  primaryLinkHref: string;
  primaryLinkLabel: string;
  lastContact: string;
  filmStatus: string;
  filmStatusKey: FilmStatus;
  pStatus: string;
  reminderAt: string;
  note: string;
  isStale: boolean;
};

const mkLinkInfo = (value?: string | null, label?: string) => {
  if (!value) return { label: "", href: "" };
  const trimmed = value.trim();
  if (!trimmed) return { label: "", href: "" };
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return { label: label ?? trimmed.replace(/^https?:\/\//i, "").trim(), href };
};

const buildRows = (projects: Awaited<ReturnType<typeof loadFilmProjects>>): FilmProjectRow[] => {
  return projects.map((project) => {
    const film = project.film;
    const filmerName = film?.filmer?.name?.trim();
    const cutterName = film?.cutter?.name?.trim();
    const noteText = film?.note?.trim() ?? project.important?.trim();

    // Get latest preview version or fall back to firstCutToClient
    const latestPreview = film?.previewVersions?.[0];
    const previewDate = latestPreview?.sentDate ?? film?.firstCutToClient;
    const previewDisplay = latestPreview
      ? `${formatDate(latestPreview.sentDate)} (v${latestPreview.version})`
      : formatDate(film?.firstCutToClient ?? undefined);

    const derivedStatus: FilmStatus = film ? deriveFilmStatusLocal({
      status: film.status,
      onlineDate: film.onlineDate,
      finalToClient: film.finalToClient,
      firstCutToClient: previewDate,
      shootDate: film.shootDate,
      scriptApproved: film.scriptApproved,
      scriptToClient: film.scriptToClient,
      scouting: film.scouting,
      previewVersions: film.previewVersions,
    }) : "SCOUTING";

    const statusDate =
      film ? relevantDateForStatus(film, derivedStatus, toDate(previewDate)) : null;
    const lastContactDate = toDate(film?.lastContact);
    const effectiveDate =
      lastContactDate && (!statusDate || lastContactDate > statusDate)
        ? lastContactDate
        : statusDate;
    const isActiveFilm = !film?.status || film.status === "AKTIV";
    const isStale = isActiveFilm && isOlderThan4Weeks(effectiveDate);

    const finalLinkInfo = mkLinkInfo(film?.finalLink, film?.finalLink ? "🎬" : undefined);
    const onlineLinkSource = film?.onlineLink || (film?.onlineDate ? film?.finalLink : null);
    const onlineLinkInfo = mkLinkInfo(onlineLinkSource, onlineLinkSource ? "🎬" : undefined);

    return {
      id: project.id,
      customerNo: project.client?.customerNo?.trim() || "-",
      clientName: project.client?.name?.trim() || "Kunde unbekannt",
      scope: labelForScope(film?.scope ?? undefined),
      priority: labelForPriority(film?.priority ?? undefined),
      filmer: filmerName && filmerName.length > 0 ? filmerName : "-",
      cutter: cutterName && cutterName.length > 0 ? cutterName : "-",
      contractStart: formatDate(film?.contractStart ?? undefined),
      scouting: formatDateTime(film?.scouting ?? undefined),
      scriptToClient: formatDate(film?.scriptToClient ?? undefined),
      scriptApproved: formatDate(film?.scriptApproved ?? undefined),
      shootDate: formatDateTime(film?.shootDate ?? undefined),
      firstCutToClient: previewDisplay,
      finalToClient: formatDate(film?.finalToClient ?? undefined),
      finalLinkLabel: finalLinkInfo.label,
      finalLinkHref: finalLinkInfo.href,
      onlineDate: formatDate(film?.onlineDate ?? undefined),
      primaryLinkLabel: onlineLinkInfo.label,
      primaryLinkHref: onlineLinkInfo.href,
      lastContact: formatDate(film?.lastContact ?? undefined),
      filmStatus: FILM_STATUS_LABELS[derivedStatus],
      filmStatusKey: derivedStatus,
      pStatus: labelForPStatus(film?.status ?? undefined),
      reminderAt: formatDate(film?.reminderAt ?? undefined),
      note: noteText && noteText.length > 0 ? noteText : "-",
      isStale,
    };
  });
};

async function loadFilmProjects(
  searchQuery?: string,
  agents?: string[],
  cutters?: string[],
  filmStatuses?: string[],
  pStatuses?: string[],
  scopes?: string[],
  orderBy?: Prisma.ProjectOrderByWithRelationInput[]
) {
  const whereConditions: Prisma.ProjectWhereInput[] = [
    {
      film: {
        isNot: null
      }
    }
  ];

  if (searchQuery) {
    whereConditions.push({
      client: {
        OR: [
          { customerNo: { contains: searchQuery, mode: "insensitive" } },
          { name: { contains: searchQuery, mode: "insensitive" } },
        ],
      }
    });
  }

  if (agents && agents.length > 0) {
    const hasNone = agents.includes("none");
    const ids = agents.filter((a) => a !== "none");
    const orParts: Prisma.ProjectWhereInput[] = [];
    if (ids.length > 0) orParts.push({ film: { is: { filmerId: { in: ids } } } });
    if (hasNone) orParts.push({ film: { is: { filmerId: null } } });
    if (orParts.length > 0) {
      whereConditions.push({ OR: orParts });
    }
  }

  if (cutters && cutters.length > 0) {
    const hasNone = cutters.includes("none");
    const ids = cutters.filter((c) => c !== "none");
    const orParts: Prisma.ProjectWhereInput[] = [];
    if (ids.length > 0) orParts.push({ film: { is: { cutterId: { in: ids } } } });
    if (hasNone) orParts.push({ film: { is: { cutterId: null } } });
    if (orParts.length > 0) {
      whereConditions.push({ OR: orParts });
    }
  }

  if (pStatuses && pStatuses.length > 0) {
    whereConditions.push({
      film: {
        is: {
          status: { in: pStatuses as FilmProjectStatus[] }
        }
      }
    });
  }

  if (scopes && scopes.length > 0) {
    whereConditions.push({
      film: {
        is: {
          scope: { in: scopes as FilmScope[] }
        }
      }
    });
  }

  const where: Prisma.ProjectWhereInput = whereConditions.length === 1
    ? whereConditions[0]
    : { AND: whereConditions };

  // Load all projects first (without film status filter)
  let projects = await prisma.project.findMany({
    where,
    orderBy: orderBy ?? [{ client: { name: "asc" } }, { title: "asc" }],
    include: {
      client: { select: { id: true, name: true, customerNo: true, workStopped: true, finished: true } },
      film: {
        include: {
          filmer: { select: { id: true, name: true, color: true } },
          cutter: { select: { id: true, name: true, color: true } },
          previewVersions: {
            orderBy: { sentDate: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  // Filter by derived film status if requested
  if (filmStatuses && filmStatuses.length > 0) {
    projects = projects.filter((project) => {
      const latestPreview = project.film?.previewVersions?.[0];
      const previewDate = latestPreview?.sentDate ?? project.film?.firstCutToClient;

      const derivedStatus = deriveFilmStatusLocal({
        status: project.film?.status,
        onlineDate: project.film?.onlineDate,
        finalToClient: project.film?.finalToClient,
        firstCutToClient: previewDate,
        shootDate: project.film?.shootDate,
        scriptApproved: project.film?.scriptApproved,
        scriptToClient: project.film?.scriptToClient,
        scouting: project.film?.scouting,
        previewVersions: project.film?.previewVersions,
      });
      return filmStatuses.includes(derivedStatus);
    });
  }

  return projects;
}

function str(v: string | string[] | undefined) { return typeof v === "string" ? v : undefined; }
function arr(v: string | string[] | undefined): string[] { return Array.isArray(v) ? v : (typeof v === "string" && v !== "" ? [v] : []); }

function mapOrderBy(sort: string, dir: "asc" | "desc"): Prisma.ProjectOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = dir === "desc" ? "desc" : "asc";
  const def: Prisma.ProjectOrderByWithRelationInput[] = [
    { client: { customerNo: "asc" } },
    { client: { name: "asc" } },
  ];
  switch (sort) {
    case "standard":
      return [
        { film: { onlineDate: direction } },
        { film: { finalToClient: direction } },
        { film: { firstCutToClient: direction } },
        { film: { shootDate: direction } },
        { film: { scriptApproved: direction } },
        { film: { scriptToClient: direction } },
        { film: { scouting: direction } },
        { film: { contractStart: direction } },
      ];
    case "customerNo": return [{ client: { customerNo: direction } }, { client: { name: "asc" } }];
    case "clientName": return [{ client: { name: direction } }];
    case "scope": return [{ film: { scope: direction } }];
    case "priority": return [{ film: { priority: direction } }];
    case "filmer": return [{ film: { filmer: { name: direction } } }];
    case "cutter": return [{ film: { cutter: { name: direction } } }];
    case "status": return [{ film: { status: direction } }];
    case "contractStart": return [{ film: { contractStart: direction } }];
    case "scouting": return [{ film: { scouting: direction } }];
    case "scriptToClient": return [{ film: { scriptToClient: direction } }];
    case "scriptApproved": return [{ film: { scriptApproved: direction } }];
    case "shootDate": return [{ film: { shootDate: direction } }];
    case "firstCutToClient": return [{ film: { firstCutToClient: direction } }];
    case "finalToClient": return [{ film: { finalToClient: direction } }];
    case "onlineDate": return [{ film: { onlineDate: direction } }];
    case "lastContact": return [{ film: { lastContact: direction } }];
    case "reminderAt": return [{ film: { reminderAt: direction } }];
    default: return def;
  }
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FilmProjectsPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session || !session.user.id) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/");
  }

  const spRaw = await searchParams;

  // Check if user explicitly wants to reset all filters
  const resetFilters = str(spRaw.reset) === "1";

  // If reset is requested, clear saved filter preferences in database
  if (resetFilters) {
    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        filmProjectsAgentFilter: [],
        filmProjectsStatusFilter: [],
        filmProjectsPStatusFilter: [],
        filmProjectsScopeFilter: [],
      },
      create: {
        userId: session.user.id,
        filmProjectsAgentFilter: [],
        filmProjectsStatusFilter: [],
        filmProjectsPStatusFilter: [],
        filmProjectsScopeFilter: [],
      },
    });
  }

  // Load user preferences for default filters (AFTER potentially resetting them)
  const userPreferences = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
  });

  // Parse saved filters from JSON
  const savedAgentFilter = userPreferences?.filmProjectsAgentFilter
    ? (Array.isArray(userPreferences.filmProjectsAgentFilter) ? userPreferences.filmProjectsAgentFilter as string[] : [])
    : undefined;
  const savedStatusFilter = userPreferences?.filmProjectsStatusFilter
    ? (Array.isArray(userPreferences.filmProjectsStatusFilter) ? userPreferences.filmProjectsStatusFilter as string[] : [])
    : undefined;
  const savedPStatusFilter = userPreferences?.filmProjectsPStatusFilter
    ? (Array.isArray(userPreferences.filmProjectsPStatusFilter) ? userPreferences.filmProjectsPStatusFilter as string[] : [])
    : undefined;
  const savedScopeFilter = userPreferences?.filmProjectsScopeFilter
    ? (Array.isArray(userPreferences.filmProjectsScopeFilter) ? userPreferences.filmProjectsScopeFilter as string[] : [])
    : undefined;

  // Check if form was submitted (this hidden field is present when user clicks Apply button)
  const formSubmitted = str(spRaw.submitted) === "1";

  // Parse URL parameters
  const agentParam = arr(spRaw.agent);
  const statusParam = arr(spRaw.status);
  const pstatusParam = arr(spRaw.pstatus);
  const scopeParam = arr(spRaw.scope);
  const cutterParam = arr(spRaw.cutter);
  const qParam = str(spRaw.q);

  // Only use saved filters if:
  // 1. Form was NOT submitted (user didn't click Apply button)
  // 2. User didn't click reset
  // 3. No other parameters present
  const hasAnyParams =
    agentParam.length > 0 ||
    statusParam.length > 0 ||
    pstatusParam.length > 0 ||
    scopeParam.length > 0 ||
    cutterParam.length > 0 ||
    qParam;

  const useSavedFilters = !formSubmitted && !resetFilters && !hasAnyParams;

  // When reset is triggered, ensure filters are cleared by using empty arrays
  // When form is submitted without params, also use empty arrays (not saved filters)
  let sp: Search = {
    sort: str(spRaw.sort) ?? "standard",
    dir: (str(spRaw.dir) as "asc" | "desc") ?? "desc",
    q: resetFilters ? "" : (qParam ?? ""),
    agent: resetFilters ? [] : (useSavedFilters ? savedAgentFilter : agentParam),
    cutter: resetFilters ? [] : cutterParam,
    status: resetFilters ? [] : (useSavedFilters ? savedStatusFilter : statusParam),
    pstatus: resetFilters ? [] : (useSavedFilters ? savedPStatusFilter : pstatusParam),
    scope: resetFilters ? [] : (useSavedFilters ? savedScopeFilter : scopeParam),
    page: str(spRaw.page) ?? "1",
    ps: str(spRaw.ps) ?? "50",
  };

  const standardSortTriggered = str(spRaw.standardSort);
  if (standardSortTriggered) {
    const nextDir: "asc" | "desc" = sp.sort === "standard" && sp.dir === "desc" ? "asc" : "desc";
    sp = {
      ...sp,
      sort: "standard",
      dir: nextDir,
    };
  }

  const role = session.user.role!;
  const orderBy = mapOrderBy(sp.sort!, sp.dir!);

  // Load all matching film projects (with status filter applied)
  const [loadedProjects, allAgents] = await Promise.all([
    loadFilmProjects(sp.q, sp.agent, sp.cutter, sp.status, sp.pstatus, sp.scope, orderBy),
    prisma.user.findMany({
      where: { role: "AGENT", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, categories: true }
    }),
  ]);

  // Apply in-memory sorting for "standard" sort to account for preview versions
  let allFilmProjects = loadedProjects;
  if (sp.sort === "standard") {
    const direction = sp.dir === "desc" ? -1 : 1;

    allFilmProjects = [...loadedProjects].sort((a, b) => {
      // Define priority levels (higher = comes first when desc)
      const getPriorityAndDate = (project: typeof a): [number, Date | null] => {
        const film = project.film;
        if (!film) return [0, null];

        const latestPreview = film.previewVersions?.[0];
        const previewDate = latestPreview?.sentDate ?? film.firstCutToClient;

        // Priority levels: 7=Online, 6=Final, 5=Vorabversion, 4=Dreh, 3=Skript-Freigabe, 2=Skript, 1=Scouting, 0=Vertrag
        if (film.onlineDate) return [7, new Date(film.onlineDate)];
        if (film.finalToClient) return [6, new Date(film.finalToClient)];
        if (previewDate) return [5, new Date(previewDate)];
        if (film.shootDate) return [4, new Date(film.shootDate)];
        if (film.scriptApproved) return [3, new Date(film.scriptApproved)];
        if (film.scriptToClient) return [2, new Date(film.scriptToClient)];
        if (film.scouting) return [1, new Date(film.scouting)];
        if (film.contractStart) return [0, new Date(film.contractStart)];

        return [-1, null]; // No dates at all
      };

      const [priorityA, dateA] = getPriorityAndDate(a);
      const [priorityB, dateB] = getPriorityAndDate(b);

      // First, sort by priority level
      if (priorityA !== priorityB) {
        return (priorityB - priorityA) * direction;
      }

      // Same priority level, sort by date
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const timeA = dateA.getTime();
      const timeB = dateB.getTime();

      return (timeB - timeA) * direction;
    });
  }

  // Pagination
  const pageSize = sp.ps === "100" ? 100 : 50;
  const page = Math.max(1, Number.parseInt(sp.page || "1") || 1);
  const total = allFilmProjects.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const skip = (page - 1) * pageSize;
  const filmProjects = allFilmProjects.slice(skip, skip + pageSize);
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(total, skip + filmProjects.length);

  // Nur Agenten mit Film-Kategorie anzeigen
  const agents = allAgents.filter(a => a.categories.includes("FILM"));

  const agentOptions = [
    { value: "", label: "- nicht vergeben -" },
    ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];

  const rows = buildRows(filmProjects);
  const canEdit = ["ADMIN", "AGENT"].includes(session.user.role || "");
  const canDelete = session.user.role === "ADMIN";
  const mkSort = (key: string) => makeSortHref({ current: sp, key });
  const mkPageHref = (p: number) => makePageHref({ current: sp, page: p });
  const mkPageSizeHref = (s: number) => makePageSizeHref({ current: sp, size: s });

  const FILM_STATUSES: FilmStatus[] = ["SCOUTING", "SKRIPT", "SKRIPTFREIGABE", "DREH", "SCHNITT", "VORABVERSION", "FINALVERSION", "ONLINE", "BEENDET"];

  const renderPagination = (extraClass?: string) => {
    const className = ["flex flex-wrap items-center gap-3 text-sm text-gray-600", extraClass].filter(Boolean).join(" ");
    return (
      <div className={className}>
        <div>Zeige {from} - {to} von {total}</div>
        <div className="flex items-center gap-2">
          <Link href={mkPageSizeHref(50)} className={sp.ps !== "100" ? "font-semibold underline" : "underline"}>50/Seite</Link>
          <Link href={mkPageSizeHref(100)} className={sp.ps === "100" ? "font-semibold underline" : "underline"}>100/Seite</Link>
          <span className="mx-2">|</span>
          <Link href={mkPageHref(Math.max(1, page - 1))} className={page === 1 ? "pointer-events-none opacity-50" : "underline"}>Zurück</Link>
          <span>Seite {page} / {totalPages}</span>
          <Link href={mkPageHref(Math.min(totalPages, page + 1))} className={page >= totalPages ? "pointer-events-none opacity-50" : "underline"}>Weiter</Link>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Modern Header */}
      <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Filmprojekte</h1>
            <p className="text-green-100 text-sm mt-1">{total} {total === 1 ? 'Projekt' : 'Projekte'} gesamt</p>
          </div>
          {session.user.role === "ADMIN" && (
            <DangerActionButton action={deleteAllFilmProjects} confirmText="Wirklich ALLE Filmprojekte dauerhaft löschen?">
              ALLE Projekte löschen
            </DangerActionButton>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-green-200 bg-white shadow-sm">
        <div className="px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200 rounded-t-2xl flex items-center gap-3">
          <h2 className="text-sm font-semibold text-green-900">Filter & Suche</h2>
          <div className="flex gap-2">
            <form method="get" className="contents">
              <input type="hidden" name="sort" value="standard" />
              <input type="hidden" name="dir" value={sp.sort === "standard" && sp.dir === "desc" ? "asc" : "desc"} />
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              {sp.agent?.map(v => <input key={v} type="hidden" name="agent" value={v} />)}
              {sp.status?.map(v => <input key={v} type="hidden" name="status" value={v} />)}
              {sp.pstatus?.map(v => <input key={v} type="hidden" name="pstatus" value={v} />)}
              {sp.scope?.map(v => <input key={v} type="hidden" name="scope" value={v} />)}
              {sp.ps && <input type="hidden" name="ps" value={sp.ps} />}
              {sp.page && <input type="hidden" name="page" value={sp.page} />}
              <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 bg-white text-green-700 hover:bg-green-50 transition-colors">Standardsortierung</button>
            </form>
          </div>
        </div>
        <div className="p-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="sort" value={sp.sort} />
            <input type="hidden" name="submitted" value="1" />

            <div className="flex flex-col gap-1 w-48">
              <label className="text-xs uppercase tracking-wide text-gray-500">Kunde suchen</label>
              <input
                name="q"
                defaultValue={sp.q}
                placeholder="Kundennr. oder Name"
                className="rounded border px-2 py-1 text-xs"
              />
            </div>

            <CheckboxFilterGroup
              name="agent"
              label="Agent (Filmer)"
              options={[
                { value: "none", label: "Ohne Agent" },
                ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
              ]}
              selected={sp.agent ?? []}
              width="w-48"
            />

            <CheckboxFilterGroup
              name="status"
              label="Status"
              options={FILM_STATUSES.map((s) => ({ value: s, label: FILM_STATUS_LABELS[s] }))}
              selected={sp.status ?? []}
              width="w-44"
            />

            <CheckboxFilterGroup
              name="pstatus"
              label="P-Status"
              options={P_STATUS_OPTIONS}
              selected={sp.pstatus ?? []}
              width="w-44"
            />

            <CheckboxFilterGroup
              name="scope"
              label="Umfang"
              options={SCOPE_OPTIONS}
              selected={sp.scope ?? []}
              width="w-44"
            />

            <div className="flex flex-col gap-1 w-36 shrink-0">
              <label className="text-xs uppercase tracking-wide text-gray-500">Reihenfolge</label>
              <select name="dir" defaultValue={sp.dir} className="px-2 py-1 text-xs border rounded">
                <option value="asc">aufsteigend</option>
                <option value="desc">absteigend</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-colors shadow-sm">Anwenden</button>
              <SaveFilterButton
                currentAgent={sp.agent}
                currentStatus={sp.status}
                currentPStatus={sp.pstatus}
                currentScope={sp.scope}
              />
              <Link href="/film-projects?reset=1" className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">Zurücksetzen</Link>
            </div>
          </form>
        </div>
      </div>

      {renderPagination("mt-4")}

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-700">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <Th>Status</Th>
                <Th href={mkSort("customerNo")} active={sp.sort==="customerNo"} dir={sp.dir}>Kd.-Nr.</Th>
                <Th href={mkSort("clientName")} active={sp.sort==="clientName"} dir={sp.dir}>Name / Firma</Th>
                <Th href={mkSort("scope")} active={sp.sort==="scope"} dir={sp.dir}>Umfang</Th>
                <Th href={mkSort("priority")} active={sp.sort==="priority"} dir={sp.dir}>Prio / Nur Film</Th>
                <Th href={mkSort("filmer")} active={sp.sort==="filmer"} dir={sp.dir}>Verantwortl. Filmer</Th>
                <Th href={mkSort("scouting")} active={sp.sort==="scouting"} dir={sp.dir}>Scouting</Th>
                <Th href={mkSort("scriptToClient")} active={sp.sort==="scriptToClient"} dir={sp.dir}>Skript an Kunden</Th>
                <Th href={mkSort("scriptApproved")} active={sp.sort==="scriptApproved"} dir={sp.dir}>Skriptfreigabe</Th>
                <Th href={mkSort("shootDate")} active={sp.sort==="shootDate"} dir={sp.dir}>Dreh- / Fototermin</Th>
                <Th href={mkSort("firstCutToClient")} active={sp.sort==="firstCutToClient"} dir={sp.dir}>Vorabversion an Kunden</Th>
                <Th href={mkSort("finalToClient")} active={sp.sort==="finalToClient"} dir={sp.dir}>Finalversion an Kunden</Th>
                <Th href={mkSort("onlineDate")} active={sp.sort==="onlineDate"} dir={sp.dir}>Online</Th>
                <Th href={mkSort("lastContact")} active={sp.sort==="lastContact"} dir={sp.dir}>Letzter Kontakt</Th>
                <Th href={mkSort("status")} active={sp.sort==="status"} dir={sp.dir}>P-Status</Th>
                <Th href={mkSort("reminderAt")} active={sp.sort==="reminderAt"} dir={sp.dir}>Wiedervorlage am</Th>
                <Th>Hinweis</Th>
                <Th>Details</Th>
                {canDelete && <Th>Löschen</Th>}
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2 align-top">
              {filmProjects.map((project) => {
                const film = project.film;
                const row = rows.find((r) => r.id === project.id)!;

                const hasFilmer = Boolean(film?.filmer);
                const filmerBadgeClass = hasFilmer ? (film?.filmer?.color ? AGENT_BADGE_BASE_CLASS : AGENT_BADGE_EMPTY_CLASS) : undefined;
                const filmerBadgeStyle = hasFilmer ? agentBadgeStyle(film?.filmer?.color) : undefined;

                const hasCutter = Boolean(film?.cutter);
                const cutterBadgeClass = hasCutter ? (film?.cutter?.color ? AGENT_BADGE_BASE_CLASS : AGENT_BADGE_EMPTY_CLASS) : undefined;
                const cutterBadgeStyle = hasCutter ? agentBadgeStyle(film?.cutter?.color) : undefined;

                const isNotActive = film?.status && film.status !== "AKTIV" && film.status !== "BEENDET";
                const isBeendet = film?.status === "BEENDET";

                // Status badge colors based on P-Status
                const pStatus = film?.status;
                let statusBadgeClasses = "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs";
                if (pStatus === "MMW") {
                  statusBadgeClasses += " bg-red-200 text-red-900";
                } else if (pStatus === "VERZICHT" || pStatus === "WARTEN") {
                  statusBadgeClasses += " bg-orange-200 text-orange-900";
                } else if (pStatus === "BEENDET") {
                  statusBadgeClasses += " bg-gray-400 text-gray-900";
                } else {
                  statusBadgeClasses += " bg-gray-100 text-gray-900";
                }

                const rowClasses = ["border-t", "border-gray-200", "transition-colors", "hover:bg-gray-50"];
                if (row.isStale) rowClasses.push("bg-red-50", "hover:bg-red-100/50");
                if (isBeendet) rowClasses.push("opacity-60");

                return (
                  <tr key={project.id} className={rowClasses.join(" ")}>
                    <td className="font-semibold">
                      <span className={statusBadgeClasses}>
                        {row.primaryLinkHref && (
                          <a
                            href={row.primaryLinkHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-50 text-xs hover:bg-blue-100"
                            title="Zum Film"
                          >
                            {row.primaryLinkLabel || "🎬"}
                          </a>
                        )}
                        {row.filmStatus}
                        {isNotActive && (
                          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-yellow-800 bg-yellow-200 rounded-full cursor-help" title="Achtung, Projektstatus beachten">
                            !
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-gray-600">
                      <div className="flex flex-col gap-1">
                        {row.customerNo !== "-" ? (
                          <Link href={`/clients/${project.client?.id}`} className="underline text-blue-600 hover:text-blue-800">
                            {row.customerNo}
                          </Link>
                        ) : (
                          <span>-</span>
                        )}
                        {project.client?.workStopped && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                            ARBEITSSTOPP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-medium text-gray-900">{row.clientName}</td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="scope"
                        type="select"
                        display={row.scope}
                        value={film?.scope ?? "FILM"}
                        options={SCOPE_OPTIONS}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="priority"
                        type="select"
                        display={row.priority}
                        value={film?.priority ?? "NONE"}
                        options={PRIORITY_OPTIONS}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="filmerId"
                        type="select"
                        display={row.filmer}
                        value={film?.filmerId ?? ""}
                        options={agentOptions}
                        canEdit={canEdit}
                        displayClassName={filmerBadgeClass}
                        displayStyle={filmerBadgeStyle}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="scouting"
                        type="datetime"
                        display={row.scouting}
                        value={film?.scouting?.toISOString() ?? null}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="scriptToClient"
                        type="date"
                        display={row.scriptToClient}
                        value={film?.scriptToClient?.toISOString() ?? null}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="scriptApproved"
                        type="date"
                        display={row.scriptApproved}
                        value={film?.scriptApproved?.toISOString() ?? null}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="shootDate"
                        type="datetime"
                        display={row.shootDate}
                        value={film?.shootDate?.toISOString() ?? null}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmPreviewCell
                        projectId={project.id}
                        display={row.firstCutToClient}
                        currentVersion={film?.previewVersions?.[0]?.version ?? null}
                        currentLink={film?.previewVersions?.[0]?.link ?? null}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="finalToClient"
                        type="date"
                        display={row.finalToClient}
                        value={film?.finalToClient?.toISOString() ?? null}
                        secondaryDisplay={row.finalLinkLabel}
                        secondaryHref={row.finalLinkHref}
                        extraField={{
                          name: "finalLink",
                          type: "url",
                          value: film?.finalLink ?? "",
                          label: "Finalversion-Link",
                          placeholder: "https://domain.tld/film",
                        }}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="onlineDate"
                        type="date"
                        display={row.onlineDate}
                        value={film?.onlineDate?.toISOString() ?? null}
                        extraField={{
                          name: "onlineLink",
                          type: "url",
                          value: film?.onlineLink ?? film?.finalLink ?? "",
                          label: "Hauptlink (Online)",
                          placeholder: "https://domain.tld/film",
                        }}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="lastContact"
                        type="date"
                        display={row.lastContact}
                        value={film?.lastContact?.toISOString() ?? null}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="status"
                        type="select"
                        display={row.pStatus}
                        value={film?.status ?? "AKTIV"}
                        options={P_STATUS_OPTIONS}
                        canEdit={canEdit}
                        displayClassName="uppercase tracking-wide text-xs text-gray-700"
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="reminderAt"
                        type="date"
                        display={row.reminderAt}
                        value={film?.reminderAt?.toISOString() ?? null}
                        canEdit={canEdit}
                      />
                    </td>
                    <td>
                      <FilmInlineCell
                        id={project.id}
                        name="note"
                        type="textarea"
                        display={row.note.length > 200 ? `${row.note.slice(0, 200)}...` : row.note}
                        value={film?.note ?? ""}
                        canEdit={canEdit}
                        displayClassName="max-w-[240px] text-xs text-gray-600"
                      />
                    </td>
                    <td>
                      <Link href={`/film-projects/${project.id}`} className="text-blue-600 underline">
                        Details
                      </Link>
                    </td>
                    {canDelete && (
                      <td>
                        <DangerActionButton
                          action={deleteFilmProject}
                          id={project.id}
                          confirmText={`Filmprojekt "${row.clientName}" wirklich löschen?`}
                          className="inline-flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </DangerActionButton>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={21} className="py-8 text-center text-sm text-gray-500">
                    Noch keine Filmprojekte hinterlegt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {renderPagination("mt-4")}
    </div>
  );
}

function makeSortHref({ current, key }: { current: Search; key: string }) {
  const p = new URLSearchParams();
  // Date columns should default to desc (newest first), others to asc
  const dateColumns = ["contractStart", "scouting", "scriptToClient", "scriptApproved", "shootDate", "firstCutToClient", "finalToClient", "onlineDate", "lastContact", "reminderAt", "updatedAt", "createdAt"];
  const defaultDir: "asc" | "desc" = dateColumns.includes(key) ? "desc" : "asc";
  const nextDir: "asc" | "desc" = current.sort === key ? (current.dir === "asc" ? "desc" : "asc") : defaultDir;
  p.set("sort", key);
  p.set("dir", nextDir);
  if (current.q) p.set("q", current.q);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.cutter && current.cutter.length) for (const v of current.cutter) p.append("cutter", v);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.pstatus && current.pstatus.length) for (const v of current.pstatus) p.append("pstatus", v);
  if (current.scope && current.scope.length) for (const v of current.scope) p.append("scope", v);
  if (current.ps) p.set("ps", current.ps);
  if (current.page) p.set("page", current.page);
  return `/film-projects?${p.toString()}`;
}

function makePageHref({ current, page }: { current: Search; page: number }) {
  const p = new URLSearchParams();
  if (current.sort) p.set("sort", current.sort);
  if (current.dir) p.set("dir", current.dir);
  if (current.q) p.set("q", current.q);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.cutter && current.cutter.length) for (const v of current.cutter) p.append("cutter", v);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.pstatus && current.pstatus.length) for (const v of current.pstatus) p.append("pstatus", v);
  if (current.scope && current.scope.length) for (const v of current.scope) p.append("scope", v);
  if (current.ps) p.set("ps", current.ps);
  p.set("page", String(page));
  return `/film-projects?${p.toString()}`;
}

function makePageSizeHref({ current, size }: { current: Search; size: number }) {
  const p = new URLSearchParams();
  if (current.sort) p.set("sort", current.sort);
  if (current.dir) p.set("dir", current.dir);
  if (current.q) p.set("q", current.q);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.cutter && current.cutter.length) for (const v of current.cutter) p.append("cutter", v);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.pstatus && current.pstatus.length) for (const v of current.pstatus) p.append("pstatus", v);
  if (current.scope && current.scope.length) for (const v of current.scope) p.append("scope", v);
  p.set("ps", String(size));
  // Reset to page 1 when changing page size
  return `/film-projects?${p.toString()}`;
}

function Th(props: { href?: string; active?: boolean; dir?: "asc" | "desc"; children: React.ReactNode }) {
  const { href, active, dir, children } = props;
  const arrow = active ? (dir === "desc" ? " ↓" : " ↑") : "";
  const className = "px-3 py-2 text-left";
  if (!href) return <th className={className}>{children}</th>;
  return (
    <th className={className}>
      <Link href={href} className="underline">{children}{arrow}</Link>
    </th>
  );
}
