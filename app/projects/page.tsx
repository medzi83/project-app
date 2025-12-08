import Link from "next/link";
import type { CSSProperties, SVGProps } from "react";
import type { Prisma, MaterialStatus, ProjectStatus, WebsitePriority, CMS as PrismaCMS } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InlineCell from "@/components/InlineCell";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import CheckboxFilterGroup from "@/components/CheckboxFilterGroup";
import { SaveFilterButton } from "@/components/SaveFilterButton";
import { ProjectRow } from "./ProjectRow";
import { deleteProject } from "./actions";
import {
  buildWebsiteStatusWhere,
  deriveProjectStatus,
  labelForProjectStatus,
  labelForProductionStatus,
  labelForMaterialStatus,
  MATERIAL_STATUS_VALUES,
  labelForWebsitePriority,
  labelForSeoStatus,
  labelForTextitStatus,
  DONE_PRODUCTION_STATUSES,
} from "@/lib/project-status";
import type { DerivedStatusFilter } from "@/lib/project-status";

type Search = {
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  status?: string[];
  pStatus?: string[];
  priority?: string[];
  cms?: string[];
  agent?: string[];
  page?: string;
  ps?: string;
  scope?: string;
  overdue?: string;
  client?: string;
  showBeendet?: string;
  needsReview?: string;
};

const STATUSES = ["WEBTERMIN", "MATERIAL", "UMSETZUNG", "DEMO", "ONLINE"] as const;
const P_STATUSES = ["NONE", "MMW", "VOLLST_A_K", "VOLLST_K_E_S", "BEENDET"] as const;
const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "JOOMLA", "WORDPRESS", "CUSTOM", "OTHER"] as const;

const fmtDate = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    // Naive formatting - extract date components directly without timezone conversion
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

const fmtDateTime = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    // Naive formatting - extract date/time components directly without timezone conversion
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

const mm = (n?: number | null) => (n ? `${Math.floor(n / 60)}h ${n % 60}m` : "-");

const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;
const AGENT_BADGE_BASE_CLASS = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";
const AGENT_BADGE_EMPTY_CLASS = `${AGENT_BADGE_BASE_CLASS} border-border bg-muted text-muted-foreground`;

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


const subtractWorkingDays = (input: Date, amount: number) => {
  const result = startOfDay(new Date(input));
  let remaining = Math.max(0, amount);
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (isWorkingDay(result)) remaining -= 1;
  }
  return result;
};

const getRemainingWorkdays = (
  status: MaterialStatus | null | undefined,
  lastMaterialAt: Date | string | null | undefined,
  demoDate: Date | string | null | undefined,
) => {
  if (status !== "VOLLSTAENDIG" || !lastMaterialAt) {
    return { display: "-", className: undefined as string | undefined };
  }
  const start = startOfDay(new Date(lastMaterialAt));
  if (Number.isNaN(start.getTime())) {
    return { display: "-", className: undefined };
  }
  const today = startOfDay(new Date());
  let end = today;
  if (demoDate) {
    const demo = startOfDay(new Date(demoDate));
    if (Number.isNaN(demo.getTime())) {
      return { display: "-", className: undefined };
    }
    if (demo < end) end = demo;
  }
  let days = workingDaysBetween(start, end);
  if (days < 0) days = 0;

  let className: string | undefined;
  if (days >= 60) className = "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive-foreground font-semibold px-2 py-0.5 rounded";
  else if (days >= 50) className = "text-destructive font-semibold";
  else if (days >= 30) className = "text-yellow-600 dark:text-yellow-500 font-semibold";
  return { display: String(days), className };
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProjectsPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const spRaw = await searchParams;

  // Check if user explicitly wants to reset all filters
  const resetFilters = str(spRaw.reset) === "1";

  // If reset is requested, clear saved filter preferences in database
  if (resetFilters && session.user.id) {
    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        projectsStatusFilter: [],
        projectsPriorityFilter: [],
        projectsCmsFilter: [],
        projectsAgentFilter: [],
      },
      create: {
        userId: session.user.id,
        projectsStatusFilter: [],
        projectsPriorityFilter: [],
        projectsCmsFilter: [],
        projectsAgentFilter: [],
      },
    });
  }

  // Load user preferences for default filters (AFTER potentially resetting them)
  const userPreferences = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
  });

  // Parse saved filters from JSON
  const savedStatusFilter = userPreferences?.projectsStatusFilter
    ? (Array.isArray(userPreferences.projectsStatusFilter) ? userPreferences.projectsStatusFilter as string[] : [])
    : undefined;
  const savedPriorityFilter = userPreferences?.projectsPriorityFilter
    ? (Array.isArray(userPreferences.projectsPriorityFilter) ? userPreferences.projectsPriorityFilter as string[] : [])
    : undefined;
  const savedCmsFilter = userPreferences?.projectsCmsFilter
    ? (Array.isArray(userPreferences.projectsCmsFilter) ? userPreferences.projectsCmsFilter as string[] : [])
    : undefined;
  const savedAgentFilter = userPreferences?.projectsAgentFilter
    ? (Array.isArray(userPreferences.projectsAgentFilter) ? userPreferences.projectsAgentFilter as string[] : [])
    : undefined;

  // Check if form was submitted (this hidden field is present when user clicks Apply button)
  const formSubmitted = str(spRaw.submitted) === "1";

  // Parse URL parameters
  const statusParam = arr(spRaw.status);
  const pStatusParam = arr(spRaw.pStatus);
  const priorityParam = arr(spRaw.priority);
  const cmsParam = arr(spRaw.cms);
  const agentParam = arr(spRaw.agent);
  const qParam = str(spRaw.q);

  // Only use saved filters if:
  // 1. Form was NOT submitted (user didn't click Apply button)
  // 2. User didn't click reset
  // 3. No other parameters present
  const hasAnyParams =
    statusParam.length > 0 ||
    pStatusParam.length > 0 ||
    priorityParam.length > 0 ||
    cmsParam.length > 0 ||
    agentParam.length > 0 ||
    qParam;

  const useSavedFilters = !formSubmitted && !resetFilters && !hasAnyParams;

  // When reset is triggered, ensure filters are cleared by using empty arrays
  // When form is submitted without params, also use empty arrays (not saved filters)
  let sp: Search = {
    sort: str(spRaw.sort) ?? "standard",
    dir: (str(spRaw.dir) as "asc" | "desc") ?? "desc",
    q: resetFilters ? "" : (qParam ?? ""),
    status: resetFilters ? [] : (useSavedFilters ? savedStatusFilter : statusParam),
    pStatus: resetFilters ? [] : pStatusParam,
    priority: resetFilters ? [] : (useSavedFilters ? savedPriorityFilter : priorityParam),
    cms: resetFilters ? [] : (useSavedFilters ? savedCmsFilter : cmsParam),
    agent: resetFilters ? [] : (useSavedFilters ? savedAgentFilter : agentParam),
    page: str(spRaw.page) ?? "1",
    ps: str(spRaw.ps) ?? "50",
    scope: str(spRaw.scope) ?? undefined,
    overdue: str(spRaw.overdue) ?? undefined,
    client: str(spRaw.client) ?? undefined,
    showBeendet: str(spRaw.showBeendet) ?? undefined,
    needsReview: str(spRaw.needsReview) ?? undefined,
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

  const scopeActive = sp.scope === "active";
  const showBeendetProjects = sp.showBeendet === "1";

  const role = session.user.role!;
  const canEdit = role === "ADMIN" || role === "AGENT";
  const isSales = role === "SALES";
  const clientId = session.user.clientId ?? undefined;

  const where: Prisma.ProjectWhereInput = {
    // Only show website projects (type: WEBSITE or has website relation)
    OR: [
      { type: "WEBSITE" },
      { website: { isNot: null } }
    ]
  };
  const ensureAnd = (): Prisma.ProjectWhereInput[] => {
    if (!where.AND) {
      where.AND = [];
    } else if (!Array.isArray(where.AND)) {
      where.AND = [where.AND];
    }
    return where.AND as Prisma.ProjectWhereInput[];
  };

  // Exclude BEENDET projects by default (unless showBeendet=1 or status filter includes BEENDET)
  const statusFilterIncludesBeendet = sp.status && sp.status.includes("BEENDET");
  if (!showBeendetProjects && !statusFilterIncludesBeendet) {
    const andConditions = ensureAnd();
    andConditions.push({ status: { not: "BEENDET" } });
  }
  if (role === "CUSTOMER") {
    if (!clientId) redirect("/");
    where.clientId = clientId!;
  }
  if (scopeActive) {
    const andConditions = ensureAnd();
    andConditions.push({
      OR: [
        {
          type: "WEBSITE",
          website: { is: { pStatus: { notIn: DONE_PRODUCTION_STATUSES } } },
        },
        {
          AND: [{ type: { not: "WEBSITE" } }, { status: { not: "ONLINE" } }],
        },
      ],
    });
  }
  if (sp.q) {
    where.client = {
      is: {
        OR: [
          { customerNo: { contains: sp.q, mode: "insensitive" } },
          { name: { contains: sp.q, mode: "insensitive" } },
        ],
      },
    };
  }
    if (sp.client) {
    const andConditions = ensureAnd();
    andConditions.push({ clientId: sp.client });
  }
  if (sp.overdue === "1") {
    const now = startOfDay(new Date());
    const cutoff = subtractWorkingDays(now, 60);
    const andConditions = ensureAnd();
    andConditions.push({
      type: "WEBSITE",
      status: "UMSETZUNG",
      website: {
        is: {
          AND: [
            { materialStatus: "VOLLSTAENDIG" },
            { lastMaterialAt: { not: null, lte: cutoff } },
            {
              OR: [
                { demoDate: null },
                { demoDate: { gt: now } },
              ],
            },
          ],
        },
      },
    });
  }
  if (sp.needsReview === "1") {
    const andConditions = ensureAnd();
    andConditions.push({
      type: "WEBSITE",
      website: {
        is: {
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
  }
  if (sp.status && sp.status.length > 0) {
    const now = new Date();
    const statusFilters: Prisma.ProjectWhereInput[] = [];
    const uniqueStatuses = Array.from(new Set(sp.status));
    const includesBeendet = uniqueStatuses.includes("BEENDET");

    for (const statusValue of uniqueStatuses) {
      if (statusValue !== "BEENDET" && !(STATUSES as readonly string[]).includes(statusValue)) continue;

      const statusKey = (statusValue === "BEENDET"
        ? "BEENDET"
        : statusValue) as DerivedStatusFilter;
      const websiteWhere = buildWebsiteStatusWhere(statusKey, now);
      const orParts: Prisma.ProjectWhereInput[] = [];
      if (websiteWhere) {
        const shouldExcludeDone = scopeActive || (statusValue === "ONLINE" && !includesBeendet);
        const websiteCondition: Prisma.ProjectWhereInput = shouldExcludeDone
          ? {
              AND: [
                websiteWhere,
                {
                  type: "WEBSITE" as const,
                  website: { is: { pStatus: { notIn: DONE_PRODUCTION_STATUSES } } },
                },
              ],
            }
          : websiteWhere;
        orParts.push(websiteCondition);
      }

      if ((STATUSES as readonly string[]).includes(statusValue)) {
        orParts.push({
          AND: [
            { type: { not: "WEBSITE" } },
            { status: statusValue as ProjectStatus },
          ],
        });
      } else if (statusValue === "BEENDET") {
        orParts.push({
          AND: [
            { type: { not: "WEBSITE" } },
            { status: "ONLINE" as ProjectStatus },
          ],
        });
      }

      if (orParts.length === 1) statusFilters.push(orParts[0]);
      else if (orParts.length > 1) statusFilters.push({ OR: orParts });
    }

    if (statusFilters.length > 0) {
      const andConditions = ensureAnd();
      andConditions.push({ OR: statusFilters });
    }
  }
  const websiteFilters: Prisma.ProjectWebsiteWhereInput = {};
  if (sp.priority && sp.priority.length > 0) {
    const vals = sp.priority.filter((p) => (PRIORITIES as readonly string[]).includes(p));
    if (vals.length > 0) websiteFilters.priority = { in: vals as WebsitePriority[] };
  }
  if (sp.cms && sp.cms.length > 0) {
    const vals = sp.cms.filter((c) => (CMS as readonly string[]).includes(c));
    if (vals.length > 0) websiteFilters.cms = { in: vals as PrismaCMS[] };
  }
  if (sp.pStatus && sp.pStatus.length > 0) {
    const vals = sp.pStatus.filter((p) => (P_STATUSES as readonly string[]).includes(p));
    if (vals.length > 0) websiteFilters.pStatus = { in: vals as typeof P_STATUSES[number][] };
  }
  if (Object.keys(websiteFilters).length > 0) where.website = { is: websiteFilters };

  if (sp.agent && sp.agent.length > 0) {
    // If "alle" is selected, do not apply any agent filter
    if (!sp.agent.includes("alle")) {
      const hasNone = sp.agent.includes("none");
      const ids = sp.agent.filter((a) => a !== "none" && a !== "alle");
      const orParts: Prisma.ProjectWhereInput[] = [];
      if (ids.length > 0) orParts.push({ agentId: { in: ids } });
      if (hasNone) orParts.push({ agentId: null });
      if (orParts.length > 0) {
        const andConditions = ensureAnd();
        andConditions.push({ OR: orParts });
      }
    }
  }

  const orderBy = mapOrderBy(sp.sort!, sp.dir!);
  const pageSize = sp.ps === "100" ? 100 : 50;
  const page = Math.max(1, Number.parseInt(sp.page || "1") || 1);
  const skip = (page - 1) * pageSize;

  const [projects, agentsAll, agentsActive, total, favoriteClientIds] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: true,
        website: {
          include: {
            webDocumentation: {
              select: {
                confirmedAt: true,
                materialLogoNeeded: true,
                logoImagesSubmittedAt: true,
                logoImagesReviewedAt: true,
                materialNotesNeedsImages: true,
                generalImagesSubmittedAt: true,
                generalImagesReviewedAt: true,
                generalTextSubmission: {
                  select: {
                    submittedAt: true,
                    suitable: true,
                  },
                },
                menuItems: {
                  select: {
                    needsImages: true,
                    imagesSubmittedAt: true,
                    imagesReviewedAt: true,
                    textSubmission: {
                      select: {
                        submittedAt: true,
                        suitable: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        agent: true,
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.user.findMany({
      where: { role: "AGENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, categories: true, color: true }
    }),
    prisma.user.findMany({
      where: { role: "AGENT", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, categories: true, color: true }
    }),
    prisma.project.count({ where }),
    isSales ? prisma.favoriteClient.findMany({
      where: { userId: session.user.id },
      select: { clientId: true },
    }).then((favorites) => new Set(favorites.map((f) => f.clientId))) : Promise.resolve(new Set<string>()),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(total, skip + projects.length);

  const mkSort = (key: string) => makeSortHref({ current: sp, key });
  const mkPageHref = (p: number) => makePageHref({ current: sp, page: p });
  const mkPageSizeHref = (s: number) => makePageSizeHref({ current: sp, size: s });
  const renderPagination = (extraClass?: string) => {
    const className = ["flex flex-wrap items-center gap-3 text-sm text-muted-foreground", extraClass].filter(Boolean).join(" ");
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

  const materialStatusOptions = MATERIAL_STATUS_VALUES.map((value) => ({ value, label: labelForMaterialStatus(value) }));

  // Nur aktive Agenten mit Kategorie WEBSEITE für die Dropdown-Auswahl
  const websiteAgentsForDropdown = agentsAll.filter(a => a.categories.includes("WEBSEITE") && agentsActive.some(active => active.id === a.id));

  // Import agent helpers
  const { expandAgentsWithWTAliases, getAgentDisplayName, getEffectiveAgentId } = await import("@/lib/agent-helpers");

  // Expand with WT aliases for web projects
  const websiteAgentsExpanded = expandAgentsWithWTAliases(websiteAgentsForDropdown);

  const agentOptions = [
    { value: "", label: "- ohne Agent -" },
    ...websiteAgentsExpanded.map((a) => ({
      value: a.id,
      label: a.name ?? a.email ?? "",
    })),
  ];
  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: labelForWebsitePriority(p) }));
  const cmsOptions = CMS.map((c) => ({ value: c, label: c === "SHOPWARE" ? "Shop" : c }));
  const pStatusOptions = ["NONE", "BEENDET", "MMW", "VOLLST_A_K", "VOLLST_K_E_S"].map((v) => ({ value: v, label: labelForProductionStatus(v) }));
  const seoOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForSeoStatus(v) }));
  const textitOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForTextitStatus(v) }));

  return (
    <div className="w-full space-y-6 py-6 px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Webseitenprojekte</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'Projekt' : 'Projekte'} gesamt
          </p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Suche</CardTitle>
          <CardDescription>
            Filtern und sortieren Sie Webseitenprojekte
          </CardDescription>
        </CardHeader>
        <CardContent>
    <form method="get" className="flex flex-col gap-4">
      <input type="hidden" name="sort" value={sp.sort} />
      <input type="hidden" name="submitted" value="1" />
      {scopeActive && <input type="hidden" name="scope" value="active" />}
      {sp.client && <input type="hidden" name="client" value={sp.client} />}
      {sp.overdue === "1" && <input type="hidden" name="overdue" value="1" />}
      {sp.showBeendet === "1" && <input type="hidden" name="showBeendet" value="1" />}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 w-48 shrink-0">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Kunde suchen</label>
          <input name="q" defaultValue={sp.q} placeholder="Kundennr. oder Name" className="px-2 py-1 text-xs border rounded bg-background text-foreground" />
        </div>

        <CheckboxFilterGroup
          name="status"
          label="Status"
          options={[
            ...STATUSES.map((s) => ({ value: s, label: labelForProjectStatus(s as ProjectStatus) })),
            { value: "BEENDET", label: "Beendet" },
          ]}
          selected={sp.status ?? []}
          width="w-44"
        />

        <CheckboxFilterGroup
          name="pStatus"
          label="P-Status"
          options={P_STATUSES.map((p) => ({ value: p, label: labelForProductionStatus(p) }))}
          selected={sp.pStatus ?? []}
          width="w-48"
        />

        <CheckboxFilterGroup
          name="priority"
          label="Prio"
          options={PRIORITIES.map((p) => ({ value: p, label: labelForWebsitePriority(p) }))}
          selected={sp.priority ?? []}
          width="w-40"
        />

        <CheckboxFilterGroup
          name="cms"
          label="CMS"
          options={CMS.map((c) => ({ value: c, label: c === "SHOPWARE" ? "Shop" : c }))}
          selected={sp.cms ?? []}
          width="w-40"
        />

        <CheckboxFilterGroup
          name="agent"
          label="Agent"
          options={[
            { value: "alle", label: "Alle" },
            { value: "none", label: "Ohne Agent" },
            ...agentsActive.filter(a => a.categories.includes("WEBSEITE")).map((a) => ({
              value: a.id,
              label: a.name ?? a.email ?? "",
            })),
          ]}
          selected={sp.agent ?? []}
          width="w-52"
        />

        <div className="flex flex-col gap-1 w-36 shrink-0">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Reihenfolge</label>
          <select name="dir" defaultValue={sp.dir} className="px-2 py-1 text-xs border rounded bg-background text-foreground">
            <option value="asc">aufsteigend</option>
            <option value="desc">absteigend</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Button type="submit" className="gap-2 h-10">Anwenden</Button>
          <SaveFilterButton
            type="projects"
            currentStatus={sp.status}
            currentPriority={sp.priority}
            currentCms={sp.cms}
            currentAgent={sp.agent}
          />
          <Button type="button" variant="outline" asChild className="h-10">
            <Link href="/projects?reset=1">Zurücksetzen</Link>
          </Button>
          <Button type="submit" name="standardSort" value="1" variant="outline" className="h-10">Standardsortierung</Button>
          <Button type="button" variant={showBeendetProjects ? "default" : "outline"} asChild className="h-10">
            <Link href={makeShowBeendetHref({ current: sp, show: !showBeendetProjects })}>
              {showBeendetProjects ? "Beendete Projekte ausblenden" : "Beendete Projekte einblenden"}
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Bevor du einen Filter speichern möchtest, um ihn bei jedem Aufruf der Liste standardmäßig zu laden, musst du die gesetzten Filteroptionen erst &quot;Anwenden&quot; und dann kannst du &quot;Filter speichern&quot;.
        </p>
      </div>
    </form>
        </CardContent>
      </Card>

      {sp.needsReview === "1" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-lg">
              i
            </div>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">Eingereichtes Material prüfen</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Diese Projekte haben eingereichtes Material, das noch geprüft werden muss.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" asChild className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50">
            <Link href="/projects">Filter entfernen</Link>
          </Button>
        </div>
      )}

      {renderPagination("mt-4")}

      {/* Table */}
      <div className="rounded-lg border shadow-sm bg-card">
        <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
          <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                  <Th href={mkSort("status")} active={sp.sort==="status"} dir={sp.dir}>Status</Th>
                  <Th href={mkSort("customerNo")} active={sp.sort==="customerNo"} dir={sp.dir} width={120}>Kundennr.</Th>
                  <Th href={mkSort("clientName")} active={sp.sort==="clientName"} dir={sp.dir} width={200}>Kunde</Th>
                  <Th className="text-center" width={60}></Th>
                  <Th href={mkSort("priority")} active={sp.sort==="priority"} dir={sp.dir}>Prio</Th>
                  <Th href={mkSort("pStatus")} active={sp.sort==="pStatus"} dir={sp.dir}>P-Status</Th>
                  <Th href={mkSort("cms")} active={sp.sort==="cms"} dir={sp.dir}>CMS</Th>
                  <Th href={mkSort("agent")} active={sp.sort==="agent"} dir={sp.dir}>Umsetzer</Th>
                  <Th href={mkSort("webDate")} active={sp.sort==="webDate"} dir={sp.dir}>Webtermin</Th>
                  <Th href={mkSort("demoDate")} active={sp.sort==="demoDate"} dir={sp.dir}>Demo an Kunden</Th>
                  <Th href={mkSort("onlineDate")} active={sp.sort==="onlineDate"} dir={sp.dir}>Online</Th>
                  <Th href={mkSort("materialStatus")} active={sp.sort==="materialStatus"} dir={sp.dir}>Material</Th>
                  <Th href={mkSort("lastMaterialAt")} active={sp.sort==="lastMaterialAt"} dir={sp.dir}>Letzter Materialeingang</Th>
                  <Th href={mkSort("effortBuildMin")} active={sp.sort==="effortBuildMin"} dir={sp.dir}>Aufwand Umsetz.</Th>
                  <Th href={mkSort("effortDemoMin")} active={sp.sort==="effortDemoMin"} dir={sp.dir}>Aufwand Demo</Th>
                  <Th href={mkSort("workdays")} active={sp.sort==="workdays"} dir={sp.dir}>Arbeitstage</Th>
                  <Th href={mkSort("seo")} active={sp.sort==="seo"} dir={sp.dir}>SEO</Th>
                  <Th href={mkSort("textit")} active={sp.sort==="textit"} dir={sp.dir}>Textit</Th>
                  <Th href={mkSort("accessible")} active={sp.sort==="accessible"} dir={sp.dir}>Barrierefrei</Th>
                  <Th href={mkSort("note")} active={sp.sort==="note"} dir={sp.dir}>Hinweis</Th>
                  <Th href={mkSort("updatedAt")} active={sp.sort==="updatedAt"} dir={sp.dir}>Aktualisiert</Th>
                  <Th>Aktionen</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
            {projects.map((p) => {
              const materialStatus = (p.website?.materialStatus ?? "ANGEFORDERT") as MaterialStatus;
              const workdayInfo = getRemainingWorkdays(materialStatus, p.website?.lastMaterialAt, p.website?.demoDate);
              const materialStatusClass = materialStatus === "VOLLSTAENDIG" ? "bg-green-500/20 dark:bg-green-500/30 px-2 py-1 rounded" : undefined;
              const hasAgent = Boolean(p.agent);
              const badgeClass = hasAgent ? (p.agent?.color ? AGENT_BADGE_BASE_CLASS : AGENT_BADGE_EMPTY_CLASS) : undefined;
              const badgeStyle = hasAgent ? agentBadgeStyle(p.agent?.color) : undefined;

              // Determine agent display name and effective ID based on isWTAssignment
              const isWTAssignment = p.website?.isWTAssignment ?? false;
              const agentDisplayName = getAgentDisplayName(p.agentId, isWTAssignment, agentsAll);
              const effectiveAgentId = getEffectiveAgentId(p.agentId, isWTAssignment);

              const ended = (p.website?.pStatus ?? "") === "BEENDET";
              // Calculate status in real-time based on current data
              const derivedStatus = deriveProjectStatus({
                pStatus: p.website?.pStatus,
                webDate: p.website?.webDate,
                webterminType: p.website?.webterminType,
                demoDate: p.website?.demoDate,
                onlineDate: p.website?.onlineDate,
                materialStatus: p.website?.materialStatus,
                webDokuConfirmedAt: p.website?.webDocumentation?.confirmedAt,
              });
              const statusLabel = labelForProjectStatus(derivedStatus, { pStatus: p.website?.pStatus });
              const clientInactive = p.client?.workStopped || p.client?.finished;
              const isOnline = derivedStatus === "ONLINE";
              const relevantDate = relevantWebsiteDate(derivedStatus, p.website ?? undefined);
              const isStale =
                !ended &&
                !clientInactive &&
                !isOnline &&
                isActiveProductionStatus(p.website?.pStatus) &&
                isOlderThan4Weeks(relevantDate);

              // Check if status should have green background
              const isUmsetzung = derivedStatus === "UMSETZUNG";
              const textitReady = p.website?.textit === "JA_JA" || p.website?.textit === "NEIN";
              const seoReady = p.website?.seo === "NEIN" || p.website?.seo === "JA_NEIN" || p.website?.seo === "JA_JA";
              const statusGreen = isUmsetzung && textitReady && seoReady;
              const isDemo = derivedStatus === "DEMO";
              const statusOnline = derivedStatus === "ONLINE";
              const isKesStatus = p.website?.pStatus === "VOLLST_K_E_S" && derivedStatus === "UMSETZUNG";

              const isFavoriteClient = p.clientId && favoriteClientIds.has(p.clientId);

              // Prüfe ob Materialprüfung notwendig ist (eingereichte Texte oder Bilder ohne Bewertung)
              const webDoc = p.website?.webDocumentation;
              const needsMaterialReview = webDoc ? (() => {
                // Allgemeiner Text eingereicht aber nicht geprüft
                const generalTextNeedsReview = webDoc.generalTextSubmission?.submittedAt && webDoc.generalTextSubmission?.suitable === null;
                // MenuItem-Texte eingereicht aber nicht geprüft
                const menuItemTextsNeedReview = webDoc.menuItems?.some(
                  (item: { textSubmission?: { submittedAt?: Date | null; suitable?: boolean | null } | null }) =>
                    item.textSubmission?.submittedAt && item.textSubmission?.suitable === null
                );
                // MenuItem-Bilder vom Kunden eingereicht aber noch nicht vom Agenten geprüft
                const menuItemImagesNeedReview = webDoc.menuItems?.some(
                  (item: { needsImages?: boolean; imagesSubmittedAt?: Date | null; imagesReviewedAt?: Date | null }) =>
                    item.needsImages && item.imagesSubmittedAt && !item.imagesReviewedAt
                );
                // Logo-Bilder eingereicht aber noch nicht geprüft
                const logoImagesNeedReview = webDoc.materialLogoNeeded && webDoc.logoImagesSubmittedAt && !webDoc.logoImagesReviewedAt;
                // Sonstige Bilder eingereicht aber noch nicht geprüft
                const generalImagesNeedReview = webDoc.materialNotesNeedsImages && webDoc.generalImagesSubmittedAt && !webDoc.generalImagesReviewedAt;
                return generalTextNeedsReview || menuItemTextsNeedReview || menuItemImagesNeedReview || logoImagesNeedReview || generalImagesNeedReview;
              })() : false;

              const rowClasses = ["transition-colors"];
              if (isStale) rowClasses.push("bg-destructive/10", "hover:bg-destructive/20");
              else rowClasses.push("hover:bg-muted/50");
              if (ended) rowClasses.push("opacity-60");
              return (
                <ProjectRow key={p.id} rowClasses={rowClasses.join(" ")} projectId={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={
                        statusOnline
                          ? "inline-flex items-center px-2 py-1 rounded-md bg-green-500/30 dark:bg-green-500/40 text-green-900 dark:text-green-100 text-xs font-semibold"
                          : isDemo
                          ? "inline-flex items-center px-2 py-1 rounded-md bg-cyan-300/40 dark:bg-cyan-400/30 text-cyan-900 dark:text-cyan-100 text-xs font-semibold"
                          : statusGreen
                          ? "inline-flex items-center px-2 py-1 rounded-md bg-green-500/30 dark:bg-green-500/40 text-green-900 dark:text-green-100 text-xs font-semibold"
                          : ""
                      } style={isKesStatus ? { fontStyle: "italic" } : undefined}>{statusLabel}</span>
                      {needsMaterialReview && (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold cursor-help"
                          title="Materialprüfung notwendig"
                        >
                          i
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {p.client?.customerNo ? (
                        <Link href={`/clients/${p.clientId}`} className="underline text-primary hover:text-primary/80">
                          {p.client.customerNo}
                        </Link>
                      ) : (
                        <span>-</span>
                      )}
                      {p.client?.workStopped && (
                        <Badge variant="destructive" className="text-xs font-bold">
                          ARBEITSSTOPP
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] client-name-cell cursor-pointer select-none" title={p.client?.name ?? ""}>
                    <div className="flex items-center gap-2">
                      {isSales && isFavoriteClient && (
                        <svg className="w-3.5 h-3.5 text-yellow-500 fill-current flex-shrink-0" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      )}
                      <span className="truncate">{p.client?.name ?? "-"}</span>
                      {p.title && (
                        <sup className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-500 dark:bg-blue-600 text-white cursor-help flex-shrink-0 leading-none font-bold" title={p.title}>
                          +
                        </sup>
                      )}
                      {p.website?.isRelaunch && (
                        <Badge className="bg-orange-500 dark:bg-orange-600 text-white text-xs flex-shrink-0" title="Relaunch-Projekt">
                          RL
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/projects/${p.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted transition-colors" title="Details anzeigen">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                  </TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="priority" type="select" display={labelForWebsitePriority(p.website?.priority)} value={p.website?.priority ?? "NONE"} options={priorityOptions} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="pStatus" type="select" display={labelForProductionStatus(p.website?.pStatus)} value={p.website?.pStatus ?? "NONE"} options={pStatusOptions} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="cms" type="select" display={p.website?.cms === "SHOPWARE" ? "Shop" : p.website?.cms ?? "-"} value={p.website?.cms ?? ""} options={cmsOptions} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="project" id={p.id} name="agentId" type="select" display={agentDisplayName} value={effectiveAgentId} options={agentOptions} canEdit={canEdit} displayClassName={badgeClass} displayStyle={badgeStyle} /></TableCell>
                  <TableCell className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="webDate" type="datetime-with-type" display={fmtDate(p.website?.webDate)} value={p.website?.webDate ? new Date(p.website.webDate).toISOString() : ""} extraValue={p.website?.webterminType ?? ""} canEdit={canEdit} /></TableCell>
                  <TableCell className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="demoDate" type="date" display={fmtDate(p.website?.demoDate)} value={p.website?.demoDate ? new Date(p.website.demoDate).toISOString().slice(0, 10) : ""} canEdit={canEdit} /></TableCell>
                  <TableCell className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="onlineDate" type="date" display={fmtDate(p.website?.onlineDate)} value={p.website?.onlineDate ? new Date(p.website.onlineDate).toISOString().slice(0, 10) : ""} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="materialStatus" type="select" display={labelForMaterialStatus(materialStatus)} value={materialStatus} options={materialStatusOptions} canEdit={canEdit} displayClassName={materialStatusClass} /></TableCell>
                  <TableCell className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="lastMaterialAt" type="date" display={fmtDate(p.website?.lastMaterialAt)} value={p.website?.lastMaterialAt ? new Date(p.website.lastMaterialAt).toISOString().slice(0, 10) : ""} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="effortBuildMin" type="number" display={mm(p.website?.effortBuildMin)} value={p.website?.effortBuildMin != null ? p.website.effortBuildMin / 60 : ""} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="effortDemoMin" type="number" display={mm(p.website?.effortDemoMin)} value={p.website?.effortDemoMin != null ? p.website.effortDemoMin / 60 : ""} canEdit={canEdit} /></TableCell>
                  <TableCell className={workdayInfo.className}>{workdayInfo.display}</TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="seo" type="select" display={labelForSeoStatus(p.website?.seo)} value={p.website?.seo ?? ""} options={seoOptions} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="textit" type="select" display={labelForTextitStatus(p.website?.textit)} value={p.website?.textit ?? ""} options={textitOptions} canEdit={canEdit} /></TableCell>
                  <TableCell><InlineCell target="website" id={p.id} name="accessible" type="tri" display={p.website?.accessible == null ? "-" : p.website?.accessible ? "Ja" : "Nein"} value={p.website?.accessible ?? null} canEdit={canEdit} /></TableCell>
                  <TableCell className="align-top"><InlineCell target="website" id={p.id} name="note" type="textarea" display={p.website?.note ?? ""} value={p.website?.note ?? ""} canEdit={canEdit} displayClassName="block whitespace-pre-wrap" /></TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(p.updatedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {role === "ADMIN" && (
                      <form action={deleteProject}>
                        <input type="hidden" name="projectId" value={p.id} />
                        <ConfirmSubmit
                          confirmText="Dieses Projekt unwiderruflich löschen?"
                          className="inline-flex items-center gap-1 rounded border border-destructive/30 px-2 py-1 text-destructive hover:bg-destructive/10"
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="sr-only">Projekt löschen</span>
                        </ConfirmSubmit>
                      </form>
                    )}
                  </TableCell>
                </ProjectRow>
              );
            })}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={22} className="py-10 text-center text-muted-foreground">
                  Keine Webseitenprojekte gefunden.
                </TableCell>
              </TableRow>
            )}
              </TableBody>
          </Table>
        </div>
      </div>

      {renderPagination("mt-4")}
    </div>
  );
}

function str(v: string | string[] | undefined) { return typeof v === "string" ? v : undefined; }
function arr(v: string | string[] | undefined): string[] { return Array.isArray(v) ? v : (typeof v === "string" && v !== "" ? [v] : []); }

function mapOrderBy(sort: string, dir: "asc" | "desc"): Prisma.ProjectOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = dir === "desc" ? "desc" : "asc";
  const updatedDesc: Prisma.SortOrder = "desc";
  const def: Prisma.ProjectOrderByWithRelationInput[] = [
    { client: { customerNo: "asc" } },
    { client: { name: "asc" } },
    { updatedAt: updatedDesc },
  ];
  switch (sort) {
    case "standard":
      return [
        { website: { onlineDate: direction } },
        { website: { demoDate: direction } },
        { website: { lastMaterialAt: direction } },
        { website: { webDate: direction } },
        { updatedAt: updatedDesc },
      ];
    case "customerNo": return [{ client: { customerNo: direction } }, { client: { name: "asc" } }, { updatedAt: updatedDesc }];
    case "clientName": return [{ client: { name: direction } }, { updatedAt: updatedDesc }];
    case "title": return [{ title: direction }];
    case "status": return [{ status: direction }, { updatedAt: updatedDesc }];
    case "priority": return [{ website: { priority: direction } }, { updatedAt: updatedDesc }];
    case "pStatus": return [{ website: { pStatus: direction } }, { updatedAt: updatedDesc }];
    case "cms": return [{ website: { cms: direction } }, { updatedAt: updatedDesc }];
    case "domain": return [{ website: { domain: direction } }, { updatedAt: updatedDesc }];
    case "agent": return [{ agent: { name: direction } }, { updatedAt: updatedDesc }];
    case "webDate": return [{ website: { webDate: direction } }, { updatedAt: updatedDesc }];
    case "demoDate": return [{ website: { demoDate: direction } }, { updatedAt: updatedDesc }];
    case "onlineDate": return [{ website: { onlineDate: direction } }, { updatedAt: updatedDesc }];
    case "lastMaterialAt": return [{ website: { lastMaterialAt: direction } }, { updatedAt: updatedDesc }];
    case "effortBuildMin": return [{ website: { effortBuildMin: direction } }, { updatedAt: updatedDesc }];
    case "effortDemoMin": return [{ website: { effortDemoMin: direction } }, { updatedAt: updatedDesc }];
    case "workdays": return [{ website: { lastMaterialAt: direction } }, { website: { demoDate: direction } }, { updatedAt: updatedDesc }];
    case "seo": return [{ website: { seo: direction } }, { updatedAt: updatedDesc }];
    case "textit": return [{ website: { textit: direction } }, { updatedAt: updatedDesc }];
    case "materialStatus": return [{ website: { materialStatus: direction } }, { updatedAt: updatedDesc }];
    case "accessible": return [{ website: { accessible: direction } }, { updatedAt: updatedDesc }];
    case "note": return [{ website: { note: direction } }, { updatedAt: updatedDesc }];
    case "updatedAt": return [{ updatedAt: direction }];
    default: return def;
  }
}

function makeSortHref({ current, key }: { current: Search; key: string }) {
  const p = new URLSearchParams();
  // Date columns should default to desc (newest first), others to asc
  const dateColumns = ["webDate", "demoDate", "onlineDate", "lastMaterialAt", "updatedAt", "createdAt"];
  const defaultDir: "asc" | "desc" = dateColumns.includes(key) ? "desc" : "asc";
  const nextDir: "asc" | "desc" = current.sort === key ? (current.dir === "asc" ? "desc" : "asc") : defaultDir;
  p.set("sort", key);
  p.set("dir", nextDir);
  if (current.q) p.set("q", current.q);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.pStatus && current.pStatus.length) for (const v of current.pStatus) p.append("pStatus", v);
  if (current.priority && current.priority.length) for (const v of current.priority) p.append("priority", v);
  if (current.cms && current.cms.length) for (const v of current.cms) p.append("cms", v);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.ps) p.set("ps", current.ps);
  if (current.page) p.set("page", current.page);
  if (current.scope) p.set("scope", current.scope);
  if (current.client) p.set("client", current.client);
  if (current.overdue === "1") p.set("overdue", "1");
  if (current.showBeendet === "1") p.set("showBeendet", "1");
  if (current.needsReview === "1") p.set("needsReview", "1");
  return `/projects?${p.toString()}`;
}

function makePageHref({ current, page }: { current: Search; page: number }) {
  const p = new URLSearchParams();
  if (current.sort) p.set("sort", current.sort);
  if (current.dir) p.set("dir", current.dir);
  if (current.q) p.set("q", current.q);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.pStatus && current.pStatus.length) for (const v of current.pStatus) p.append("pStatus", v);
  if (current.priority && current.priority.length) for (const v of current.priority) p.append("priority", v);
  if (current.cms && current.cms.length) for (const v of current.cms) p.append("cms", v);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.ps) p.set("ps", current.ps);
  if (current.scope) p.set("scope", current.scope);
  if (current.client) p.set("client", current.client);
  if (current.overdue === "1") p.set("overdue", "1");
  if (current.showBeendet === "1") p.set("showBeendet", "1");
  if (current.needsReview === "1") p.set("needsReview", "1");
  p.set("page", String(page));
  return `/projects?${p.toString()}`;
}

function makePageSizeHref({ current, size }: { current: Search; size: number }) {
  const p = new URLSearchParams();
  if (current.sort) p.set("sort", current.sort);
  if (current.dir) p.set("dir", current.dir);
  if (current.q) p.set("q", current.q);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.pStatus && current.pStatus.length) for (const v of current.pStatus) p.append("pStatus", v);
  if (current.priority && current.priority.length) for (const v of current.priority) p.append("priority", v);
  if (current.cms && current.cms.length) for (const v of current.cms) p.append("cms", v);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.scope) p.set("scope", current.scope);
  if (current.client) p.set("client", current.client);
  if (current.overdue === "1") p.set("overdue", "1");
  if (current.showBeendet === "1") p.set("showBeendet", "1");
  if (current.needsReview === "1") p.set("needsReview", "1");
  p.set("ps", String(size));
  p.set("page", "1");
  return `/projects?${p.toString()}`;
}

function makeShowBeendetHref({ current, show }: { current: Search; show: boolean }) {
  const p = new URLSearchParams();
  if (current.sort) p.set("sort", current.sort);
  if (current.dir) p.set("dir", current.dir);
  if (current.q) p.set("q", current.q);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.pStatus && current.pStatus.length) for (const v of current.pStatus) p.append("pStatus", v);
  if (current.priority && current.priority.length) for (const v of current.priority) p.append("priority", v);
  if (current.cms && current.cms.length) for (const v of current.cms) p.append("cms", v);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.ps) p.set("ps", current.ps);
  if (current.page) p.set("page", current.page);
  if (current.scope) p.set("scope", current.scope);
  if (current.client) p.set("client", current.client);
  if (current.overdue === "1") p.set("overdue", "1");
  if (current.needsReview === "1") p.set("needsReview", "1");
  if (show) p.set("showBeendet", "1");
  return `/projects?${p.toString()}`;
}

function Th(props: { href?: string; active?: boolean; dir?: "asc" | "desc"; children: React.ReactNode; width?: number }) {
  const { href, active, dir, children, width } = props;
  const arrow = active ? (dir === "desc" ? " ↓" : " ↑") : "";
  if (!href) return <TableHead className="whitespace-normal" style={width ? { width } : undefined}>{children}</TableHead>;
  return (
    <TableHead className="whitespace-normal" style={width ? { width } : undefined}>
      <Link href={href} className="underline hover:text-primary">{children}{arrow}</Link>
    </TableHead>
  );
}





































