import Link from "next/link";
import type { CSSProperties } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import InlineCell from "@/components/InlineCell";
import DangerActionButton from "@/components/DangerActionButton";
import { deleteAllProjects } from "./actions";
import {
  buildWebsiteStatusWhere,
  deriveProjectStatus,
  labelForProjectStatus,
  labelForProductionStatus,
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
};

const STATUSES = ["WEBTERMIN", "MATERIAL", "UMSETZUNG", "DEMO", "ONLINE"] as const;
const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "WORDPRESS", "JOOMLA", "LOGO", "PRINT", "CUSTOM", "OTHER"] as const;

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";

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

const getRemainingWorkdays = (
  status: Prisma.$Enums.MaterialStatus | null | undefined,
  lastMaterialAt: Date | string | null | undefined,
) => {
  if (status !== "VOLLSTAENDIG" || !lastMaterialAt) {
    return { display: "-", className: undefined as string | undefined };
  }
  const start = startOfDay(new Date(lastMaterialAt));
  if (Number.isNaN(start.getTime())) {
    return { display: "-", className: undefined };
  }
  const today = startOfDay(new Date());
  let days = workingDaysBetween(start, today);
  if (days < 0) days = 0;

  let className: string | undefined;
  if (days >= 60) className = "bg-red-200 text-yellow-900 font-semibold px-2 py-0.5 rounded";
  else if (days >= 50) className = "text-red-600 font-semibold";
  else if (days >= 30) className = "text-yellow-600 font-semibold";
  return { display: String(days), className };
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProjectsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const spRaw = await searchParams;
  let sp: Search = {
    sort: str(spRaw.sort) ?? "customerNo",
    dir: (str(spRaw.dir) as "asc" | "desc") ?? "asc",
    q: str(spRaw.q) ?? "",
    status: arr(spRaw.status),
    priority: arr(spRaw.priority),
    cms: arr(spRaw.cms),
    agent: arr(spRaw.agent),
    page: str(spRaw.page) ?? "1",
    ps: str(spRaw.ps) ?? "50",
    scope: str(spRaw.scope) ?? undefined,
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

  const where: Prisma.ProjectWhereInput = {};
  if (role === "CUSTOMER") {
    if (!clientId) redirect("/");
    where.clientId = clientId!;
  }
  if (scopeActive) {
    (where.AND ??= []).push({
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
    where.client = { is: { customerNo: { contains: sp.q, mode: "insensitive" } } };
  }
  if (sp.status && sp.status.length > 0) {
    const now = new Date();
    const statusFilters: Prisma.ProjectWhereInput[] = [];
    const uniqueStatuses = Array.from(new Set(sp.status));

    for (const statusValue of uniqueStatuses) {
      if (statusValue !== "BEENDET" && !(STATUSES as readonly string[]).includes(statusValue)) continue;

      const statusKey = (statusValue === "BEENDET"
        ? "BEENDET"
        : statusValue) as DerivedStatusFilter;
      const websiteWhere = buildWebsiteStatusWhere(statusKey, now);
      const orParts: Prisma.ProjectWhereInput[] = [];
      if (websiteWhere) {
        orParts.push(
          scopeActive
            ? {
                AND: [
                  websiteWhere,
                  {
                    type: "WEBSITE",
                    website: { is: { pStatus: { notIn: DONE_PRODUCTION_STATUSES } } },
                  },
                ],
              }
            : websiteWhere,
        );
      }

      if ((STATUSES as readonly string[]).includes(statusValue)) {
        orParts.push({
          AND: [
            { type: { not: "WEBSITE" } },
            { status: statusValue as Prisma.ProjectStatus },
          ],
        });
      } else if (statusValue === "BEENDET") {
        orParts.push({
          AND: [
            { type: { not: "WEBSITE" } },
            { status: "ONLINE" as Prisma.ProjectStatus },
          ],
        });
      }

      if (orParts.length === 1) statusFilters.push(orParts[0]);
      else if (orParts.length > 1) statusFilters.push({ OR: orParts });
    }

    if (statusFilters.length > 0) {
      (where.AND ??= []).push({ OR: statusFilters });
    }
  }
  const websiteFilters: Prisma.ProjectWebsiteWhereInput = {};
  if (sp.priority && sp.priority.length > 0) {
    const vals = sp.priority.filter((p) => (PRIORITIES as readonly string[]).includes(p));
    if (vals.length > 0) websiteFilters.priority = { in: vals as Prisma.WebsitePriority[] };
  }
  if (sp.cms && sp.cms.length > 0) {
    const vals = sp.cms.filter((c) => (CMS as readonly string[]).includes(c));
    if (vals.length > 0) websiteFilters.cms = { in: vals as Prisma.CMS[] };
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
      if (orParts.length > 0) (where.AND ??= []).push({ OR: orParts });
    }
  }

  const orderBy = mapOrderBy(sp.sort!, sp.dir!);
  const pageSize = sp.ps === "100" ? 100 : 50;
  const page = Math.max(1, Number.parseInt(sp.page || "1") || 1);
  const skip = (page - 1) * pageSize;

  const [projects, agentsAll, agentsActive, total] = await Promise.all([
    prisma.project.findMany({ where, include: { client: true, website: true, agent: true }, orderBy, skip, take: pageSize }),
    prisma.user.findMany({ where: { role: "AGENT" }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "AGENT", active: true }, orderBy: { name: "asc" } }),
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
          <Link href={mkPageHref(Math.max(1, page - 1))} className={page === 1 ? "pointer-events-none opacity-50" : "underline"}>Zurueck</Link>
          <span>Seite {page} / {totalPages}</span>
          <Link href={mkPageHref(Math.min(totalPages, page + 1))} className={page >= totalPages ? "pointer-events-none opacity-50" : "underline"}>Weiter</Link>
        </div>
      </div>
    );
  };

  const agentOptions = [
    { value: "", label: "- ohne Agent -" },
    ...agentsAll.flatMap((a) => {
      const base = a.name ?? a.email;
      return [
        { value: a.id, label: base },
        { value: a.id, label: `${base} WT` },
      ];
    }),
  ];
  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: labelForWebsitePriority(p) }));
  const cmsOptions = CMS.map((c) => ({ value: c, label: c }));
  const pStatusOptions = ["NONE", "BEENDET", "MMW", "VOLLST_A_K"].map((v) => ({ value: v, label: labelForProductionStatus(v) }));
  const seoOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForSeoStatus(v) }));
  const textitOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForTextitStatus(v) }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Webseitenprojekte</h1>
        {canEdit && (<Link href="/projects/new" className="px-3 py-1.5 rounded bg-black text-white">Neues Projekt</Link>)}
        {role === "ADMIN" && (
          <DangerActionButton action={deleteAllProjects} confirmText="Wirklich ALLE Projekte dauerhaft löschen?">ALLE Projekte löschen</DangerActionButton>
        )}
      </div>

      {/* Filter */}
<div className="rounded-lg border">
  <div className="px-4 py-2 text-sm font-medium bg-gray-50 border-b">Filter</div>
    <div className="p-4">
    <form method="get" className="flex flex-wrap items-end gap-2 p-4 border rounded-lg">
      <input type="hidden" name="sort" value={sp.sort} />
      {scopeActive && <input type="hidden" name="scope" value="active" />}

      <div className="flex flex-col gap-1 w-48 shrink-0">
        <label className="text-[11px] uppercase tracking-wide text-gray-500">Kundennr. suchen</label>
        <input name="q" defaultValue={sp.q} placeholder="z. B. K1023" className="px-2 py-1 text-xs border rounded" />
      </div>

      <details className="relative w-44 shrink-0">
        <summary className="flex items-center justify-between px-2 py-1 text-xs border rounded bg-white cursor-pointer select-none shadow-sm [&::-webkit-details-marker]:hidden">
          <span>Status</span>
          <span className="opacity-70">
            {sp.status && sp.status.length ? `${sp.status.length} ausgewaehlt` : "Alle"}
          </span>
        </summary>
        <div className="absolute left-0 z-10 mt-1 w-60 rounded border bg-white shadow-lg max-h-56 overflow-auto p-2">
          <div className="grid grid-cols-2 gap-1 text-xs">
            {STATUSES.map((s) => (
              <label key={s} className="inline-flex items-center gap-2">
                <input type="checkbox" name="status" value={s} defaultChecked={sp.status?.includes(s)} />
                <span>{labelForProjectStatus(s as Prisma.ProjectStatus)}</span>
              </label>
            ))}
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="status" value="BEENDET" defaultChecked={sp.status?.includes("BEENDET")} />
              <span>Beendet</span>
            </label>
          </div>
        </div>
      </details>

      <details className="relative w-40 shrink-0">
        <summary className="flex items-center justify-between px-2 py-1 text-xs border rounded bg-white cursor-pointer select-none shadow-sm [&::-webkit-details-marker]:hidden">
          <span>Prio</span>
          <span className="opacity-70">
            {sp.priority && sp.priority.length ? `${sp.priority.length} ausgewaehlt` : "Alle"}
          </span>
        </summary>
        <div className="absolute left-0 z-10 mt-1 w-52 rounded border bg-white shadow-lg max-h-56 overflow-auto p-2">
          <div className="grid grid-cols-2 gap-1 text-xs">
            {PRIORITIES.map((p) => (
              <label key={p} className="inline-flex items-center gap-2">
                <input type="checkbox" name="priority" value={p} defaultChecked={sp.priority?.includes(p)} />
                <span>{labelForWebsitePriority(p)}</span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <details className="relative w-40 shrink-0">
        <summary className="flex items-center justify-between px-2 py-1 text-xs border rounded bg-white cursor-pointer select-none shadow-sm [&::-webkit-details-marker]:hidden">
          <span>CMS</span>
          <span className="opacity-70">
            {sp.cms && sp.cms.length ? `${sp.cms.length} ausgewaehlt` : "Alle"}
          </span>
        </summary>
        <div className="absolute left-0 z-10 mt-1 w-52 rounded border bg-white shadow-lg max-h-56 overflow-auto p-2">
          <div className="grid grid-cols-2 gap-1 text-xs">
            {CMS.map((c) => (
              <label key={c} className="inline-flex items-center gap-2">
                <input type="checkbox" name="cms" value={c} defaultChecked={sp.cms?.includes(c)} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <details className="relative w-52 shrink-0">
        <summary className="flex items-center justify-between px-2 py-1 text-xs border rounded bg-white cursor-pointer select-none shadow-sm [&::-webkit-details-marker]:hidden">
          <span>Agent</span>
          <span className="opacity-70">
            {!sp.agent || sp.agent.length === 0 || sp.agent.includes("alle")
              ? "Alle"
              : (sp.agent.length === 1 && sp.agent.includes("none") ? "Ohne Agent" : `${sp.agent.length} ausgewaehlt`)}
          </span>
        </summary>
        <div className="absolute left-0 z-10 mt-1 w-64 rounded border bg-white shadow-lg max-h-56 overflow-auto p-2">
          <div className="grid grid-cols-2 gap-1 text-xs">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="agent" value="alle" defaultChecked={(sp.agent ?? []).length === 0 || sp.agent?.includes("alle")} />
              <span>Alle</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="agent" value="none" defaultChecked={sp.agent?.includes("none")} />
              <span>Ohne Agent</span>
            </label>
            {agentsActive.map((a) => (
              <label key={a.id} className="inline-flex items-center gap-2">
                <input type="checkbox" name="agent" value={a.id} defaultChecked={sp.agent?.includes(a.id)} />
                <span>{a.name ?? a.email}</span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <div className="flex flex-col gap-1 w-36 shrink-0">
        <label className="text-[11px] uppercase tracking-wide text-gray-500">Reihenfolge</label>
        <select name="dir" defaultValue={sp.dir} className="px-2 py-1 text-xs border rounded">
          <option value="asc">aufsteigend</option>
          <option value="desc">absteigend</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" name="standardSort" value="1" className="px-3 py-1 text-xs rounded border bg-white">Standardsortierung</button>
        <button className="px-3 py-1 text-xs rounded bg-black text-white" type="submit">Anwenden</button>
        <Link href="/projects" className="px-3 py-1 text-xs rounded border">Zuruecksetzen</Link>
      </div>
    </form>
  </div>
</div>

      {renderPagination("mt-4")}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <Th href={mkSort("status")} active={sp.sort==="status"} dir={sp.dir}>Status</Th>
              <Th href={mkSort("customerNo")} active={sp.sort==="customerNo"} dir={sp.dir} width={120}>Kundennr.</Th>
              <Th href={mkSort("clientName")} active={sp.sort==="clientName"} dir={sp.dir} width={280}>Kunde</Th>
              <Th href={mkSort("title")} active={sp.sort==="title"} dir={sp.dir}>Projekt</Th>
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
              <Th href={mkSort("updatedAt")} active={sp.sort==="updatedAt"} dir={sp.dir}>Aktualisiert</Th>
              <Th>Aktionen</Th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
            {projects.map((p) => {
              const materialStatus = p.website?.materialStatus ?? "ANGEFORDERT";
              const workdayInfo = getRemainingWorkdays(materialStatus, p.website?.lastMaterialAt);
              const hasAgent = Boolean(p.agent);
              const badgeClass = hasAgent ? (p.agent?.color ? AGENT_BADGE_BASE_CLASS : AGENT_BADGE_EMPTY_CLASS) : undefined;
              const badgeStyle = hasAgent ? agentBadgeStyle(p.agent?.color) : undefined;
              const ended = (p.website?.pStatus ?? "") === "BEENDET";
              const derivedStatus = deriveProjectStatus({
                pStatus: p.website?.pStatus,
                webDate: p.website?.webDate,
                demoDate: p.website?.demoDate,
                onlineDate: p.website?.onlineDate,
                materialStatus: p.website?.materialStatus,
              });
              const statusLabel = labelForProjectStatus(derivedStatus, { pStatus: p.website?.pStatus });
              return (
                <tr key={p.id} className={"border-t " + (ended ? "opacity-60" : "")}>
                  <td>{statusLabel}</td>
                  <td className="whitespace-nowrap">{p.client?.customerNo ?? "-"}</td>
                  <td className="whitespace-nowrap">{p.client?.name ?? "-"}</td>
                  <td className="font-medium"><Link className="underline" href={`/projects/${p.id}`}>{p.title}</Link></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="domain" type="text" display={p.website?.domain ?? "-"} value={p.website?.domain ?? ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="priority" type="select" display={labelForWebsitePriority(p.website?.priority)} value={p.website?.priority ?? "NONE"} options={priorityOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="pStatus" type="select" display={labelForProductionStatus(p.website?.pStatus)} value={p.website?.pStatus ?? "NONE"} options={pStatusOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="cms" type="select" display={p.website?.cms ?? "-"} value={p.website?.cms ?? ""} options={cmsOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="project" id={p.id} name="agentId" type="select" display={p.agent?.name ?? "-"} value={p.agentId ?? ""} options={agentOptions} canEdit={canEdit} displayClassName={badgeClass} displayStyle={badgeStyle} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="webDate" type="date" display={fmtDate(p.website?.webDate)} value={p.website?.webDate ?? ""} canEdit={canEdit} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="demoDate" type="date" display={fmtDate(p.website?.demoDate)} value={p.website?.demoDate ?? ""} canEdit={canEdit} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="onlineDate" type="date" display={fmtDate(p.website?.onlineDate)} value={p.website?.onlineDate ?? ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="materialStatus" type="select" display={p.website?.materialStatus ?? "-"} value={p.website?.materialStatus ?? "ANGEFORDERT"} options={Object.entries({ ANGEFORDERT: "angefordert", TEILWEISE: "teilweise", VOLLSTAENDIG: "Vollst�ndig", NV: "N.V." }).map(([value, label]) => ({ value, label }))} canEdit={canEdit} /></td>
                  <td className="whitespace-nowrap"><InlineCell target="website" id={p.id} name="lastMaterialAt" type="date" display={fmtDate(p.website?.lastMaterialAt)} value={p.website?.lastMaterialAt ?? ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="effortBuildMin" type="number" display={mm(p.website?.effortBuildMin)} value={p.website?.effortBuildMin != null ? p.website.effortBuildMin / 60 : ""} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="effortDemoMin" type="number" display={mm(p.website?.effortDemoMin)} value={p.website?.effortDemoMin != null ? p.website.effortDemoMin / 60 : ""} canEdit={canEdit} /></td>
                  <td className={workdayInfo.className}>{workdayInfo.display}</td>
                  <td><InlineCell target="website" id={p.id} name="seo" type="select" display={labelForSeoStatus(p.website?.seo)} value={p.website?.seo ?? ""} options={seoOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="textit" type="select" display={labelForTextitStatus(p.website?.textit)} value={p.website?.textit ?? ""} options={textitOptions} canEdit={canEdit} /></td>
                  <td><InlineCell target="website" id={p.id} name="accessible" type="tri" display={p.website?.accessible == null ? "-" : p.website?.accessible ? "Ja" : "Nein"} value={p.website?.accessible ?? null} canEdit={canEdit} /></td>
                  <td className="whitespace-nowrap">{fmtDate(p.updatedAt)}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/projects/${p.id}`} className="underline mr-3">Details</Link>
                    {canEdit && <Link href={`/projects/${p.id}/edit`} className="underline">Bearbeiten</Link>}
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
    case "updatedAt": return [{ updatedAt: direction }];
    default: return def;
  }
}

function makeSortHref({ current, key }: { current: Search; key: string }) {
  const p = new URLSearchParams();
  const nextDir: "asc" | "desc" = current.sort === key ? (current.dir === "asc" ? "desc" : "asc") : "asc";
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
  p.set("ps", String(size));
  p.set("page", "1");
  return `/projects?${p.toString()}`;
}

function Th(props: { href?: string; active?: boolean; dir?: "asc" | "desc"; children: React.ReactNode; width?: number }) {
  const { href, active, dir, children, width } = props;
  const arrow = active ? (dir === "desc" ? "v" : "^") : "";
  const className = "px-3 py-2 text-left";
  if (!href) return <th style={width ? { width } : undefined} className={className}>{children}</th>;
  return (
    <th style={width ? { width } : undefined} className={className}>
      <Link href={href} className="underline">{children} {arrow}</Link>
    </th>
  );
}











