import type { Prisma } from "@prisma/client";

type ProductionStatusValue = Prisma.$Enums.ProductionStatus | string | null | undefined;
type MaterialStatusValue = Prisma.$Enums.MaterialStatus | string | null | undefined;
type DateLike = Date | string | null | undefined;

type WebsitePriorityValue = Prisma.$Enums.WebsitePriority | string | null | undefined;
type SeoStatusValue = Prisma.$Enums.SEOStatus | string | null | undefined;
type TextitStatusValue = Prisma.$Enums.TextitStatus | string | null | undefined;

type DeriveProjectStatusInput = {
  pStatus?: ProductionStatusValue;
  webDate?: DateLike;
  demoDate?: DateLike;
  onlineDate?: DateLike;
  materialStatus?: MaterialStatusValue;
  now?: Date;
};

const DONE_P_STATUS = new Set<string>(["DONE", "BEENDET", "FINISHED"]);
const MATERIAL_COMPLETE: Prisma.$Enums.MaterialStatus = "VOLLSTAENDIG";
const VOLLST_A_K: Prisma.$Enums.ProductionStatus = "VOLLST_A_K";
export const DONE_PRODUCTION_STATUSES: Prisma.$Enums.ProductionStatus[] = ["BEENDET"];

const toDate = (value: DateLike) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeStatus = (status?: ProductionStatusValue) => {
  if (!status) return undefined;
  if (typeof status === "string") return status.toUpperCase();
  return String(status).toUpperCase();
};

const normalizeMaterialStatus = (status?: MaterialStatusValue) => {
  if (!status) return undefined;
  if (typeof status === "string") return status.toUpperCase();
  return String(status).toUpperCase();
};

export type DerivedStatusFilter = Prisma.$Enums.ProjectStatus | "BEENDET";

export function deriveProjectStatus({
  pStatus,
  webDate,
  demoDate,
  onlineDate,
  materialStatus,
  now,
}: DeriveProjectStatusInput): Prisma.$Enums.ProjectStatus {
  const normalizedPStatus = normalizeStatus(pStatus);
  if (normalizedPStatus && DONE_P_STATUS.has(normalizedPStatus)) {
    return "ONLINE";
  }

  const online = toDate(onlineDate);
  if (online) {
    return "ONLINE";
  }

  const demo = toDate(demoDate);
  if (demo) {
    return "DEMO";
  }

  const effectiveNow = now ?? new Date();
  const web = toDate(webDate);
  if (!web || web > effectiveNow) {
    return "WEBTERMIN";
  }

  if (normalizedPStatus === VOLLST_A_K) {
    return "UMSETZUNG";
  }

  const normalizedMaterial = normalizeMaterialStatus(materialStatus);
  if (normalizedMaterial !== MATERIAL_COMPLETE) {
    return "MATERIAL";
  }

  return "UMSETZUNG";
}

export function buildWebsiteStatusWhere(
  status: DerivedStatusFilter,
  now: Date = new Date(),
): Prisma.ProjectWhereInput | undefined {
  const effectiveNow = new Date(now);

  const websiteBase = (
    conditions: Prisma.ProjectWebsiteWhereInput,
  ): Prisma.ProjectWhereInput => ({
    type: "WEBSITE",
    website: { is: conditions },
  });

  const excludeDone: Prisma.ProjectWebsiteWhereInput = {
    pStatus: { notIn: DONE_PRODUCTION_STATUSES },
  };

  switch (status) {
    case "BEENDET":
      return websiteBase({
        pStatus: { in: DONE_PRODUCTION_STATUSES },
      });
    case "ONLINE":
      return websiteBase({
        OR: [
          { pStatus: { in: DONE_PRODUCTION_STATUSES } },
          { onlineDate: { not: null } },
        ],
      });
    case "DEMO":
      return websiteBase({
        AND: [
          excludeDone,
          { onlineDate: null },
          { demoDate: { not: null } },
        ],
      });
    case "WEBTERMIN":
      return websiteBase({
        AND: [
          excludeDone,
          { onlineDate: null },
          { demoDate: null },
          {
            OR: [
              { webDate: null },
              { webDate: { gt: effectiveNow } },
            ],
          },
        ],
      });
    case "MATERIAL":
      return websiteBase({
        AND: [
          excludeDone,
          { onlineDate: null },
          { demoDate: null },
          { webDate: { lte: effectiveNow } },
          {
            OR: [
              { materialStatus: { not: MATERIAL_COMPLETE } },
              { materialStatus: null },
            ],
          },
          { pStatus: { not: VOLLST_A_K } },
        ],
      });
    case "UMSETZUNG":
      return websiteBase({
        AND: [
          excludeDone,
          { onlineDate: null },
          { demoDate: null },
          { webDate: { lte: effectiveNow } },
          {
            OR: [
              { pStatus: VOLLST_A_K },
              { materialStatus: MATERIAL_COMPLETE },
            ],
          },
        ],
      });
    default:
      return undefined;
  }
}

const PROJECT_STATUS_LABELS: Record<Prisma.$Enums.ProjectStatus, string> = {
  WEBTERMIN: "Webtermin",
  MATERIAL: "Material",
  UMSETZUNG: "Umsetzung",
  DEMO: "Demo",
  ONLINE: "Online",
};

export function labelForProjectStatus(
  status: Prisma.$Enums.ProjectStatus,
  opts?: { pStatus?: ProductionStatusValue },
): string {
  const normalizedPStatus = normalizeStatus(opts?.pStatus);
  if (normalizedPStatus && DONE_P_STATUS.has(normalizedPStatus)) {
    return "Beendet";
  }
  return PROJECT_STATUS_LABELS[status] ?? status;
}

const WEBSITE_PRIORITY_LABELS: Record<Prisma.$Enums.WebsitePriority, string> = {
  NONE: "-",
  PRIO_1: "Prio 1",
  PRIO_2: "Prio 2",
  PRIO_3: "Prio 3",
};

const PRODUCTION_STATUS_LABELS: Record<Prisma.$Enums.ProductionStatus, string> = {
  NONE: "-",
  BEENDET: "Beendet",
  MMW: "MMW",
  VOLLST_A_K: "vollst. a.K.",
};

const SEO_STATUS_LABELS: Record<Prisma.$Enums.SEOStatus, string> = {
  NEIN: "NEIN",
  NEIN_NEIN: "NEIN/NEIN",
  JA_NEIN: "JA/NEIN",
  JA_JA: "JA/JA",
};

const TEXTIT_STATUS_LABELS: Record<Prisma.$Enums.TextitStatus, string> = {
  NEIN: "NEIN",
  NEIN_NEIN: "NEIN/NEIN",
  JA_NEIN: "JA/NEIN",
  JA_JA: "JA/JA",
};

export function labelForWebsitePriority(value?: WebsitePriorityValue): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "-";
    const normalized = trimmed.toUpperCase();
    const map = WEBSITE_PRIORITY_LABELS as Record<string, string>;
    return map[normalized] ?? normalized.replace(/_/g, " ");
  }
  const normalized = String(value).toUpperCase();
  const map = WEBSITE_PRIORITY_LABELS as Record<string, string>;
  return map[normalized] ?? normalized.replace(/_/g, " ");
}

export function labelForProductionStatus(value?: ProductionStatusValue): string {
  const normalized = normalizeStatus(value);
  if (!normalized) return "-";
  const map = PRODUCTION_STATUS_LABELS as Record<string, string>;
  return map[normalized] ?? normalized.replace(/_/g, " ");
}

export function labelForSeoStatus(value?: SeoStatusValue): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "-";
    const normalized = trimmed.toUpperCase();
    const map = SEO_STATUS_LABELS as Record<string, string>;
    return map[normalized] ?? normalized.replace(/_/g, "/");
  }
  const normalized = String(value).toUpperCase();
  const map = SEO_STATUS_LABELS as Record<string, string>;
  return map[normalized] ?? normalized.replace(/_/g, "/");
}

export function labelForTextitStatus(value?: TextitStatusValue): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "-";
    const normalized = trimmed.toUpperCase();
    const map = TEXTIT_STATUS_LABELS as Record<string, string>;
    return map[normalized] ?? normalized.replace(/_/g, "/");
  }
  const normalized = String(value).toUpperCase();
  const map = TEXTIT_STATUS_LABELS as Record<string, string>;
  return map[normalized] ?? normalized.replace(/_/g, "/");
}

