import Link from "next/link";
import type { CSSProperties, SVGProps } from "react";
import type { Prisma, MaterialStatus, ProjectStatus, WebsitePriority, CMS as PrismaCMS } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import InlineCell from "@/components/InlineCell";
import DangerActionButton from "@/components/DangerActionButton";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import CheckboxFilterGroup from "@/components/CheckboxFilterGroup";
import { SaveSortButton } from "@/components/SaveSortButton";
import { deleteAllProjects, deleteProject } from "./actions";
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
  priority?: string[];
  cms?: string[];
  agent?: string[];
  page?: string;
  ps?: string;
  scope?: string;
  overdue?: string;
  client?: string;
};

const STATUSES = ["WEBTERMIN", "MATERIAL", "UMSETZUNG", "DEMO", "ONLINE"] as const;
const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "JOOMLA", "LOGO", "PRINT", "OTHER"] as const;

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
  if (days >= 60) className = "bg-red-200 text-yellow-900 font-semibold px-2 py-0.5 rounded";
  else if (days >= 50) className = "text-red-600 font-semibold";
  else if (days >= 30) className = "text-yellow-600 font-semibold";
  return { display: String(days), className };
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProjectsPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const spRaw = await searchParams;

  // Load user preferences for default sorting
  const userPreferences = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
  });

  let sp: Search = {
    sort: str(spRaw.sort) ?? userPreferences?.projectsSort ?? "standard",
    dir: (str(spRaw.dir) as "asc" | "desc") ?? (userPreferences?.projectsSortDir as "asc" | "desc") ?? "desc",
    q: str(spRaw.q) ?? "",
    status: arr(spRaw.status),
    priority: arr(spRaw.priority),
    cms: arr(spRaw.cms),
    agent: arr(spRaw.agent),
    page: str(spRaw.page) ?? "1",
    ps: str(spRaw.ps) ?? "50",
    scope: str(spRaw.scope) ?? undefined,
    overdue: str(spRaw.overdue) ?? undefined,
    client: str(spRaw.client) ?? undefined,
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

  const role = session.user.role!;
  const canEdit = ["ADMIN", "AGENT"].includes(role);
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

  const [projects, agentsAll, agentsActive, total] = await Promise.all([
    prisma.project.findMany({ where, include: { client: true, website: true, agent: true }, orderBy, skip, take: pageSize }),
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
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(total, skip + projects.length);

  const mkSort = (key: string) => makeSortHref({ current: sp, key });
  const mkPageHref = (p: number) => makePageHref({ current: sp, page: p });
  const mkPageSizeHref = (s: number) => makePageSizeHref({ current: sp, size: s });
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
  const pStatusOptions = ["NONE", "BEENDET", "MMW", "VOLLST_A_K"].map((v) => ({ value: v, label: labelForProductionStatus(v) }));
  const seoOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForSeoStatus(v) }));
  const textitOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForTextitStatus(v) }));

  return (
    <div className="p-6 space-y-6">
      {/* Modern Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Webseitenprojekte</h1>
            <p className="text-blue-100 text-sm mt-1">{total} {total === 1 ? 'Projekt' : 'Projekte'} gesamt</p>
          </div>
          {role === "ADMIN" && session.user.role === "ADMIN" && (
            <DangerActionButton action={deleteAllProjects} confirmText="Wirklich ALLE Projekte dauerhaft löschen?">ALLE Projekte löschen</DangerActionButton>
          )}
        </div>
      </div>

      {/* Filter */}
<div className="rounded-2xl border border-blue-200 bg-white shadow-sm">
  <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 rounded-t-2xl">
    <h2 className="text-sm font-semibold text-blue-900">Filter & Suche</h2>
  </div>
    <div className="p-6">
    <form method="get" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="sort" value={sp.sort} />
      {scopeActive && <input type="hidden" name="scope" value="active" />}
      {sp.client && <input type="hidden" name="client" value={sp.client} />}
      {sp.overdue === "1" && <input type="hidden" name="overdue" value="1" />}

      <div className="flex flex-col gap-1 w-48 shrink-0">
        <label className="text-[11px] uppercase tracking-wide text-gray-500">Kunde suchen</label>
        <input name="q" defaultValue={sp.q} placeholder="Kundennr. oder Name" className="px-2 py-1 text-xs border rounded" />
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
        <label className="text-[11px] uppercase tracking-wide text-gray-500">Reihenfolge</label>
        <select name="dir" defaultValue={sp.dir} className="px-2 py-1 text-xs border rounded">
          <option value="asc">aufsteigend</option>
          <option value="desc">absteigend</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-colors shadow-sm" type="submit">Anwenden</button>
        <Link href="/projects" className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">Zurücksetzen</Link>
        <button type="submit" name="standardSort" value="1" className="px-4 py-2 text-xs font-medium rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 transition-colors">Standardsortierung</button>
        <SaveSortButton type="projects" currentSort={sp.sort!} currentDir={sp.dir!} />
      </div>
    </form>
  </div>
</div>

      {renderPagination("mt-4")}
      <div className="overflow-x-auto rounded-2xl border border-purple-200 shadow-sm bg-white">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <Th href={mkSort("status")} active={sp.sort==="status"} dir={sp.dir}>Status</Th>
              <Th href={mkSort("customerNo")} active={sp.sort==="customerNo"} dir={sp.dir} width={120}>Kundennr.</Th>
              <Th href={mkSort("clientName")} active={sp.sort==="clientName"} dir={sp.dir} width={200}>Kunde</Th>
              <Th href={mkSort("domain")} active={sp.sort==="domain"} dir={sp.dir}>Domain</Th>
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
              <Th>Arbeitstage</Th>
              <Th href={mkSort("seo")} active={sp.sort==="seo"} dir={sp.dir}>SEO</Th>
              <Th href={mkSort("textit")} active={sp.sort==="textit"} dir={sp.dir}>Textit</Th>
              <Th href={mkSort("accessible")} active={sp.sort==="accessible"} dir={sp.dir}>Barrierefrei</Th>
              <Th href={mkSort("note")} active={sp.sort==="note"} dir={sp.dir}>Hinweis</Th>
              <Th href={mkSort("updatedAt")} active={sp.sort==="updatedAt"} dir={sp.dir}>Aktualisiert</Th>
              <Th>Aktionen</Th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
            {projects.map((p) => {
              const materialStatus = (p.website?.materialStatus ?? "ANGEFORDERT") as MaterialStatus;
              const workdayInfo = getRemainingWorkdays(materialStatus, p.website?.lastMaterialAt, p.website?.demoDate);
              const materialStatusClass = materialStatus === "VOLLSTAENDIG" ? "bg-green-100 px-2 py-1 rounded" : undefined;
              const hasAgent = Boolean(p.agent);
              const badgeClass = hasAgent ? (p.agent?.color ? AGENT_BADGE_BASE_CLASS : AGENT_BADGE_EMPTY_CLASS) : undefined;
              const badgeStyle = hasAgent ? agentBadgeStyle(p.agent?.color) : undefined;

              // Determine agent display name and effective ID based on isWTAssignment
              const isWTAssignment = p.website?.isWTAssignment ?? false;
              const agentDisplayName = getAgentDisplayName(p.agentId, isWTAssignment, agentsAll);
              const effectiveAgentId = getEffectiveAgentId(p.agentId, isWTAssignment);

              const ended = (p.website?.pStatus ?? "") === "BEENDET";
              const derivedStatus = deriveProjectStatus({
                pStatus: p.website?.pStatus,
                webDate: p.website?.webDate,
                demoDate: p.website?.demoDate,
                onlineDate: p.website?.onlineDate,
                materialStatus: p.website?.materialStatus,
              });
              const statusLabel = labelForProjectStatus(derivedStatus, { pStatus: p.website?.pStatus });
              const clientInactive = p.client?.workStopped || p.client?.finished;
              const isOnline = derivedStatus === "ONLINE";
              const relevantDate = relevantWebsiteDate(derivedStatus, p.website ?? undefined);
              const isStale =
                !ended &&
                !clientInactive &&
                !isOnline &&
                isOlderThan4Weeks(relevantDate);

              // Check if status should have green background
              const isUmsetzung = derivedStatus === "UMSETZUNG";
              const textitReady = p.website?.textit === "JA_JA" || p.website?.textit === "NEIN";
              const seoReady = p.website?.seo === "NEIN" || p.website?.seo === "JA_NEIN" || p.website?.seo === "JA_JA";
              const statusGreen = isUmsetzung && textitReady && seoReady;

              const rowClasses = ["border-t", "border-purple-100", "transition-colors", "hover:bg-purple-50/50"];
              if (isStale) rowClasses.push("bg-red-50", "hover:bg-red-100/50");
              if (ended) rowClasses.push("opacity-60");
              return (
                <tr key={p.id} className={rowClasses.join(" ")}>
                  <td className={statusGreen ? "bg-green-100 font-semibold rounded-lg" : ""}>
                    <span className={statusGreen ? "inline-flex items-center px-2 py-1 rounded-md bg-green-200 text-green-900 text-xs font-semibold" : ""}>{statusLabel}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {p.client?.customerNo ? (
                        <Link href={`/clients/${p.clientId}`} className="underline text-blue-600 hover:text-blue-800">
                          {p.client.customerNo}
                        </Link>
                      ) : (
                        <span>-</span>
                      )}
                      {p.client?.workStopped && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                          ARBEITSSTOPP
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate" title={p.client?.name ?? ""}>{p.client?.name ?? "-"}</td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="domain" type="text" display={p.website?.domain ?? "-"} value={p.website?.domain ?? ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="priority" type="select" display={labelForWebsitePriority(p.website?.priority)} value={p.website?.priority ?? "NONE"} options={priorityOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="pStatus" type="select" display={labelForProductionStatus(p.website?.pStatus)} value={p.website?.pStatus ?? "NONE"} options={pStatusOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="cms" type="select" display={p.website?.cms === "SHOPWARE" ? "Shop" : p.website?.cms ?? "-"} value={p.website?.cms ?? ""} options={cmsOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="project" id={p.id} name="agentId" type="select" display={agentDisplayName} value={effectiveAgentId} options={agentOptions} canEdit={canEdit} displayClassName={badgeClass} displayStyle={badgeStyle} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="webDate" type="datetime-with-type" display={fmtDateTime(p.website?.webDate)} value={p.website?.webDate ? new Date(p.website.webDate).toISOString() : ""} extraValue={p.website?.webterminType ?? ""} canEdit={canEdit} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="demoDate" type="date" display={fmtDate(p.website?.demoDate)} value={p.website?.demoDate ? new Date(p.website.demoDate).toISOString().slice(0, 10) : ""} canEdit={canEdit} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="onlineDate" type="date" display={fmtDate(p.website?.onlineDate)} value={p.website?.onlineDate ? new Date(p.website.onlineDate).toISOString().slice(0, 10) : ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="materialStatus" type="select" display={labelForMaterialStatus(materialStatus)} value={materialStatus} options={materialStatusOptions} canEdit={canEdit} displayClassName={materialStatusClass} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="lastMaterialAt" type="date" display={fmtDate(p.website?.lastMaterialAt)} value={p.website?.lastMaterialAt ? new Date(p.website.lastMaterialAt).toISOString().slice(0, 10) : ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="effortBuildMin" type="number" display={mm(p.website?.effortBuildMin)} value={p.website?.effortBuildMin != null ? p.website.effortBuildMin / 60 : ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="effortDemoMin" type="number" display={mm(p.website?.effortDemoMin)} value={p.website?.effortDemoMin != null ? p.website.effortDemoMin / 60 : ""} canEdit={canEdit} /></td>
                  <td className={workdayInfo.className}>{workdayInfo.display}</td>
                  <td><InlineCell target="website" id={p.id} name="seo" type="select" display={labelForSeoStatus(p.website?.seo)} value={p.website?.seo ?? ""} options={seoOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="textit" type="select" display={labelForTextitStatus(p.website?.textit)} value={p.website?.textit ?? ""} options={textitOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="accessible" type="tri" display={p.website?.accessible == null ? "-" : p.website?.accessible ? "Ja" : "Nein"} value={p.website?.accessible ?? null} canEdit={canEdit} /></td>
                  <td className="align-top"><InlineCell target="website" id={p.id} name="note" type="textarea" display={p.website?.note ?? ""} value={p.website?.note ?? ""} canEdit={canEdit} displayClassName="block whitespace-pre-wrap" /></td>
                  <td className="whitespace-nowrap">{fmtDate(p.updatedAt)}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${p.id}`} className="underline">Details</Link>
                      {role === "ADMIN" && (
                        <form action={deleteProject}>
                          <input type="hidden" name="projectId" value={p.id} />
                          <ConfirmSubmit
                            confirmText="Dieses Projekt unwiderruflich löschen?"
                            className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50"
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span className="sr-only">Projekt löschen</span>
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (<tr><td colSpan={22} className="py-10 text-center opacity-60">Keine Webseitenprojekte gefunden.</td></tr>)}
          </tbody>
        </table>
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
  if (current.priority && current.priority.length) for (const v of current.priority) p.append("priority", v);
  if (current.cms && current.cms.length) for (const v of current.cms) p.append("cms", v);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.ps) p.set("ps", current.ps);
  if (current.page) p.set("page", current.page);
  if (current.scope) p.set("scope", current.scope);
  if (current.client) p.set("client", current.client);
  if (current.overdue === "1") p.set("overdue", "1");
  return `/projects?${p.toString()}`;
}

function makePageHref({ current, page }: { current: Search; page: number }) {
  const p = new URLSearchParams();
  if (current.sort) p.set("sort", current.sort);
  if (current.dir) p.set("dir", current.dir);
  if (current.q) p.set("q", current.q);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.priority && current.priority.length) for (const v of current.priority) p.append("priority", v);
  if (current.cms && current.cms.length) for (const v of current.cms) p.append("cms", v);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.ps) p.set("ps", current.ps);
  if (current.scope) p.set("scope", current.scope);
  if (current.client) p.set("client", current.client);
  if (current.overdue === "1") p.set("overdue", "1");
  p.set("page", String(page));
  return `/projects?${p.toString()}`;
}

function makePageSizeHref({ current, size }: { current: Search; size: number }) {
  const p = new URLSearchParams();
  if (current.sort) p.set("sort", current.sort);
  if (current.dir) p.set("dir", current.dir);
  if (current.q) p.set("q", current.q);
  if (current.status && current.status.length) for (const v of current.status) p.append("status", v);
  if (current.priority && current.priority.length) for (const v of current.priority) p.append("priority", v);
  if (current.cms && current.cms.length) for (const v of current.cms) p.append("cms", v);
  if (current.agent && current.agent.length) for (const v of current.agent) p.append("agent", v);
  if (current.scope) p.set("scope", current.scope);
  if (current.client) p.set("client", current.client);
  if (current.overdue === "1") p.set("overdue", "1");
  p.set("ps", String(size));
  p.set("page", "1");
  return `/projects?${p.toString()}`;
}
function Th(props: { href?: string; active?: boolean; dir?: "asc" | "desc"; children: React.ReactNode; width?: number }) {
  const { href, active, dir, children, width } = props;
const arrow = active ? (dir === "desc" ? " ↓" : " ↑") : "";
  const className = "px-3 py-2 text-left";
  if (!href) return <th style={width ? { width } : undefined} className={className}>{children}</th>;
  return (
    <th style={width ? { width } : undefined} className={className}>
      <Link href={href} className="underline">{children} {arrow}</Link>
    </th>
  );
}





































