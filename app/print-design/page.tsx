import type { Prisma, PrintDesignType, ProductionStatus } from "@prisma/client";
import type { CSSProperties, SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CheckboxFilterGroup from "@/components/CheckboxFilterGroup";
import { SaveFilterButton } from "@/components/SaveFilterButton";
import PrintDesignInlineCell from "@/components/PrintDesignInlineCell";
import {
  derivePrintDesignStatus,
  getPrintDesignStatusDate,
  PRINT_DESIGN_STATUS_LABELS,
  PRINT_DESIGN_TYPE_LABELS,
  type PrintDesignStatus,
} from "@/lib/print-design-status";

type Search = {
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  agent?: string[];
  status?: string[];
  projectType?: string[];
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

const P_STATUS_LABELS: Record<ProductionStatus, string> = {
  NONE: "-",
  BEENDET: "beendet",
  MMW: "MMW",
  VOLLST_A_K: "vollst. a.K.",
};

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

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    const dateStr = typeof value === "string" ? value : value.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    const dateStr = typeof value === "string" ? value : value.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";

    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

const labelForProjectType = (value?: PrintDesignType | null) => {
  if (!value) return "-";
  return PRINT_DESIGN_TYPE_LABELS[value] ?? value;
};

const labelForPStatus = (value?: ProductionStatus | null) => {
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

const PROJECT_TYPE_OPTIONS = (Object.keys(PRINT_DESIGN_TYPE_LABELS) as PrintDesignType[]).map(
  (value) => ({
    value,
    label: PRINT_DESIGN_TYPE_LABELS[value],
  })
);

const STATUS_OPTIONS = (Object.keys(PRINT_DESIGN_STATUS_LABELS) as PrintDesignStatus[]).map(
  (value) => ({
    value,
    label: PRINT_DESIGN_STATUS_LABELS[value],
  })
);

type PrintDesignProjectRow = {
  id: string;
  customerNo: string;
  clientName: string;
  projectType: string;
  agent: string;
  agentColor?: string | null;
  webtermin: string;
  implementation: string;
  designToClient: string;
  designApproval: string;
  finalVersionToClient: string;
  printRequired: boolean;
  printOrderPlaced: string;
  printProvider: string;
  status: string;
  statusKey: PrintDesignStatus;
  pStatus: string;
  note: string;
  isStale: boolean;
  updatedAt: string;
};

const buildRows = (
  projects: Awaited<ReturnType<typeof loadPrintDesignProjects>>
): PrintDesignProjectRow[] => {
  return projects.map((project) => {
    const printDesign = project.printDesign;
    const agentName = project.agent?.name?.trim();
    const noteText = printDesign?.note?.trim() ?? project.important?.trim();

    const derivedStatus: PrintDesignStatus = printDesign
      ? derivePrintDesignStatus({
          status: printDesign.pStatus,
          webtermin: printDesign.webtermin,
          implementation: printDesign.implementation,
          designToClient: printDesign.designToClient,
          designApproval: printDesign.designApproval,
          finalVersionToClient: printDesign.finalVersionToClient,
          printRequired: printDesign.printRequired,
          printOrderPlaced: printDesign.printOrderPlaced,
        })
      : "WEBTERMIN";

    const pStatus = printDesign?.pStatus ?? project.status;

    const statusDate = printDesign
      ? getPrintDesignStatusDate(derivedStatus, printDesign)
      : null;
    const updatedDate = toDate(project.updatedAt);
    const effectiveDate = statusDate ?? updatedDate;
    const isActiveProject = !printDesign?.pStatus || printDesign.pStatus !== "BEENDET";
    const isStale = isActiveProject && isOlderThan4Weeks(effectiveDate);

    return {
      id: project.id,
      customerNo: project.client?.customerNo?.trim() || "-",
      clientName: project.client?.name?.trim() || "Kunde unbekannt",
      projectType: labelForProjectType(printDesign?.projectType ?? undefined),
      agent: agentName && agentName.length > 0 ? agentName : "-",
      agentColor: project.agent?.color,
      webtermin: formatDateTime(printDesign?.webtermin ?? undefined),
      implementation: formatDate(printDesign?.implementation ?? undefined),
      designToClient: formatDate(printDesign?.designToClient ?? undefined),
      designApproval: formatDate(printDesign?.designApproval ?? undefined),
      finalVersionToClient: formatDate(printDesign?.finalVersionToClient ?? undefined),
      printRequired: printDesign?.printRequired ?? false,
      printOrderPlaced: formatDate(printDesign?.printOrderPlaced ?? undefined),
      printProvider: printDesign?.printProvider?.trim() || "-",
      status: PRINT_DESIGN_STATUS_LABELS[derivedStatus],
      statusKey: derivedStatus,
      pStatus: labelForPStatus(pStatus as ProductionStatus),
      note: noteText && noteText.length > 0 ? noteText : "-",
      isStale,
      updatedAt: formatDate(project.updatedAt),
    };
  });
};

async function loadPrintDesignProjects(
  searchQuery?: string,
  agents?: string[],
  printDesignStatuses?: string[],
  projectTypes?: string[],
  orderBy?: Prisma.ProjectOrderByWithRelationInput[]
) {
  const whereConditions: Prisma.ProjectWhereInput[] = [
    {
      printDesign: {
        isNot: null,
      },
    },
  ];

  if (searchQuery) {
    whereConditions.push({
      client: {
        OR: [
          { customerNo: { contains: searchQuery, mode: "insensitive" } },
          { name: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
    });
  }

  if (agents && agents.length > 0) {
    const hasNone = agents.includes("none");
    const ids = agents.filter((a) => a !== "none");
    const orParts: Prisma.ProjectWhereInput[] = [];
    if (ids.length > 0) orParts.push({ agentId: { in: ids } });
    if (hasNone) orParts.push({ agentId: null });
    if (orParts.length > 0) {
      whereConditions.push({ OR: orParts });
    }
  }

  if (projectTypes && projectTypes.length > 0) {
    whereConditions.push({
      printDesign: {
        is: {
          projectType: { in: projectTypes as PrintDesignType[] },
        },
      },
    });
  }

  const where: Prisma.ProjectWhereInput =
    whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions };

  let projects = await prisma.project.findMany({
    where,
    orderBy: orderBy ?? [{ client: { name: "asc" } }, { title: "asc" }],
    include: {
      client: {
        select: {
          id: true,
          name: true,
          customerNo: true,
          workStopped: true,
          finished: true,
        },
      },
      agent: { select: { id: true, name: true, color: true } },
      printDesign: true,
    },
  });

  // Filter by derived print design status if requested
  if (printDesignStatuses && printDesignStatuses.length > 0) {
    projects = projects.filter((project) => {
      const derivedStatus = derivePrintDesignStatus({
        status: project.printDesign?.pStatus,
        webtermin: project.printDesign?.webtermin,
        implementation: project.printDesign?.implementation,
        designToClient: project.printDesign?.designToClient,
        designApproval: project.printDesign?.designApproval,
        finalVersionToClient: project.printDesign?.finalVersionToClient,
        printRequired: project.printDesign?.printRequired,
        printOrderPlaced: project.printDesign?.printOrderPlaced,
      });
      return printDesignStatuses.includes(derivedStatus);
    });
  }

  return projects;
}

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}
function arr(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : typeof v === "string" && v !== "" ? [v] : [];
}

function mapOrderBy(
  sort: string,
  dir: "asc" | "desc"
): Prisma.ProjectOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = dir === "desc" ? "desc" : "asc";
  const def: Prisma.ProjectOrderByWithRelationInput[] = [
    { client: { customerNo: "asc" } },
    { client: { name: "asc" } },
  ];
  switch (sort) {
    case "standard":
      return [
        { printDesign: { finalVersionToClient: direction } },
        { printDesign: { designApproval: direction } },
        { printDesign: { designToClient: direction } },
        { printDesign: { implementation: direction } },
        { printDesign: { webtermin: direction } },
        { updatedAt: direction },
      ];
    case "customerNo":
      return [{ client: { customerNo: direction } }, { client: { name: "asc" } }];
    case "clientName":
      return [{ client: { name: direction } }];
    case "projectType":
      return [{ printDesign: { projectType: direction } }];
    case "agent":
      return [{ agent: { name: direction } }];
    case "webtermin":
      return [{ printDesign: { webtermin: direction } }];
    case "implementation":
      return [{ printDesign: { implementation: direction } }];
    case "designToClient":
      return [{ printDesign: { designToClient: direction } }];
    case "designApproval":
      return [{ printDesign: { designApproval: direction } }];
    case "finalVersionToClient":
      return [{ printDesign: { finalVersionToClient: direction } }];
    case "printOrderPlaced":
      return [{ printDesign: { printOrderPlaced: direction } }];
    case "updatedAt":
      return [{ updatedAt: direction }];
    default:
      return def;
  }
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PrintDesignPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session || !session.user.id) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT", "SALES"].includes(session.user.role)) {
    redirect("/");
  }

  const spRaw = await searchParams;

  const resetFilters = str(spRaw.reset) === "1";

  if (resetFilters) {
    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        printDesignAgentFilter: [],
        printDesignStatusFilter: [],
        printDesignProjectTypeFilter: [],
      },
      create: {
        userId: session.user.id,
        printDesignAgentFilter: [],
        printDesignStatusFilter: [],
        printDesignProjectTypeFilter: [],
      },
    });

    redirect("/print-design");
  }

  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
    select: {
      printDesignAgentFilter: true,
      printDesignStatusFilter: true,
      printDesignProjectTypeFilter: true,
    },
  });

  const savedAgentFilter = Array.isArray(userPrefs?.printDesignAgentFilter)
    ? (userPrefs.printDesignAgentFilter as string[])
    : [];
  const savedStatusFilter = Array.isArray(userPrefs?.printDesignStatusFilter)
    ? (userPrefs.printDesignStatusFilter as string[])
    : [];
  const savedProjectTypeFilter = Array.isArray(userPrefs?.printDesignProjectTypeFilter)
    ? (userPrefs.printDesignProjectTypeFilter as string[])
    : [];

  const sp: Search = {
    sort: str(spRaw.sort),
    dir: str(spRaw.dir) === "desc" ? "desc" : "asc",
    q: str(spRaw.q),
    agent: arr(spRaw.agent).length > 0 ? arr(spRaw.agent) : savedAgentFilter,
    status: arr(spRaw.status).length > 0 ? arr(spRaw.status) : savedStatusFilter,
    projectType:
      arr(spRaw.projectType).length > 0 ? arr(spRaw.projectType) : savedProjectTypeFilter,
    page: str(spRaw.page),
    ps: str(spRaw.ps),
  };

  const currentSort = sp.sort || "standard";
  const currentDir: "asc" | "desc" = sp.dir || "asc";
  const currentPage = parseInt(sp.page || "1", 10);
  const pageSize = sp.ps === "100" ? 100 : 50;

  const orderBy = mapOrderBy(currentSort, currentDir);

  const projects = await loadPrintDesignProjects(
    sp.q,
    sp.agent,
    sp.status,
    sp.projectType,
    orderBy
  );

  const rows = buildRows(projects);

  // Create a map from projectId to project for inline editing
  const projectsById = new Map(projects.map(p => [p.id, p]));

  const totalCount = rows.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedRows = rows.slice(startIndex, endIndex);

  const agents = await prisma.user.findMany({
    where: {
      active: true,
      categories: { has: "PRINT_DESIGN" },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, color: true },
  });

  const agentOptions = agents.map((a) => ({
    value: a.id,
    label: a.name ?? "Unnamed",
  }));
  agentOptions.push({ value: "none", label: "Kein Agent" });

  // Options for inline editing
  const agentEditOptions = [
    { value: "", label: "- kein Agent -" },
    ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];

  const P_STATUS_EDIT_LABELS = {
    NONE: "Keine",
    BEENDET: "Beendet",
    MMW: "MMW",
  } as const;

  const pStatusEditOptions = (
    Object.keys(P_STATUS_EDIT_LABELS) as (keyof typeof P_STATUS_EDIT_LABELS)[]
  ).map((value) => ({
    value,
    label: P_STATUS_EDIT_LABELS[value],
  }));

  const makeSortHref = (field: string) => {
    const newDir =
      currentSort === field && currentDir === "asc" ? "desc" : "asc";
    const params = new URLSearchParams();
    params.set("sort", field);
    params.set("dir", newDir);
    if (sp.q) params.set("q", sp.q);
    if (sp.agent) sp.agent.forEach((a) => params.append("agent", a));
    if (sp.status) sp.status.forEach((s) => params.append("status", s));
    if (sp.projectType)
      sp.projectType.forEach((t) => params.append("projectType", t));
    if (sp.ps) params.set("ps", sp.ps);
    return `/print-design?${params.toString()}`;
  };

  const makePageHref = (page: number) => {
    const params = new URLSearchParams();
    if (sp.sort) params.set("sort", sp.sort);
    if (sp.dir) params.set("dir", sp.dir);
    if (sp.q) params.set("q", sp.q);
    if (sp.agent) sp.agent.forEach((a) => params.append("agent", a));
    if (sp.status) sp.status.forEach((s) => params.append("status", s));
    if (sp.projectType)
      sp.projectType.forEach((t) => params.append("projectType", t));
    if (sp.ps) params.set("ps", sp.ps);
    params.set("page", page.toString());
    return `/print-design?${params.toString()}`;
  };

  const makePageSizeHref = (ps: number) => {
    const params = new URLSearchParams();
    if (sp.sort) params.set("sort", sp.sort);
    if (sp.dir) params.set("dir", sp.dir);
    if (sp.q) params.set("q", sp.q);
    if (sp.agent) sp.agent.forEach((a) => params.append("agent", a));
    if (sp.status) sp.status.forEach((s) => params.append("status", s));
    if (sp.projectType)
      sp.projectType.forEach((t) => params.append("projectType", t));
    params.set("ps", ps.toString());
    params.set("page", "1");
    return `/print-design?${params.toString()}`;
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) => {
    const isCurrent = currentSort === field;
    return (
      <TableHead>
        <Link
          href={makeSortHref(field)}
          className="hover:underline inline-flex items-center gap-1"
        >
          {children}
          {isCurrent && (
            <span className="text-xs">{currentDir === "asc" ? "↑" : "↓"}</span>
          )}
        </Link>
      </TableHead>
    );
  };

  const canEdit = session.user.role === "ADMIN" || session.user.role === "AGENT";

  return (
    <div className="w-full space-y-6 py-6 px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3v5a2 2 0 002 2h5m-6 10h4m-4-4h4m-10-4h.01M9 16h.01" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Print & Design</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'Projekt' : 'Projekte'} gesamt
          </p>
        </div>
        {canEdit && (
          <Link href="/print-design/new">
            <Button>Neues Projekt</Button>
          </Link>
        )}
      </div>

      {/* Filter */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Filter & Suche</CardTitle>
            <CardDescription>
              Filtern und sortieren Sie Print & Design Projekte
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="sort" value={sp.sort ?? "standard"} />
            <input type="hidden" name="submitted" value="1" />

            <div className="flex flex-col gap-1 w-48">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Kunde suchen</label>
              <input
                name="q"
                defaultValue={sp.q}
                placeholder="Kundennr. oder Name"
                className="rounded border px-2 py-1 text-xs bg-background text-foreground"
              />
            </div>

            <CheckboxFilterGroup
              name="agent"
              label="Agent"
              options={agentOptions}
              selected={sp.agent ?? []}
              width="w-48"
            />

            <CheckboxFilterGroup
              name="status"
              label="Status"
              options={STATUS_OPTIONS}
              selected={sp.status ?? []}
              width="w-44"
            />

            <CheckboxFilterGroup
              name="projectType"
              label="Art"
              options={PROJECT_TYPE_OPTIONS}
              selected={sp.projectType ?? []}
              width="w-44"
            />

            <div className="flex flex-col gap-1 w-36 shrink-0">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Reihenfolge</label>
              <select name="dir" defaultValue={sp.dir} className="px-2 py-1 text-xs border rounded bg-background text-foreground">
                <option value="asc">aufsteigend</option>
                <option value="desc">absteigend</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">Anwenden</Button>
              <SaveFilterButton
                type="printDesign"
                currentAgent={sp.agent}
                currentStatus={sp.status}
                currentProjectType={sp.projectType}
              />
              <Button type="button" variant="outline" asChild>
                <Link href="/print-design?reset=1">Filter zurücksetzen</Link>
              </Button>
            </div>
          </form>

          <div className="text-sm text-muted-foreground">
            Zeige {startIndex + 1} - {endIndex} von {totalCount}
            {totalPages > 1 && (
              <span className="ml-4">
                Seite {validPage} von {totalPages}
              </span>
            )}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="status">Status</SortableHeader>
                  <SortableHeader field="customerNo">Kd.-Nr.</SortableHeader>
                  <SortableHeader field="clientName">Kunde</SortableHeader>
                  <TableHead className="w-12 text-center" title="Details">
                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </TableHead>
                  <SortableHeader field="projectType">Art</SortableHeader>
                  <SortableHeader field="agent">Agent</SortableHeader>
                  <SortableHeader field="webtermin">Webtermin</SortableHeader>
                  <SortableHeader field="implementation">Umsetzung</SortableHeader>
                  <SortableHeader field="designToClient">
                    Design an Kunden
                  </SortableHeader>
                  <SortableHeader field="designApproval">
                    Designabnahme
                  </SortableHeader>
                  <SortableHeader field="finalVersionToClient">
                    Finalversion
                  </SortableHeader>
                  <TableHead>Druck</TableHead>
                  <SortableHeader field="printOrderPlaced">
                    Druckauftrag
                  </SortableHeader>
                  <TableHead>Druckanbieter</TableHead>
                  <TableHead>P-Status</TableHead>
                  <TableHead>Notizen</TableHead>
                  <SortableHeader field="updatedAt">Aktualisiert</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center text-muted-foreground">
                      Keine Projekte gefunden
                    </TableCell>
                  </TableRow>
                )}
                {paginatedRows.map((row) => {
                  const project = projectsById.get(row.id);
                  const printDesign = project?.printDesign;
                  if (!project || !printDesign) return null;

                  return (
                    <TableRow
                      key={row.id}
                      className={row.isStale ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}
                    >
                      <TableCell>
                        <Badge variant="outline">{row.status}</Badge>
                      </TableCell>
                      <TableCell>{row.customerNo}</TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/print-design/${row.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
                          title="Details ansehen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="projectType"
                          type="select"
                          display={row.projectType}
                          value={printDesign.projectType ?? "SONSTIGES"}
                          options={PROJECT_TYPE_OPTIONS}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="project"
                          id={project.id}
                          name="agentId"
                          type="select"
                          display={row.agent !== "-" ? row.agent : "-"}
                          value={project.agentId ?? ""}
                          options={agentEditOptions}
                          canEdit={canEdit}
                          displayStyle={row.agent !== "-" ? agentBadgeStyle(row.agentColor) : undefined}
                          displayClassName={row.agent !== "-" ? AGENT_BADGE_BASE_CLASS : AGENT_BADGE_EMPTY_CLASS}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="webtermin"
                          type="datetime"
                          display={row.webtermin}
                          value={printDesign.webtermin}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="implementation"
                          type="date"
                          display={row.implementation}
                          value={printDesign.implementation}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="designToClient"
                          type="date"
                          display={row.designToClient}
                          value={printDesign.designToClient}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="designApproval"
                          type="date"
                          display={row.designApproval}
                          value={printDesign.designApproval}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="finalVersionToClient"
                          type="date"
                          display={row.finalVersionToClient}
                          value={printDesign.finalVersionToClient}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="printRequired"
                          type="tri"
                          display={row.printRequired ? "Ja" : "Nein"}
                          value={printDesign.printRequired}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="printOrderPlaced"
                          type="date"
                          display={row.printOrderPlaced}
                          value={printDesign.printOrderPlaced}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="printProvider"
                          type="text"
                          display={row.printProvider}
                          value={printDesign.printProvider ?? ""}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="pStatus"
                          type="select"
                          display={row.pStatus}
                          value={printDesign.pStatus}
                          options={pStatusEditOptions}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <PrintDesignInlineCell
                          target="printDesign"
                          id={project.id}
                          name="note"
                          type="textarea"
                          display={row.note}
                          value={printDesign.note ?? ""}
                          canEdit={canEdit}
                        />
                      </TableCell>
                      <TableCell>{row.updatedAt}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Link
                  href={makePageSizeHref(50)}
                  className={pageSize === 50 ? "font-bold" : ""}
                >
                  <Button variant={pageSize === 50 ? "default" : "outline"} size="sm">
                    50
                  </Button>
                </Link>
                <Link
                  href={makePageSizeHref(100)}
                  className={pageSize === 100 ? "font-bold" : ""}
                >
                  <Button variant={pageSize === 100 ? "default" : "outline"} size="sm">
                    100
                  </Button>
                </Link>
              </div>

              <div className="flex gap-2">
                {validPage > 1 && (
                  <Link href={makePageHref(validPage - 1)}>
                    <Button variant="outline" size="sm">
                      Zurück
                    </Button>
                  </Link>
                )}
                {validPage < totalPages && (
                  <Link href={makePageHref(validPage + 1)}>
                    <Button variant="outline" size="sm">
                      Weiter
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
