import type {
  Prisma,
  ProjectStatus,
  ProductionStatus,
  MaterialStatus,
  WebsitePriority,
  SEOStatus,
  TextitStatus,
} from "@prisma/client";

type ProductionStatusValue = ProductionStatus | string | null | undefined;
type MaterialStatusValue = MaterialStatus | string | null | undefined;
type DateLike = Date | string | null | undefined;

type WebsitePriorityValue = WebsitePriority | string | null | undefined;
type SeoStatusValue = SEOStatus | string | null | undefined;
type TextitStatusValue = TextitStatus | string | null | undefined;

type DeriveProjectStatusInput = {
  pStatus?: ProductionStatusValue;
  webDate?: DateLike;
  webterminType?: string | null;
  demoDate?: DateLike;
  onlineDate?: DateLike;
  materialStatus?: MaterialStatusValue;
  now?: Date;
};

const DONE_P_STATUS = new Set<string>(["DONE", "BEENDET", "FINISHED"]);
export const MATERIAL_STATUS_VALUES = ["ANGEFORDERT", "TEILWEISE", "VOLLSTAENDIG", "NV"] as const;
const MATERIAL_STATUS_SET = new Set<string>(MATERIAL_STATUS_VALUES);
const MATERIAL_COMPLETE: MaterialStatus = "VOLLSTAENDIG";
const INCOMPLETE_MATERIAL_STATUSES: MaterialStatus[] = MATERIAL_STATUS_VALUES.filter((value) => value !== MATERIAL_COMPLETE) as MaterialStatus[];
const VOLLST_A_K: ProductionStatus = "VOLLST_A_K";
const VOLLST_K_E_S: ProductionStatus = "VOLLST_K_E_S";
const COMPLETE_STATUSES = new Set<string>(["VOLLST_A_K", "VOLLST_K_E_S"]);
export const DONE_PRODUCTION_STATUSES: ProductionStatus[] = ["BEENDET"];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  WEBTERMIN: "Webtermin",
  MATERIAL: "Material",
  UMSETZUNG: "Umsetzung",
  DEMO: "Demo",
  ONLINE: "Online",
  BEENDET: "Beendet",
};

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

export const normalizeMaterialStatus = (status?: MaterialStatusValue): MaterialStatus | undefined => {
  if (status === null || status === undefined) return undefined;
  const raw = typeof status === "string" ? status.trim() : String(status);
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  const normalized = upper
    .replace(/\u00C4/g, "AE")
    .replace(/\u00D6/g, "OE")
    .replace(/\u00DC/g, "UE")
    .replace(/\u00DF/g, "SS");
  const simple = normalized.replace(/[^A-Z]/g, "");
  if (["ANGEFORDERT", "ANGEFORDERUNG"].includes(simple)) return "ANGEFORDERT";
  if (["TEILWEISE", "TEILW"].includes(simple)) return "TEILWEISE";
  if (
    ["VOLLSTAENDIG", "VOLLST", "JA", "FULLCONTENT", "FULLCONT"].includes(simple) ||
    simple.endsWith("VOLLSTAENDIG")
  ) {
    return "VOLLSTAENDIG";
  }
  if (["NV", "NEIN", "NICHTVORHANDEN"].includes(simple)) return "NV";
  if (MATERIAL_STATUS_SET.has(normalized)) {
    return normalized as MaterialStatus;
  }
  return undefined;
};

export type DerivedStatusFilter = ProjectStatus | "BEENDET";

export function deriveProjectStatus({
  pStatus,
  webDate,
  webterminType,
  demoDate,
  onlineDate,
  materialStatus,
  now,
}: DeriveProjectStatusInput): ProjectStatus {
  const normalizedPStatus = normalizeStatus(pStatus);
  if (normalizedPStatus && DONE_P_STATUS.has(normalizedPStatus)) {
    return "BEENDET";
  }

  const online = toDate(onlineDate);
  if (online) {
    return "ONLINE";
  }

  const demo = toDate(demoDate);
  if (demo) {
    return "DEMO";
  }

  // If webterminType is "OHNE_TERMIN", skip WEBTERMIN phase and go directly to MATERIAL
  if (webterminType === "OHNE_TERMIN") {
    if (normalizedPStatus && COMPLETE_STATUSES.has(normalizedPStatus)) {
      return "UMSETZUNG";
    }
    const normalizedMaterial = normalizeMaterialStatus(materialStatus);
    if (normalizedMaterial !== MATERIAL_COMPLETE) {
      return "MATERIAL";
    }
    return "UMSETZUNG";
  }

  const effectiveNow = now ?? new Date();
  const web = toDate(webDate);
  if (!web || web > effectiveNow) {
    return "WEBTERMIN";
  }

  if (normalizedPStatus && COMPLETE_STATUSES.has(normalizedPStatus)) {
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
          // Exclude projects with OHNE_TERMIN (but include NULL values)
          {
            OR: [
              { webterminType: null },
              { webterminType: { not: "OHNE_TERMIN" } },
            ],
          },
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
          {
            OR: [
              // Regular case: webDate in past, material incomplete, not complete
              {
                AND: [
                  { webDate: { lte: effectiveNow } },
                  { materialStatus: { in: INCOMPLETE_MATERIAL_STATUSES } },
                  { pStatus: { notIn: [VOLLST_A_K, VOLLST_K_E_S] } },
                ],
              },
              // OHNE_TERMIN case: material incomplete, not complete
              {
                AND: [
                  { webterminType: "OHNE_TERMIN" },
                  { materialStatus: { in: INCOMPLETE_MATERIAL_STATUSES } },
                  { pStatus: { notIn: [VOLLST_A_K, VOLLST_K_E_S] } },
                ],
              },
            ],
          },
        ],
      });
    case "UMSETZUNG":
      return websiteBase({
        AND: [
          excludeDone,
          { onlineDate: null },
          { demoDate: null },
          {
            OR: [
              // Regular case: webDate in past and (complete status or material complete)
              {
                AND: [
                  { webDate: { lte: effectiveNow } },
                  {
                    OR: [
                      { pStatus: { in: [VOLLST_A_K, VOLLST_K_E_S] } },
                      { materialStatus: MATERIAL_COMPLETE },
                    ],
                  },
                ],
              },
              // OHNE_TERMIN case: complete status or material complete
              {
                AND: [
                  { webterminType: "OHNE_TERMIN" },
                  {
                    OR: [
                      { pStatus: { in: [VOLLST_A_K, VOLLST_K_E_S] } },
                      { materialStatus: MATERIAL_COMPLETE },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    default:
      return undefined;
  }
}

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  WEBTERMIN: "Webtermin",
  MATERIAL: "Material",
  UMSETZUNG: "Umsetzung",
  DEMO: "Demo",
  ONLINE: "Online",
  BEENDET: "Beendet",
};

export function labelForProjectStatus(
  status: ProjectStatus,
  opts?: { pStatus?: ProductionStatusValue },
): string {
  // No need to check pStatus anymore - status should already be BEENDET if pStatus is BEENDET
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export function labelForMaterialStatus(value?: MaterialStatusValue): string {
  const normalized = normalizeMaterialStatus(value);
  if (!normalized) return "-";
  const map = MATERIAL_STATUS_LABELS as Record<string, string>;
  return map[normalized] ?? normalized.replace(/_/g, " ");
}

/**
 * Generiert einen Anzeigenamen für ein Projekt.
 * Wenn kein Titel vorhanden ist, wird basierend auf Typ ein sinnvoller Name generiert.
 */
export function getProjectDisplayName(project: {
  title?: string | null;
  type: string;
  website?: {
    cms?: string | null;
    cmsOther?: string | null;
  } | null;
}): string {
  if (project.title) {
    return project.title;
  }

  // Kein Titel vorhanden - erstelle sinnvollen Fallback basierend auf Typ und CMS
  if (project.type === "WEBSITE" && project.website) {
    const cms = project.website.cms;
    switch (cms) {
      case "JOOMLA":
        return "Webseite (Joomla)";
      case "WORDPRESS":
        return "Webseite (WordPress)";
      case "SHOPWARE":
        return "Shop (Shopware)";
      case "LOGO":
        return "Logo";
      case "PRINT":
        return "Print";
      case "CUSTOM":
        return "Webseite (Custom)";
      case "OTHER":
        return project.website.cmsOther || "Anderes";
      default:
        return "Webseite";
    }
  } else if (project.type === "FILM") {
    return "Film";
  } else if (project.type === "SOCIAL") {
    return "Social Media";
  }

  return project.type;
}

const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  ANGEFORDERT: "angefordert",
  TEILWEISE: "teilweise",
  VOLLSTAENDIG: "vollständig",
  NV: "N.V.",
};

const WEBSITE_PRIORITY_LABELS: Record<WebsitePriority, string> = {
  NONE: "-",
  PRIO_1: "Prio 1",
  PRIO_2: "Prio 2",
  PRIO_3: "Prio 3",
};

const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  NONE: "-",
  BEENDET: "Beendet",
  MMW: "MMW",
  VOLLST_A_K: "vollst. a.K.",
  VOLLST_K_E_S: "vollst. K.e.S.",
};

const SEO_STATUS_LABELS: Record<SEOStatus, string> = {
  NEIN: "nein",
  NEIN_NEIN: "nein/nein",
  JA_NEIN: "ja/nein",
  JA_JA: "ja/ja",
  JA: "ja",
};

const TEXTIT_STATUS_LABELS: Record<TextitStatus, string> = {
  NEIN: "nein",
  NEIN_NEIN: "nein/nein",
  JA_NEIN: "ja/nein",
  JA_JA: "ja/ja",
  JA: "ja",
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



