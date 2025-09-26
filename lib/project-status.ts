import type { Prisma } from "@prisma/client";

export const PROJECT_STATUS_VALUES = [
  "WEBTERMIN",
  "UMSETZUNG",
  "DEMO",
  "ONLINE",
  "BEENDET"
] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number];

type ProductionStatusValue = Prisma.$Enums.ProductionStatus | string | null | undefined;

type DateLike = Date | string | null | undefined;

type DeriveProjectStatusInput = {
  pStatus?: ProductionStatusValue;
  webDate?: DateLike;
  demoDate?: DateLike;
  onlineDate?: DateLike;
  now?: Date;
};

const DONE_P_STATUS = new Set<string>(["DONE", "BEENDET", "FINISHED"]);

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

export function deriveProjectStatus({
  pStatus,
  webDate,
  demoDate,
  onlineDate,
  now,
}: DeriveProjectStatusInput): ProjectStatusValue {
  const effectiveNow = now ?? new Date();
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

  const web = toDate(webDate);
  if (!web || web > effectiveNow) {
    return "WEBTERMIN";
  }

  return "UMSETZUNG";
}


